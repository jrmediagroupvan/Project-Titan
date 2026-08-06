"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, clearSession, getSession, createPendingTwoFactor, getPendingTwoFactor, getTrustedDeviceCookie, setTrustedDeviceCookie, setMfaSetupRequired } from "@/lib/auth";
import { requireOwner, requireUser } from "@/lib/authorization";
import { FeatureCategory, PermissionKey } from "@prisma/client";
import { requirePermission, userAllows } from "@/lib/permissions";
import { customerWhere, requireCustomerAccess, requireOrderAccess, requireQuoteAccess, requireTaskAccess } from "@/lib/customer-access";
import { calculateQuotePricing, currentMaterialCostPerKg, currentMaterialPricing, materialRateCatalog, materialWasteMultiplier } from "@/lib/pricing";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { deleteMailboxMessage, listMailbox, readMailboxMessage, sendMailboxMessage, testEmailAccount } from "@/lib/email";
import { parseQuoteRequest, quoteReviewEmail } from "@/lib/email-quote";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { authenticatorUri, generateBase32Secret, generateRecoveryCodes, hashSecurityToken, verifyTotp } from "@/lib/two-factor";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_UPLOAD_EXTENSIONS, extensionFor, MAX_UPLOAD_BYTES, safeStoragePath } from "@/lib/storage";
import { AiConfiguration, createAiReply, defaultBaseUrl, loadAiConfiguration } from "@/lib/ai";
import { startTitanUpdate } from "@/lib/updater";
import { isZeroCostOpenRouterModel } from "@/lib/openrouter-models";
import { requestBambuSlice } from "@/lib/slicer";
import { PASSWORD_RESET_TTL_MINUTES, createPasswordResetToken, hashPasswordResetToken, sendPasswordResetEmail } from "@/lib/password-recovery";

const s=(f:FormData,k:string)=>String(f.get(k)||"").trim();
const cents=(v:string)=>Math.round((Number(v)||0)*100);
export async function loginAction(f:FormData){
 const email=s(f,"email").toLowerCase(), password=s(f,"password");
 const requestHeaders=await headers();
 const ipAddress=requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()||requestHeaders.get("x-real-ip")||null;
 const userAgent=requestHeaders.get("user-agent")||null;
 const user=await db.user.findUnique({where:{email},include:{twoFactorCredential:true}});
 const valid=Boolean(user?.active && await bcrypt.compare(password,user.passwordHash));
 await db.loginAttempt.create({data:{userId:user?.id,email,successful:valid,ipAddress,userAgent}}).catch(()=>undefined);
 if(!valid || !user) redirect("/login?error=1");
 if(user.twoFactorCredential?.enabled){
   const trustedToken=await getTrustedDeviceCookie();
   const trusted=trustedToken?await db.trustedDevice.findFirst({where:{userId:user.id,tokenHash:hashSecurityToken(trustedToken),expiresAt:{gt:new Date()}}}):null;
   if(!trusted){
     await createPendingTwoFactor({id:user.id,email:user.email,role:user.role});
     redirect("/two-factor");
   }
   await db.trustedDevice.update({where:{id:trusted.id},data:{lastUsedAt:new Date()}});
 }
 await db.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
 await createSession({id:user.id,email:user.email,role:user.role});
 // Two-step verification is optional. Clear any legacy enrollment lock.
 await setMfaSetupRequired(false);
 if(user.mustChangePassword) redirect("/settings/profile?changePassword=1");
 redirect("/");
}

export async function verifyTwoFactorLoginAction(f:FormData){
 const pending=await getPendingTwoFactor();
 if(!pending) redirect("/login");
 const code=s(f,"code").toUpperCase();
 const credential=await db.twoFactorCredential.findUnique({where:{userId:pending.id}});
 if(!credential?.enabled) redirect("/login");
 const secret=decryptSecret(credential.encryptedSecret);
 let accepted=verifyTotp(secret,code);
 if(!accepted){
   const recovery=await db.recoveryCode.findFirst({where:{userId:pending.id,codeHash:hashSecurityToken(code),usedAt:null}});
   if(recovery){await db.recoveryCode.update({where:{id:recovery.id},data:{usedAt:new Date()}});accepted=true;}
 }
 if(!accepted) redirect("/two-factor?error=1");
 if(s(f,"remember")==="yes"){
   const token=randomBytes(32).toString("base64url");
   const requestHeaders=await headers();
   await db.trustedDevice.create({data:{userId:pending.id,tokenHash:hashSecurityToken(token),name:"Trusted browser",userAgent:requestHeaders.get("user-agent"),ipAddress:requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()||null,expiresAt:new Date(Date.now()+30*24*60*60*1000)}});
   await setTrustedDeviceCookie(token);
 }
 await db.user.update({where:{id:pending.id},data:{lastLoginAt:new Date()}});
 await createSession({id:pending.id,email:pending.email,role:pending.role});
 await setMfaSetupRequired(false);
 redirect("/");
}

export async function beginTwoFactorSetupAction(){
 const user=await requireUser();
 const secret=generateBase32Secret();
 await db.twoFactorCredential.upsert({where:{userId:user.id},update:{encryptedSecret:encryptSecret(secret),enabled:false,verifiedAt:null},create:{userId:user.id,encryptedSecret:encryptSecret(secret)}});
 redirect("/settings/security?setup=1");
}

export async function confirmTwoFactorSetupAction(f:FormData){
 const user=await requireUser();
 const code=s(f,"code");
 const credential=await db.twoFactorCredential.findUnique({where:{userId:user.id}});
 if(!credential||!verifyTotp(decryptSecret(credential.encryptedSecret),code)) redirect("/settings/security?setup=1&error=code");
 const codes=generateRecoveryCodes();
 await db.$transaction([
   db.twoFactorCredential.update({where:{userId:user.id},data:{enabled:true,verifiedAt:new Date()}}),
   db.recoveryCode.deleteMany({where:{userId:user.id}}),
   db.recoveryCode.createMany({data:codes.map(code=>({userId:user.id,codeHash:hashSecurityToken(code)}))}),
   db.auditEvent.create({data:{userId:user.id,action:"TWO_FACTOR_ENABLED",entityType:"User",entityId:user.id,summary:`Two-factor authentication enabled for ${user.email}`}}),
 ]);
 await setMfaSetupRequired(false);
 redirect(`/settings/security?enabled=1&codes=${encodeURIComponent(codes.join(","))}`);
}

export async function disableTwoFactorAction(f:FormData){
 const user=await requireUser();
 const password=s(f,"password");
 const account=await db.user.findUnique({
   where:{id:user.id},
   select:{passwordHash:true,email:true},
 });
 if(!account || !password || !await bcrypt.compare(password,account.passwordHash)){
   redirect("/settings/security?disableError=password");
 }
 await db.$transaction([
   db.twoFactorCredential.deleteMany({where:{userId:user.id}}),
   db.recoveryCode.deleteMany({where:{userId:user.id}}),
   db.trustedDevice.deleteMany({where:{userId:user.id}}),
   db.auditEvent.create({
     data:{
       userId:user.id,
       action:"TWO_FACTOR_DISABLED",
       entityType:"User",
       entityId:user.id,
       summary:`Two-factor authentication disabled for ${account.email}`,
     },
   }),
 ]);
 await setMfaSetupRequired(false);
 revalidatePath("/settings/security");
 redirect("/settings/security?disabled=1");
}

export async function revokeTrustedDeviceAction(f:FormData){
 const user=await requireUser();
 await db.trustedDevice.deleteMany({where:{id:s(f,"id"),userId:user.id}});
 revalidatePath("/settings/security");
}
export async function logoutAction(){ await clearSession(); redirect("/login"); }

export async function requestPasswordResetAction(f: FormData) {
  const email = s(f, "email").toLowerCase();
  if (!email || !email.includes("@")) redirect("/forgot-password?sent=1");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) redirect("/forgot-password?sent=1");

  const recent = await db.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) }, usedAt: null },
  });
  if (recent) redirect("/forgot-password?sent=1");

  await db.passwordResetToken.deleteMany({
    where: { userId: user.id, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
  });

  const { token, tokenHash } = createPasswordResetToken();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    },
  });

  try {
    await sendPasswordResetEmail({ recipient: user.email, displayName: user.name, token });
    await db.auditEvent.create({ data: { userId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id, summary: `Password reset requested for ${user.email}` } });
  } catch (error) {
    console.error("Password recovery email failed", error);
    await db.passwordResetToken.deleteMany({ where: { tokenHash } });
    redirect("/forgot-password?error=mail");
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(f: FormData) {
  const token = s(f, "token");
  const password = s(f, "password");
  const confirmPassword = s(f, "confirmPassword");
  if (!token) redirect("/reset-password?error=invalid");
  if (password.length < 12 || password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password`);
  }

  const tokenHash = hashPasswordResetToken(token);
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.user.active) {
    redirect("/reset-password?error=invalid");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash, mustChangePassword: false } }),
    db.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.updateMany({ where: { userId: reset.userId, id: { not: reset.id }, usedAt: null }, data: { usedAt: new Date() } }),
    db.auditEvent.create({ data: { userId: reset.userId, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: reset.userId, summary: `Password reset completed for ${reset.user.email}` } }),
  ]);

  await clearSession();
  redirect("/reset-password?success=1");
}
export async function createCustomer(f:FormData){
 const actor=await requirePermission(PermissionKey.CUSTOMERS_CREATE);
 const requestedAssignee=s(f,"assignedToId");
 const assignedToId=(actor.role==="OWNER"||actor.role==="ADMIN")?(requestedAssignee||actor.id):actor.id;
 await db.customer.create({data:{name:s(f,"name"),company:s(f,"company")||null,email:s(f,"email")||null,phone:s(f,"phone")||null,notes:s(f,"notes")||null,assignedToId}}); revalidatePath("/customers");
}
export async function deleteCustomer(f:FormData){ return safeDeleteCustomer(f); }
export async function createMaterial(f:FormData){
 await requirePermission(PermissionKey.INVENTORY_CREATE);
 await db.material.create({data:{name:s(f,"name"),type:s(f,"type"),colour:s(f,"colour")||null,brand:s(f,"brand")||null,gramsOnHand:Number(s(f,"gramsOnHand"))||0,reorderAtGrams:Number(s(f,"reorderAtGrams"))||500,costPerKgCents:cents(s(f,"costPerKg"))}}); revalidatePath("/inventory");
}
export async function adjustMaterial(f:FormData){ await requirePermission(PermissionKey.INVENTORY_EDIT); const id=s(f,"id"), delta=Number(s(f,"delta"))||0; await db.material.update({where:{id},data:{gramsOnHand:{increment:delta}}}); revalidatePath("/inventory"); }
export async function createQuote(f:FormData){
  const actor=await requirePermission(PermissionKey.QUOTES_CREATE);
  const customerId=s(f,"customerId"),customerFileId=s(f,"customerFileId")||null, quantity=Math.max(1,Number(s(f,"quantity"))||1);
  await requireCustomerAccess(customerId,actor);
  if(customerFileId){
    const linkedFile=await db.customerFile.findFirst({where:{id:customerFileId,customerId}});
    if(!linkedFile)redirect("/quotes?error=file-access");
  }
 const material=s(f,"material"), grams=Number(s(f,"estimatedGrams"))||0, minutes=Number(s(f,"estimatedMinutes"))||0;
 const settings=await db.businessSetting.findUnique({where:{id:"primary"}});
 const catalog=materialRateCatalog();
 const markup=Number(s(f,"markupPercent"))||settings?.quoteMarkupPercent||catalog.defaultMarkupPercent;
 const costPerKg=material?await currentMaterialCostPerKg(material):0;
 const hourlyRate=cents(s(f,"machineHourlyRate"))||cents(String(catalog.defaultMachineHourlyRateCad));
 const setupFee=cents(s(f,"setupFee"))||cents(String(catalog.defaultSetupFeeCad));
 const pricing=calculateQuotePricing({
   costPerKgCents:costPerKg,gramsPerItem:grams,minutesPerItem:minutes,quantity,
   wasteMultiplier:materialWasteMultiplier(material),hourlyRateCents:hourlyRate,
   setupFeeCents:setupFee,markupPercent:markup,
   minimumQuoteCents:cents(String(catalog.minimumQuoteCad)),
 });
 const pricingMode=s(f,"pricingMode")==="MANUAL"?"MANUAL":"AUTO";
 const manualUnit=cents(s(f,"unitPrice"));
 if(pricingMode==="MANUAL"&&!manualUnit)redirect("/quotes?error=manual-price");
 if(pricingMode==="MANUAL"&&manualUnit<pricing.baseCostPerItemCents&&f.get("allowBelowCost")!=="on")redirect("/quotes?error=below-cost");
 const unit=pricingMode==="MANUAL"?manualUnit:pricing.automaticUnitPriceCents;
 const subtotal=quantity*unit, taxRate=Number(s(f,"taxRate"))||0, tax=Math.round(subtotal*taxRate/100);
 const count=await db.quote.count(); const number=`Q-${new Date().getFullYear()}-${String(count+1).padStart(4,"0")}`;
 await db.quote.create({data:{number,customerId,notes:s(f,"notes")||null,subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax,items:{create:{customerFileId,description:s(f,"description"),quantity,material:material||null,colour:s(f,"colour")||null,estimatedGrams:grams||null,estimatedMinutes:minutes||null,baseCostCents:pricing.baseCostPerItemCents,markupPercent:markup,priceSource:pricingMode==="MANUAL"?"MANUAL_OVERRIDE":"AUTO_CONFIG",unitPriceCents:unit,lineTotalCents:subtotal}}}}); revalidatePath("/quotes");
}
export async function updateQuoteStatus(f:FormData){ const actor=await requirePermission(PermissionKey.QUOTES_EDIT); const id=s(f,"id"); await requireQuoteAccess(id,actor); await db.quote.update({where:{id},data:{status:s(f,"status") as any}}); revalidatePath("/quotes"); }
export async function convertQuoteToOrder(f:FormData){
 const actor=await requirePermission(PermissionKey.ORDERS_CREATE);
 const id=s(f,"id"); await requireQuoteAccess(id,actor); const q=await db.quote.findUnique({where:{id},include:{order:true}}); if(!q||q.order)return;
 const count=await db.order.count(); const number=`O-${new Date().getFullYear()}-${String(count+1).padStart(4,"0")}`;
 const order=await db.order.create({data:{number,customerId:q.customerId,quoteId:q.id,totalCents:q.totalCents,status:"QUEUED"}});
 await db.productionJob.create({data:{orderId:order.id,status:"QUEUED",notes:`Created from ${q.number}`}});
 await db.quote.update({where:{id:q.id},data:{status:"APPROVED"}}); revalidatePath("/quotes"); revalidatePath("/production");
}
export async function updateJob(f:FormData){ const actor=await requirePermission(PermissionKey.PRODUCTION_EDIT); const id=s(f,"id"); const job=await db.productionJob.findUnique({where:{id},select:{orderId:true}}); if(!job)return; await requireOrderAccess(job.orderId,actor); await db.productionJob.update({where:{id},data:{status:s(f,"status") as any,printerId:s(f,"printerId")||null,notes:s(f,"notes")||null}}); revalidatePath("/production"); }
export async function createPrinter(f:FormData){ await requirePermission(PermissionKey.PRODUCTION_CREATE); await db.printer.create({data:{name:s(f,"name"),model:s(f,"model")||null}}); revalidatePath("/production"); }


export async function createUserAction(f: FormData) {
  const actor=await requirePermission(PermissionKey.USERS_MANAGE);
  const name=s(f,"name"), email=s(f,"email").toLowerCase(), password=s(f,"password");
  const role=s(f,"role") as any;
  if(!name || !email || password.length < 8) redirect("/settings/users?error=invalid");
  const customerAccessMode=actor.role==="OWNER"&&s(f,"customerAccessMode")==="ALL"?"ALL":"ASSIGNED";
  const featureAccessMode=role==="OWNER"?"ALL":s(f,"featureAccessMode")==="ALL"?"ALL":"ASSIGNED";
  await db.user.create({data:{name,email,passwordHash:await bcrypt.hash(password,12),role,customerAccessMode,featureAccessMode,jobTitle:s(f,"jobTitle")||null,phone:s(f,"phone")||null,mustChangePassword:true}});
  revalidatePath("/settings/users");
}

export async function updateUserAction(f: FormData) {
  const actor=await requirePermission(PermissionKey.USERS_MANAGE);
  const id=s(f,"id");
  const target=await db.user.findUnique({where:{id}});
  if(!target) return;
  if(target.role==="OWNER" && actor.role!=="OWNER") redirect("/settings/users?error=owner");
  const role=s(f,"role") as any;
  const customerAccessMode=role==="OWNER"?"ALL":actor.role==="OWNER"?(s(f,"customerAccessMode")==="ALL"?"ALL":"ASSIGNED"):target.customerAccessMode;
  const featureAccessMode=role==="OWNER"?"ALL":actor.role==="OWNER"?(s(f,"featureAccessMode")==="ALL"?"ALL":"ASSIGNED"):target.featureAccessMode;
  await db.user.update({where:{id},data:{name:s(f,"name"),email:s(f,"email").toLowerCase(),role,customerAccessMode,featureAccessMode,jobTitle:s(f,"jobTitle")||null,phone:s(f,"phone")||null,active:f.get("active")==="on"}});
  revalidatePath("/settings/users");
}

export async function adminResetPasswordAction(f: FormData) {
  const actor=await requirePermission(PermissionKey.USERS_MANAGE);
  const id=s(f,"id"), password=s(f,"password");
  const target=await db.user.findUnique({where:{id}});
  if(!target || password.length<8) redirect("/settings/users?error=password");
  if(target.role==="OWNER" && actor.role!=="OWNER") redirect("/settings/users?error=owner");
  await db.user.update({where:{id},data:{passwordHash:await bcrypt.hash(password,12),mustChangePassword:true}});
  revalidatePath("/settings/users");
}

export async function deleteUserAction(f: FormData) {
  const actor=await requireOwner();
  const id=s(f,"id");
  if(id===actor.id) redirect("/settings/users?error=self");
  const target=await db.user.findUnique({where:{id}});
  if(!target || target.role==="OWNER") redirect("/settings/users?error=owner");
  await db.user.delete({where:{id}});
  revalidatePath("/settings/users");
}

export async function updateProfileAction(f: FormData) {
  const user=await requireUser();
  await db.user.update({where:{id:user.id},data:{name:s(f,"name"),jobTitle:s(f,"jobTitle")||null,phone:s(f,"phone")||null,avatarUrl:s(f,"avatarUrl")||null}});
  revalidatePath("/settings/profile");
}

export async function changeOwnPasswordAction(f: FormData) {
  const session=await getSession();
  if(!session) redirect("/login");
  const user=await db.user.findUnique({where:{id:session.id}});
  if(!user) redirect("/login");
  const current=s(f,"currentPassword"), password=s(f,"newPassword"), confirm=s(f,"confirmPassword");
  if(!(await bcrypt.compare(current,user.passwordHash)) || password.length<8 || password!==confirm) redirect("/settings/profile?error=password");
  await db.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(password,12),mustChangePassword:false}});
  await createSession({id:user.id,email:user.email,role:user.role});
  redirect("/settings/profile?success=password");
}

async function audit(action:string, summary:string, entityType?:string, entityId?:string){
  const session=await getSession();
  await db.auditEvent.create({data:{userId:session?.id||null,action,summary,entityType:entityType||null,entityId:entityId||null}}).catch(()=>{});
}

export async function updateOrderStatus(f:FormData){
  const actor=await requirePermission(PermissionKey.ORDERS_EDIT); const id=s(f,"id"), status=s(f,"status") as any;
  await requireOrderAccess(id,actor);
  const order=await db.order.update({where:{id},data:{status}}); await audit("ORDER_STATUS",`${order.number} changed to ${status}`,"Order",id); revalidatePath("/orders"); revalidatePath("/");
}
export async function recordPayment(f:FormData){
  const actor=await requirePermission(PermissionKey.ORDERS_EDIT); const orderId=s(f,"orderId"), amount=cents(s(f,"amount")); await requireOrderAccess(orderId,actor); const order=await db.order.findUnique({where:{id:orderId}}); if(!order||amount<=0)return;
  await db.payment.create({data:{orderId,customerId:order.customerId,amountCents:amount,status:"PAID",paidAt:new Date(),provider:s(f,"provider")||"MANUAL",notes:s(f,"notes")||null}});
  const paid=Math.min(order.totalCents,order.paidCents+amount); await db.order.update({where:{id:orderId},data:{paidCents:paid,status:paid>=order.totalCents?"PAID":order.status}});
  await audit("PAYMENT_RECORDED",`Payment recorded for ${order.number}`,"Order",orderId); revalidatePath("/orders"); revalidatePath("/reports");
}
export async function createShipment(f:FormData){
  const actor=await requirePermission(PermissionKey.ORDERS_EDIT); const orderId=s(f,"orderId"); await requireOrderAccess(orderId,actor); const order=await db.order.findUnique({where:{id:orderId}}); if(!order)return;
  await db.shipment.create({data:{orderId,customerId:order.customerId,carrier:s(f,"carrier")||"CANADA_POST",service:s(f,"service")||null,trackingNumber:s(f,"trackingNumber")||null,status:s(f,"trackingNumber")?"LABEL_CREATED":"DRAFT"}});
  await audit("SHIPMENT_CREATED",`Shipment created for ${order.number}`,"Order",orderId); revalidatePath("/orders");
}
export async function createTask(f:FormData){
  const user=await requirePermission(PermissionKey.TASKS_CREATE); const due=s(f,"dueAt"),customerId=s(f,"customerId")||null; if(customerId)await requireCustomerAccess(customerId,user); await db.task.create({data:{title:s(f,"title"),description:s(f,"description")||null,priority:(s(f,"priority")||"NORMAL") as any,status:"OPEN",assignedToId:s(f,"assignedToId")||null,customerId,createdById:user.id,dueAt:due?new Date(due):null}}); await audit("TASK_CREATED",s(f,"title"),"Task"); revalidatePath("/tasks"); revalidatePath("/calendar"); revalidatePath("/");
}
export async function updateTaskStatus(f:FormData){ const actor=await requirePermission(PermissionKey.TASKS_EDIT); const id=s(f,"id"),status=s(f,"status") as any; await requireTaskAccess(id,actor); const t=await db.task.update({where:{id},data:{status}}); await audit("TASK_STATUS",`${t.title}: ${status}`,"Task",id); revalidatePath("/tasks"); revalidatePath("/calendar"); revalidatePath("/"); }
export async function createExpense(f:FormData){ await requirePermission(PermissionKey.EXPENSES_CREATE); const e=await db.expense.create({data:{vendor:s(f,"vendor"),category:s(f,"category"),description:s(f,"description")||null,amountCents:cents(s(f,"amount")),taxCents:cents(s(f,"tax")),status:(s(f,"status")||"DRAFT") as any,receiptUrl:s(f,"receiptUrl")||null}}); await audit("EXPENSE_CREATED",`${e.vendor} expense`,"Expense",e.id); revalidatePath("/expenses"); revalidatePath("/reports"); revalidatePath("/"); }
export async function updateIntegration(f:FormData){ await requirePermission(PermissionKey.INTEGRATIONS_MANAGE); const provider=s(f,"provider"), configuration=s(f,"configuration"); const protectedValue=configuration?encryptSecret(configuration):undefined; await db.integrationSetting.upsert({where:{provider},update:{enabled:f.get("enabled")==="on",...(protectedValue?{encryptedJson:protectedValue}:{})},create:{provider,enabled:f.get("enabled")==="on",encryptedJson:protectedValue||null}}); await audit("INTEGRATION_UPDATED",provider,"IntegrationSetting",provider); revalidatePath("/integrations"); }
export async function updateBusinessSettings(f:FormData){ await requireOwner(); const shared={name:s(f,"name"),email:s(f,"email")||null,phone:s(f,"phone")||null,website:s(f,"website")||null,address1:s(f,"address1")||null,city:s(f,"city")||null,province:s(f,"province")||"BC",postalCode:s(f,"postalCode")||null,taxRate:Number(s(f,"taxRate"))||0,quoteMarkupPercent:Number(s(f,"quoteMarkupPercent"))||13,invoiceTerms:s(f,"invoiceTerms")||null}; await db.businessSetting.upsert({where:{id:"primary"},update:shared,create:{id:"primary",...shared,name:shared.name||"Example 3D Printing"}}); await audit("BUSINESS_SETTINGS_UPDATED","Business settings updated"); revalidatePath("/settings/business"); }

export async function updateCustomer(f:FormData){
  const actor=await requirePermission(PermissionKey.CUSTOMERS_EDIT); const id=s(f,"id");
  await requireCustomerAccess(id,actor);
  const assignment=(actor.role==="OWNER"||actor.role==="ADMIN")?{assignedToId:s(f,"assignedToId")||null}:{};
  await db.customer.update({where:{id},data:{name:s(f,"name"),company:s(f,"company")||null,email:s(f,"email")||null,phone:s(f,"phone")||null,notes:s(f,"notes")||null,...assignment}});
  await audit("CUSTOMER_UPDATED",s(f,"name"),"Customer",id); revalidatePath("/customers");
}
export async function safeDeleteCustomer(f:FormData){
  const actor=await requirePermission(PermissionKey.CUSTOMERS_DELETE); const id=s(f,"id");
  await requireCustomerAccess(id,actor);
  const c=await db.customer.findUnique({where:{id}});
  if(!c) return;
  await db.$transaction(async tx=>{
    await tx.conversation.deleteMany({where:{customerId:id}});
    await tx.payment.deleteMany({where:{customerId:id}});
    await tx.shipment.deleteMany({where:{customerId:id}});
    await tx.productionJob.deleteMany({where:{order:{customerId:id}}});
    await tx.order.deleteMany({where:{customerId:id}});
    await tx.quoteItem.deleteMany({where:{quote:{customerId:id}}});
    await tx.quote.deleteMany({where:{customerId:id}});
    await tx.customerFile.deleteMany({where:{customerId:id}});
    await tx.task.updateMany({where:{customerId:id},data:{customerId:null}});
    await tx.portalAccessToken.deleteMany({where:{customerId:id}});
    await tx.customer.delete({where:{id}});
  });
  await audit("CUSTOMER_DELETED_FULL",`${c.name} and all linked CRM records permanently deleted`,"Customer",id);
  revalidatePath("/customers"); revalidatePath("/"); revalidatePath("/quotes"); revalidatePath("/orders"); revalidatePath("/production"); revalidatePath("/reports"); revalidatePath("/tasks"); revalidatePath("/customer-portal");
}
export async function updateMaterial(f:FormData){
  await requirePermission(PermissionKey.INVENTORY_EDIT); const id=s(f,"id");
  await db.material.update({where:{id},data:{name:s(f,"name"),type:s(f,"type"),colour:s(f,"colour")||null,brand:s(f,"brand")||null,gramsOnHand:Number(s(f,"gramsOnHand"))||0,reorderAtGrams:Number(s(f,"reorderAtGrams"))||0,costPerKgCents:cents(s(f,"costPerKg"))}});
  await audit("MATERIAL_UPDATED",s(f,"name"),"Material",id); revalidatePath("/inventory");
}
export async function deleteMaterial(f:FormData){await requirePermission(PermissionKey.INVENTORY_DELETE);const id=s(f,"id");const m=await db.material.delete({where:{id}});await audit("MATERIAL_DELETED",m.name,"Material",id);revalidatePath("/inventory");}
export async function updateTask(f:FormData){
  const actor=await requirePermission(PermissionKey.TASKS_EDIT); const id=s(f,"id"),due=s(f,"dueAt"),customerId=s(f,"customerId")||null;
  const current=await requireTaskAccess(id,actor);
  if(current.customerId)await requireCustomerAccess(current.customerId,actor);
  if(customerId)await requireCustomerAccess(customerId,actor);
  await db.task.update({where:{id},data:{title:s(f,"title"),description:s(f,"description")||null,priority:s(f,"priority") as any,status:s(f,"status") as any,assignedToId:s(f,"assignedToId")||null,customerId,dueAt:due?new Date(due):null}});
  await audit("TASK_UPDATED",s(f,"title"),"Task",id); revalidatePath("/tasks"); revalidatePath("/calendar"); revalidatePath("/");
}
export async function deleteTask(f:FormData){const actor=await requirePermission(PermissionKey.TASKS_DELETE);const id=s(f,"id");await requireTaskAccess(id,actor);const t=await db.task.delete({where:{id}});await audit("TASK_DELETED",t.title,"Task",id);revalidatePath("/tasks");revalidatePath("/calendar");revalidatePath("/");}
export async function createCalendarEvent(f:FormData){
  const actor=await requirePermission(PermissionKey.TASKS_CREATE);
  const customerId=s(f,"customerId")||null,start=s(f,"startAt"),end=s(f,"endAt");
  if(customerId)await requireCustomerAccess(customerId,actor);
  if(!start)redirect("/calendar?error=start-required");
  const startAt=new Date(start),endAt=end?new Date(end):null;
  if(!Number.isFinite(startAt.getTime())||(endAt&&!Number.isFinite(endAt.getTime())))redirect("/calendar?error=invalid-date");
  const event=await db.calendarEvent.create({data:{
    title:s(f,"title"),description:s(f,"description")||null,startAt,endAt,
    allDay:f.get("allDay")==="on",eventType:s(f,"eventType")||"GENERAL",
    colour:/^#[0-9a-f]{6}$/i.test(s(f,"colour"))?s(f,"colour"):"#6d5dfc",
    customerId,createdById:actor.id,assignedToId:s(f,"assignedToId")||actor.id,
  }});
  await audit("CALENDAR_EVENT_CREATED",event.title,"CalendarEvent",event.id);
  revalidatePath("/calendar");revalidatePath("/");
}
export async function updateCalendarEvent(f:FormData){
  const actor=await requirePermission(PermissionKey.TASKS_EDIT),id=s(f,"id");
  const existing=await db.calendarEvent.findUnique({where:{id}});
  if(!existing)return;
  if(existing.customerId)await requireCustomerAccess(existing.customerId,actor);
  const customerId=s(f,"customerId")||null;if(customerId)await requireCustomerAccess(customerId,actor);
  const startAt=new Date(s(f,"startAt")),end=s(f,"endAt"),endAt=end?new Date(end):null;
  if(!Number.isFinite(startAt.getTime())||(endAt&&!Number.isFinite(endAt.getTime())))redirect("/calendar?error=invalid-date");
  const event=await db.calendarEvent.update({where:{id},data:{
    title:s(f,"title"),description:s(f,"description")||null,startAt,endAt,
    allDay:f.get("allDay")==="on",eventType:s(f,"eventType")||"GENERAL",
    colour:/^#[0-9a-f]{6}$/i.test(s(f,"colour"))?s(f,"colour"):"#6d5dfc",
    customerId,assignedToId:s(f,"assignedToId")||null,
  }});
  await audit("CALENDAR_EVENT_UPDATED",event.title,"CalendarEvent",event.id);
  revalidatePath("/calendar");revalidatePath("/");
}
export async function deleteCalendarEvent(f:FormData){
  const actor=await requirePermission(PermissionKey.TASKS_DELETE),id=s(f,"id");
  const existing=await db.calendarEvent.findUnique({where:{id}});
  if(!existing)return;
  if(existing.customerId)await requireCustomerAccess(existing.customerId,actor);
  await db.calendarEvent.delete({where:{id}});
  await audit("CALENDAR_EVENT_DELETED",existing.title,"CalendarEvent",id);
  revalidatePath("/calendar");revalidatePath("/");
}
export async function updateExpense(f:FormData){
  await requirePermission(PermissionKey.EXPENSES_EDIT); const id=s(f,"id");
  const e=await db.expense.update({where:{id},data:{vendor:s(f,"vendor"),category:s(f,"category"),description:s(f,"description")||null,amountCents:cents(s(f,"amount")),taxCents:cents(s(f,"tax")),status:s(f,"status") as any,receiptUrl:s(f,"receiptUrl")||null}});
  await audit("EXPENSE_UPDATED",`${e.vendor} expense`,"Expense",id); revalidatePath("/expenses"); revalidatePath("/reports"); revalidatePath("/");
}
export async function deleteExpense(f:FormData){await requirePermission(PermissionKey.EXPENSES_DELETE);const id=s(f,"id");const e=await db.expense.delete({where:{id}});await audit("EXPENSE_DELETED",e.vendor,"Expense",id);revalidatePath("/expenses");revalidatePath("/reports");revalidatePath("/");}
export async function updatePrinter(f:FormData){await requirePermission(PermissionKey.PRODUCTION_EDIT);const id=s(f,"id");await db.printer.update({where:{id},data:{name:s(f,"name"),model:s(f,"model")||null,notes:s(f,"notes")||null,active:f.get("active")==="on"}});await audit("PRINTER_UPDATED",s(f,"name"),"Printer",id);revalidatePath("/production");}
export async function deletePrinter(f:FormData){await requirePermission(PermissionKey.PRODUCTION_DELETE);const id=s(f,"id");const count=await db.productionJob.count({where:{printerId:id}});if(count)redirect("/production?error=linked");const p=await db.printer.delete({where:{id}});await audit("PRINTER_DELETED",p.name,"Printer",id);revalidatePath("/production");}
export async function deleteProductionJob(f:FormData){const actor=await requirePermission(PermissionKey.PRODUCTION_DELETE);const id=s(f,"id");const j=await db.productionJob.findUnique({where:{id}});if(!j)return;await requireOrderAccess(j.orderId,actor);if(!["QUEUED","CANCELLED"].includes(j.status))redirect("/production?error=activejob");await db.productionJob.delete({where:{id}});await audit("PRODUCTION_JOB_DELETED",id,"ProductionJob",id);revalidatePath("/production");}
export async function updateQuote(f:FormData){
  const actor=await requirePermission(PermissionKey.QUOTES_EDIT); const id=s(f,"id"),quantity=Math.max(1,Number(s(f,"quantity"))||1);
  await requireQuoteAccess(id,actor); await requireCustomerAccess(s(f,"customerId"),actor);
  const q=await db.quote.findUnique({where:{id},include:{items:true,order:true}}); if(!q)return; if(q.order)redirect("/quotes?error=ordered");
  const material=s(f,"material"),grams=Number(s(f,"estimatedGrams"))||0,minutes=Number(s(f,"estimatedMinutes"))||0;
  const catalog=materialRateCatalog(),settings=await db.businessSetting.findUnique({where:{id:"primary"}});
  const markup=Number(s(f,"markupPercent"))||settings?.quoteMarkupPercent||catalog.defaultMarkupPercent;
  const pricing=calculateQuotePricing({
    costPerKgCents:material?await currentMaterialCostPerKg(material):0,
    gramsPerItem:grams,minutesPerItem:minutes,quantity,
    wasteMultiplier:materialWasteMultiplier(material),
    hourlyRateCents:cents(s(f,"machineHourlyRate"))||cents(String(catalog.defaultMachineHourlyRateCad)),
    setupFeeCents:cents(s(f,"setupFee"))||cents(String(catalog.defaultSetupFeeCad)),
    markupPercent:markup,minimumQuoteCents:cents(String(catalog.minimumQuoteCad)),
  });
  const pricingMode=s(f,"pricingMode")==="MANUAL"?"MANUAL":"AUTO";
  const manualUnit=cents(s(f,"unitPrice"));
  if(pricingMode==="MANUAL"&&!manualUnit)redirect("/quotes?error=manual-price");
  if(pricingMode==="MANUAL"&&manualUnit<pricing.baseCostPerItemCents&&f.get("allowBelowCost")!=="on")redirect("/quotes?error=below-cost");
  const unit=pricingMode==="MANUAL"?manualUnit:pricing.automaticUnitPriceCents;
  const subtotal=quantity*unit,tax=Math.round(subtotal*(Number(s(f,"taxRate"))||0)/100);
  const itemData={description:s(f,"description"),quantity,material:material||null,colour:s(f,"colour")||null,estimatedGrams:grams||null,estimatedMinutes:minutes||null,baseCostCents:pricing.baseCostPerItemCents,markupPercent:markup,priceSource:pricingMode==="MANUAL"?"MANUAL_OVERRIDE":"AUTO_CONFIG",unitPriceCents:unit,lineTotalCents:subtotal};
  await db.$transaction([db.quote.update({where:{id},data:{customerId:s(f,"customerId"),notes:s(f,"notes")||null,status:s(f,"status") as any,subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax}}),q.items[0]?db.quoteItem.update({where:{id:q.items[0].id},data:itemData}):db.quoteItem.create({data:{quoteId:id,...itemData}})]);
  await audit("QUOTE_UPDATED",q.number,"Quote",id); revalidatePath("/quotes");
}
export async function deleteQuote(f:FormData){const actor=await requirePermission(PermissionKey.QUOTES_DELETE);const id=s(f,"id");await requireQuoteAccess(id,actor);const q=await db.quote.findUnique({where:{id},include:{order:true}});if(!q)return;if(q.order)redirect("/quotes?error=ordered");await db.quote.delete({where:{id}});await audit("QUOTE_DELETED",q.number,"Quote",id);revalidatePath("/quotes");}
export async function updateOrder(f:FormData){const actor=await requirePermission(PermissionKey.ORDERS_EDIT);const id=s(f,"id");await requireOrderAccess(id,actor);const o=await db.order.update({where:{id},data:{status:s(f,"status") as any,dueDate:s(f,"dueDate")?new Date(s(f,"dueDate")):null,totalCents:cents(s(f,"total"))}});await audit("ORDER_UPDATED",o.number,"Order",id);revalidatePath("/orders");revalidatePath("/calendar");revalidatePath("/");}
export async function deleteOrder(f:FormData){const actor=await requirePermission(PermissionKey.ORDERS_DELETE);const id=s(f,"id");await requireOrderAccess(id,actor);const o=await db.order.findUnique({where:{id},include:{payments:true,shipments:true}});if(!o)return;if(o.payments.length||o.shipments.length)redirect("/orders?error=financial");await db.order.delete({where:{id}});await audit("ORDER_DELETED",o.number,"Order",id);revalidatePath("/orders");}
export async function deletePayment(f:FormData){const actor=await requirePermission(PermissionKey.ORDERS_DELETE);const id=s(f,"id");const p=await db.payment.findUnique({where:{id},include:{order:true}});if(!p)return;await requireOrderAccess(p.orderId,actor);await db.$transaction([db.payment.delete({where:{id}}),db.order.update({where:{id:p.orderId},data:{paidCents:{decrement:p.amountCents}}})]);await audit("PAYMENT_DELETED",`${p.amountCents} cents`,"Payment",id);revalidatePath("/orders");revalidatePath("/reports");}
export async function deleteShipment(f:FormData){const actor=await requirePermission(PermissionKey.ORDERS_DELETE);const id=s(f,"id");const existing=await db.shipment.findUnique({where:{id},select:{customerId:true}});if(!existing)return;await requireCustomerAccess(existing.customerId,actor);const x=await db.shipment.delete({where:{id}});await audit("SHIPMENT_DELETED",x.trackingNumber||x.id,"Shipment",id);revalidatePath("/orders");}
export async function uploadCustomerFile(f:FormData){
  const actor=await requirePermission(PermissionKey.UPLOADS_CREATE);
  const customerId=s(f,"customerId");
  await requireCustomerAccess(customerId,actor);
  const incoming=f.get("file");
  if(!(incoming instanceof File)||!incoming.size) redirect("/uploads?error=missing-file");
  if(incoming.size>MAX_UPLOAD_BYTES) redirect("/uploads?error=file-too-large");
  const ext=extensionFor(incoming.name);
  if(!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) redirect("/uploads?error=file-type");
  const storageKey=path.posix.join(customerId,`${randomBytes(16).toString("hex")}${ext}`);
  const target=safeStoragePath(storageKey);
  try{
    await mkdir(/*turbopackIgnore: true*/ path.dirname(target),{recursive:true});
    await writeFile(/*turbopackIgnore: true*/ target,Buffer.from(await incoming.arrayBuffer()),{flag:"wx"});
  }catch(error){
    console.error("Unable to write uploaded file",error);
    redirect("/uploads?error=storage");
  }
  try{
    const record=await db.customerFile.create({data:{
      customerId,originalName:incoming.name.slice(0,240),storageKey,
      mimeType:incoming.type||null,bytes:incoming.size,fileType:ext.slice(1).toUpperCase(),
    }});
    await audit("FILE_UPLOADED",record.originalName,"CustomerFile",record.id);
  }catch(error){
    await rm(/*turbopackIgnore: true*/ target,{force:true}).catch(()=>{});
    console.error("Unable to save uploaded file record",error);
    redirect("/uploads?error=database");
  }
  revalidatePath("/uploads");
  redirect("/uploads?success=uploaded");
}

export async function deleteCustomerFile(f:FormData){
  const actor=await requirePermission(PermissionKey.UPLOADS_DELETE);
  const id=s(f,"id");
  const existing=await db.customerFile.findUnique({where:{id},select:{customerId:true,storageKey:true,originalName:true}});
  if(!existing)return;
  await requireCustomerAccess(existing.customerId,actor);
  await db.customerFile.delete({where:{id}});
  await rm(/*turbopackIgnore: true*/ safeStoragePath(existing.storageKey),{force:true}).catch(()=>{});
  await audit("FILE_DELETED",existing.originalName,"CustomerFile",id);
  revalidatePath("/uploads");
}

export async function sliceCustomerFileAction(f:FormData){
  const actor=await requirePermission(PermissionKey.UPLOADS_EDIT);
  if(!(await userAllows(actor.id,actor.role,PermissionKey.PRICING_VIEW)))redirect("/uploads?error=pricing-permission");
  const id=s(f,"id"),profileKey=s(f,"profileKey"),material=s(f,"material"),colour=s(f,"colour"),quantity=Math.min(100,Math.max(1,Number(s(f,"quantity"))||1));
  const file=await db.customerFile.findUnique({where:{id}});
  if(!file)return;
  await requireCustomerAccess(file.customerId,actor);
  if(!["STL","3MF"].includes(file.fileType))redirect(`/uploads?view=${id}&error=slicer-type`);
  if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(profileKey)||!material)redirect(`/uploads?view=${id}&error=slicer-input`);
  try{
    const bytes=await readFile(safeStoragePath(file.storageKey));
    const estimate=await requestBambuSlice({bytes,fileName:file.originalName,profileKey,quantity});
    const previous=file.analysisJson&&typeof file.analysisJson==="object"&&!Array.isArray(file.analysisJson)?file.analysisJson as Record<string,unknown>:{};
    await db.customerFile.update({where:{id},data:{analysisJson:{...previous,sliceEstimate:{...estimate,material,colour:colour||null,quantity}}}});
    await audit("FILE_SLICED",`${file.originalName} sliced with ${profileKey}`,"CustomerFile",id);
    revalidatePath("/uploads");
  }catch(error){
    console.error("Bambu slicing failed",error);
    redirect(`/uploads?view=${id}&error=slicer`);
  }
  redirect(`/uploads?view=${id}&success=sliced`);
}

export async function createQuoteFromSliceAction(f:FormData){
  const actor=await requirePermission(PermissionKey.QUOTES_CREATE);
  const id=s(f,"id");
  const file=await db.customerFile.findUnique({where:{id}});
  if(!file)return;
  await requireCustomerAccess(file.customerId,actor);
  const analysis=file.analysisJson&&typeof file.analysisJson==="object"&&!Array.isArray(file.analysisJson)?file.analysisJson as Record<string,unknown>:{};
  const estimate=analysis.sliceEstimate&&typeof analysis.sliceEstimate==="object"&&!Array.isArray(analysis.sliceEstimate)?analysis.sliceEstimate as Record<string,unknown>:null;
  if(!estimate||estimate.status!=="SLICED")redirect(`/uploads?view=${id}&error=no-slice`);
  const quantity=Math.max(1,Number(estimate.quantity)||1);
  const totalGrams=Math.max(0,Number(estimate.materialGrams)||0);
  const totalMinutes=Math.max(0,Number(estimate.totalTimeSeconds)||0)/60;
  const material=String(estimate.material||"").trim();
  if(!material||!totalGrams||!totalMinutes)redirect(`/uploads?view=${id}&error=no-slice`);
  const [settings,marketPricing]=await Promise.all([
    db.businessSetting.findUnique({where:{id:"primary"}}),
    currentMaterialPricing(material),
  ]);
  const catalog=materialRateCatalog();
  const pricing=calculateQuotePricing({
    costPerKgCents:marketPricing.costPerKgCents,gramsPerItem:totalGrams,minutesPerItem:totalMinutes,quantity:1,
    wasteMultiplier:materialWasteMultiplier(material),
    hourlyRateCents:Math.round(catalog.defaultMachineHourlyRateCad*100),
    setupFeeCents:Math.round(catalog.defaultSetupFeeCad*100),
    markupPercent:settings?.quoteMarkupPercent??catalog.defaultMarkupPercent,
    minimumQuoteCents:Math.round(catalog.minimumQuoteCad*100),
  });
  const unitPriceCents=Math.ceil(pricing.automaticJobTotalCents/quantity);
  const subtotalCents=unitPriceCents*quantity;
  const taxCents=Math.round(subtotalCents*(settings?.taxRate||0)/100);
  const count=await db.quote.count();
  const number=`${settings?.quotePrefix||"Q"}-${new Date().getFullYear()}-${String(count+1).padStart(4,"0")}`;
  const quote=await db.quote.create({data:{
    number,customerId:file.customerId,status:"DRAFT",currency:settings?.currency||"CAD",
    notes:`Created from Bambu Studio slice of ${file.originalName}. Review before sending.`,
    subtotalCents,taxCents,totalCents:subtotalCents+taxCents,
    items:{create:{
      customerFileId:file.id,description:s(f,"description")||`3D print: ${file.originalName}`,
      quantity,material,colour:String(estimate.colour||"")||null,
      estimatedGrams:totalGrams/quantity,estimatedMinutes:totalMinutes/quantity,
      baseCostCents:Math.ceil(pricing.jobBaseCents/quantity),
      markupPercent:settings?.quoteMarkupPercent??catalog.defaultMarkupPercent,
      priceSource:`BAMBU_STUDIO:${String(estimate.profileKey||"profile").slice(0,45)}|${marketPricing.basis}:${marketPricing.source}`.slice(0,180),
      unitPriceCents,lineTotalCents:subtotalCents,
    }},
  }});
  await audit("QUOTE_CREATED_FROM_SLICE",`${quote.number} from ${file.originalName}`,"Quote",quote.id);
  revalidatePath("/quotes");revalidatePath("/uploads");
  redirect(`/quotes?success=created-from-slice`);
}

export async function reviewAiActionAction(f:FormData){
  const actor=await requirePermission(PermissionKey.AI_ACTIONS_APPROVE);
  const id=s(f,"id"), decision=s(f,"decision");
  const proposal=await db.aiActionProposal.findUnique({where:{id}});
  if(!proposal||proposal.status!=="PENDING")redirect("/assistant?error=proposal-state");
  if(decision==="reject"){
    await db.aiActionProposal.update({where:{id},data:{status:"REJECTED",reviewedById:actor.id,reviewedAt:new Date(),resultSummary:"Rejected by reviewer"}});
    await audit("AI_ACTION_REJECTED",proposal.title,"AiActionProposal",id);
    revalidatePath("/assistant");
    return;
  }
  const payload=(proposal.payload&&typeof proposal.payload==="object"&&!Array.isArray(proposal.payload)?proposal.payload:{}) as Record<string,unknown>;
  try{
    let resultSummary="";
    if(proposal.actionType==="CREATE_TASK"){
      if(!(await userAllows(actor.id,actor.role,PermissionKey.TASKS_CREATE)))redirect("/assistant?error=proposal-permission");
      const customerId=typeof payload.customerId==="string"&&payload.customerId?payload.customerId:null;
      if(customerId)await requireCustomerAccess(customerId,actor);
      const priority=["LOW","NORMAL","HIGH","URGENT"].includes(String(payload.priority))?String(payload.priority):"NORMAL";
      const task=await db.task.create({data:{
        title:String(payload.title||proposal.title).slice(0,180),
        description:payload.description?String(payload.description).slice(0,4000):proposal.description,
        priority:priority as any,status:"OPEN",customerId,createdById:actor.id,
      }});
      resultSummary=`Task created: ${task.title}`;
      revalidatePath("/tasks");
    }else if(proposal.actionType==="UPDATE_ORDER_STATUS"){
      if(!(await userAllows(actor.id,actor.role,PermissionKey.ORDERS_EDIT)))redirect("/assistant?error=proposal-permission");
      const orderId=String(payload.orderId||"");
      await requireOrderAccess(orderId,actor);
      const status=String(payload.status||"").toUpperCase();
      if(!["AWAITING_PAYMENT","PAID","QUEUED","PRINTING","QUALITY_CHECK","READY","SHIPPED","COMPLETED","CANCELLED"].includes(status))throw new Error("Invalid order status");
      const order=await db.order.update({where:{id:orderId},data:{status:status as any}});
      resultSummary=`${order.number} changed to ${status}`;
      revalidatePath("/orders");revalidatePath("/production");
    }else{
      throw new Error("Unsupported action");
    }
    await db.aiActionProposal.update({where:{id},data:{status:"COMPLETED",reviewedById:actor.id,reviewedAt:new Date(),resultSummary}});
    await audit("AI_ACTION_APPROVED",resultSummary,"AiActionProposal",id);
  }catch(error){
    await db.aiActionProposal.update({where:{id},data:{status:"FAILED",reviewedById:actor.id,reviewedAt:new Date(),resultSummary:error instanceof Error?error.message:"Action failed"}}).catch(()=>{});
    await audit("AI_ACTION_FAILED",proposal.title,"AiActionProposal",id);
  }
  revalidatePath("/assistant");
}

export async function saveAiSettingsAction(f:FormData){
  await requireOwner();
  const enabled=f.get("enabled")==="on";
  const provider=(["OPENAI","OPENROUTER","CUSTOM"].includes(s(f,"provider"))?s(f,"provider"):"OPENAI") as AiConfiguration["provider"];
  const existing=await db.integrationSetting.findUnique({where:{provider:"AI_ASSISTANT"}});
  let old:Partial<AiConfiguration>={};
  if(existing?.encryptedJson){
    try{old=JSON.parse(decryptSecret(existing.encryptedJson));}catch{}
  }
  const apiKey=s(f,"apiKey")||old.apiKey||"";
  const model=s(f,"model")||old.model||"";
  const baseUrl=provider==="CUSTOM"?(s(f,"baseUrl")||old.baseUrl||defaultBaseUrl(provider)):defaultBaseUrl(provider);
  const zeroCostOnly=provider==="OPENROUTER"&&f.get("zeroCostOnly")==="on";
  if(enabled&&(!apiKey||!model))redirect("/settings/ai?error=incomplete");
  if(enabled&&zeroCostOnly&&!isZeroCostOpenRouterModel(model))redirect("/settings/ai?error=paid-model");
  const config:AiConfiguration={
    provider,apiKey,model,baseUrl,
    imageModel:provider==="OPENAI"?(s(f,"imageModel")||old.imageModel||"gpt-image-2"):"gpt-image-2",
    systemPrompt:s(f,"systemPrompt")||"You are TITAN AI, a concise assistant for a Canadian 3D-printing business. Never invent prices, weights, print times, customer facts, or completed actions.",
    zeroCostOnly,
    customerPortalEnabled:f.get("customerPortalEnabled")==="on",
  };
  try{
    const encryptedJson=apiKey&&model?encryptSecret(JSON.stringify(config)):existing?.encryptedJson||null;
    await db.integrationSetting.upsert({
      where:{provider:"AI_ASSISTANT"},
      update:{enabled,encryptedJson},
      create:{provider:"AI_ASSISTANT",enabled,encryptedJson},
    });
  }catch(error){
    console.error("Unable to save shared AI settings",error);
    redirect("/settings/ai?error=save");
  }
  await audit("AI_SETTINGS_UPDATED",`${provider} AI assistant configured`,"IntegrationSetting","AI_ASSISTANT");
  revalidatePath("/settings/ai");
  revalidatePath("/assistant/settings");
  revalidatePath("/assistant");
  redirect("/settings/ai?success=saved");
}

export async function testAiSettingsAction(){
  await requireOwner();
  try{
    const config=await loadAiConfiguration();
    await createAiReply(config,"Reply with exactly: TITAN AI connection successful.",[{role:"user",content:"Test the connection."}]);
  }catch{
    redirect("/settings/ai?error=connection");
  }
  redirect("/settings/ai?success=connection");
}

export async function saveOwnAiSettingsAction(f:FormData){
  const actor=await requirePermission(PermissionKey.AI_CHAT_VIEW);
  const useServerConfig=f.get("useServerConfig")==="on";
  if(useServerConfig){
    const shared=await db.integrationSetting.findUnique({where:{provider:"AI_ASSISTANT"}});
    if(!shared?.enabled||!shared.encryptedJson)redirect("/assistant/settings?error=shared-disabled");
    try{
      const value=JSON.parse(decryptSecret(shared.encryptedJson)) as Partial<AiConfiguration>;
      if(!value.provider||!value.apiKey||!value.model||!value.baseUrl)redirect("/assistant/settings?error=shared-incomplete");
    }catch{
      redirect("/assistant/settings?error=shared-incomplete");
    }
  }
  const existing=await db.aiUserSetting.findUnique({where:{userId:actor.id}});
  let old:Partial<AiConfiguration>={};
  if(existing?.encryptedJson){
    try{old=JSON.parse(decryptSecret(existing.encryptedJson));}catch{}
  }
  let encryptedJson=existing?.encryptedJson||null;
  if(!useServerConfig){
    const provider=(["OPENAI","OPENROUTER"].includes(s(f,"provider"))?s(f,"provider"):"OPENAI") as AiConfiguration["provider"];
    const apiKey=s(f,"apiKey")||old.apiKey||"";
    const model=s(f,"model")||old.model||"";
    if(!apiKey||!model)redirect("/assistant/settings?error=incomplete");
    const zeroCostOnly=provider==="OPENROUTER"&&f.get("zeroCostOnly")==="on";
    if(zeroCostOnly&&!isZeroCostOpenRouterModel(model))redirect("/assistant/settings?error=paid-model");
    const config:AiConfiguration={
      provider,apiKey,model,
      baseUrl:defaultBaseUrl(provider),
      imageModel:s(f,"imageModel")||old.imageModel||"gpt-image-2",
      systemPrompt:s(f,"systemPrompt")||old.systemPrompt||"",
      zeroCostOnly,
    };
    encryptedJson=encryptSecret(JSON.stringify(config));
  }
  try{
    await db.aiUserSetting.upsert({
      where:{userId:actor.id},
      update:{useServerConfig,encryptedJson},
      create:{userId:actor.id,useServerConfig,encryptedJson},
    });
  }catch(error){
    console.error("Unable to save personal AI settings",error);
    redirect("/assistant/settings?error=save");
  }
  await audit("AI_PERSONAL_SETTINGS_UPDATED",useServerConfig?"Using shared AI":"Using personal AI","AiUserSetting",actor.id);
  revalidatePath("/assistant/settings");
  revalidatePath("/assistant");
  redirect("/assistant/settings?success=saved");
}

export async function testOwnAiSettingsAction(){
  const actor=await requirePermission(PermissionKey.AI_CHAT_VIEW);
  try{
    const config=await loadAiConfiguration(actor.id);
    await createAiReply(config,"Reply with exactly: TITAN AI connection successful.",[{role:"user",content:"Test the connection."}]);
  }catch{
    redirect("/assistant/settings?error=connection");
  }
  redirect("/assistant/settings?success=connection");
}

export async function startTitanUpdateAction(){
  await requireOwner();
  const result=await startTitanUpdate();
  if(result.state==="unavailable")redirect(`/settings/updates?error=${encodeURIComponent(result.message||"Updater is unavailable")}`);
  await audit("TITAN_UPDATE_STARTED","OWNER started a GitHub update","System","TITAN");
  redirect("/settings/updates?started=1");
}

export async function deleteAiConversationAction(f:FormData){
  const actor=await requirePermission(PermissionKey.AI_CHAT_DELETE);
  const id=s(f,"id");
  await db.aiConversation.deleteMany({where:{id,userId:actor.id}});
  await audit("AI_CONVERSATION_DELETED","AI conversation deleted","AiConversation",id);
  revalidatePath("/assistant");
  redirect("/assistant");
}

export async function setUserPermissionAction(f:FormData){
  await requireOwner();
  const userId=s(f,"userId"), permission=s(f,"permission") as PermissionKey, mode=s(f,"mode");
  if(!Object.values(PermissionKey).includes(permission)) return;
  if(mode==="default") await db.userPermission.deleteMany({where:{userId,permission}});
  else await db.userPermission.upsert({where:{userId_permission:{userId,permission}},update:{allowed:mode==="allow"},create:{userId,permission,allowed:mode==="allow"}});
  await audit("USER_PERMISSION_UPDATED",`${permission}: ${mode}`,"User",userId);
  revalidatePath("/settings/permissions");
}

export async function setUserFeatureAccessAction(f:FormData){
  const actor=await requireOwner();
  const userId=s(f,"userId"), mode=s(f,"featureAccessMode")==="ALL"?"ALL":"ASSIGNED";
  const target=await db.user.findUnique({where:{id:userId},select:{role:true}});
  if(!target || target.role==="OWNER" || userId===actor.id) return;
  const valid=new Set(Object.values(FeatureCategory));
  const categories=f.getAll("categories").map(String).filter((value):value is FeatureCategory=>valid.has(value as FeatureCategory));
  await db.$transaction(async tx=>{
    await tx.user.update({where:{id:userId},data:{featureAccessMode:mode}});
    await tx.userFeatureCategory.deleteMany({where:{userId}});
    if(mode==="ASSIGNED"&&categories.length){
      await tx.userFeatureCategory.createMany({data:categories.map(category=>({userId,category})),skipDuplicates:true});
    }
  });
  await audit("USER_FEATURE_ACCESS_UPDATED",`${mode}: ${categories.join(", ")||"none"}`,"User",userId);
  revalidatePath("/settings/permissions");
  revalidatePath("/settings/users");
}

export async function disconnectEmailAccountAction(f:FormData){
  await requirePermission(PermissionKey.EMAIL_DELETE);
  const user=await requireUser(), id=s(f,"id");
  const account=await db.emailAccount.findUnique({where:{id}});
  if(!account || (account.ownerId!==user.id && user.role!=="OWNER")) return;
  await db.emailAccount.delete({where:{id}});
  await audit("EMAIL_ACCOUNT_DISCONNECTED",account.emailAddress,"EmailAccount",id);
  revalidatePath("/messages"); revalidatePath("/settings/email");
}

export async function deleteEmailMessageAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_DELETE);
  const accountId=s(f,"accountId"),messageId=s(f,"messageId");
  const account=await db.emailAccount.findUnique({where:{id:accountId},include:{access:{where:{userId:user.id}}}});
  if(!account||(account.ownerId!==user.id&&!(account.isTeamMailbox&&account.access.some((row)=>row.canRead))))redirect("/messages?error=delete-access");
  try{
    const result=await deleteMailboxMessage(account,messageId);
    await audit("EMAIL_MESSAGE_DELETED",`${account.emailAddress}: message moved to ${result.destination}`,"EmailAccount",account.id);
  }catch(error){
    console.error("Unable to delete mailbox message",error);
    redirect(`/messages?account=${encodeURIComponent(accountId)}&error=delete`);
  }
  redirect(`/messages?account=${encodeURIComponent(accountId)}&deleted=1`);
}

export async function saveEmailAccountAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_EDIT);
  const id=s(f,"id");
  const emailAddress=s(f,"emailAddress").toLowerCase();
  const smtpHost=s(f,"smtpHost"), imapHost=s(f,"imapHost");
  const smtpPort=Number(s(f,"smtpPort")), imapPort=Number(s(f,"imapPort"));
  if(!emailAddress.includes("@")||!smtpHost||smtpPort<1||smtpPort>65535)redirect("/settings/email?error=invalid");
  const current=id?await db.emailAccount.findUnique({where:{id}}):null;
  if(id&&(!current||current.ownerId!==user.id))redirect("/settings/email?error=access");
  const existing=await db.emailAccount.findUnique({where:{provider_emailAddress:{provider:"SMTP",emailAddress}}});
  if(existing&&existing.id!==id)redirect("/settings/email?error=duplicate");
  const smtpPassword=s(f,"smtpPassword"), imapPassword=s(f,"imapPassword");
  if(!current&&!smtpPassword)redirect("/settings/email?error=password");
  const imapEnabled=f.get("imapEnabled")==="on";
  if(imapEnabled&&(!imapHost||imapPort<1||imapPort>65535))redirect("/settings/email?error=invalid");
  const data={
    ownerId:user.id,
    provider:"SMTP" as const,
    providerPreset:s(f,"providerPreset")||"CUSTOM",
    emailAddress,
    displayName:s(f,"displayName")||null,
    smtpHost,
    smtpPort,
    smtpSecure:f.get("smtpSecure")==="on",
    smtpUsername:s(f,"smtpUsername")||emailAddress,
    ...(smtpPassword?{encryptedSmtpPassword:encryptSecret(smtpPassword)}:{}),
    imapEnabled,
    imapHost:imapEnabled?imapHost:null,
    imapPort:imapEnabled?imapPort:null,
    imapSecure:f.get("imapSecure")==="on",
    imapUsername:imapEnabled?(s(f,"imapUsername")||emailAddress):null,
    ...(imapPassword?{encryptedImapPassword:encryptSecret(imapPassword)}:(!current&&smtpPassword?{encryptedImapPassword:encryptSecret(smtpPassword)}:{})),
    replyTo:s(f,"replyTo")||null,
    signature:s(f,"signature")||null,
    allowSelfSigned:f.get("allowSelfSigned")==="on",
    active:true,
  };
  const account=current
    ?await db.emailAccount.update({where:{id:current.id},data})
    :await db.emailAccount.create({data});
  await audit(current?"EMAIL_ACCOUNT_UPDATED":"EMAIL_ACCOUNT_CONNECTED",account.emailAddress,"EmailAccount",account.id);
  revalidatePath("/messages"); revalidatePath("/settings/email");
  redirect(`/settings/email?${current?"updated":"connected"}=1`);
}

export async function testEmailAccountAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_EDIT);
  const id=s(f,"id");
  const account=await db.emailAccount.findUnique({where:{id}});
  if(!account||account.ownerId!==user.id)redirect("/settings/email?error=access");
  let ok=false;
  try{
    await testEmailAccount(account);
    await db.emailAccount.update({where:{id},data:{active:true,lastSyncAt:new Date()}});
    await audit("EMAIL_ACCOUNT_TESTED",`${account.emailAddress}: connection successful`,"EmailAccount",id);
    ok=true;
  }catch(error){
    await audit("EMAIL_ACCOUNT_TEST_FAILED",`${account.emailAddress}: ${error instanceof Error?error.message:"connection failed"}`,"EmailAccount",id);
  }
  revalidatePath("/settings/email");
  redirect(`/settings/email?test=${ok?"success":"failed"}&account=${encodeURIComponent(id)}`);
}

export async function sendEmailAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_CREATE);
  const accountId=s(f,"accountId");
  const account=await db.emailAccount.findUnique({where:{id:accountId},include:{access:{where:{userId:user.id}}}});
  const canSend=account&&(account.ownerId===user.id||(account.isTeamMailbox&&account.access.some((row)=>row.canSend)));
  if(!account||!canSend)redirect("/messages?error=send-access");
  const to=s(f,"to"),cc=s(f,"cc"),subject=s(f,"subject"),body=s(f,"body");
  if(!to||!subject||!body)redirect(`/messages?account=${encodeURIComponent(accountId)}&error=compose`);
  let sent=false;
  try{
    await sendMailboxMessage(account,{to,cc:cc||undefined,subject,text:body});
    await audit("EMAIL_SENT",`${account.emailAddress} → ${to}: ${subject}`,"EmailAccount",account.id);
    sent=true;
  }catch(error){
    await audit("EMAIL_SEND_FAILED",`${account.emailAddress}: ${error instanceof Error?error.message:"send failed"}`,"EmailAccount",account.id);
  }
  redirect(`/messages?account=${encodeURIComponent(accountId)}&${sent?"sent=1":"error=send"}`);
}

async function readableMailbox(accountId:string,user:{id:string;role:string}){
  const account=await db.emailAccount.findUnique({where:{id:accountId},include:{access:{where:{userId:user.id}}}});
  if(!account||(account.ownerId!==user.id&&!(account.isTeamMailbox&&account.access.some((row)=>row.canRead)))) return null;
  return account;
}

export async function saveEmailQuoteSettingsAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_EDIT);
  const id=s(f,"id");
  const account=await db.emailAccount.findUnique({where:{id}});
  if(!account||account.ownerId!==user.id)redirect("/settings/email?error=access");
  const quoteForwardTo=s(f,"quoteForwardTo").toLowerCase();
  if(quoteForwardTo&&!quoteForwardTo.includes("@"))redirect(`/settings/email?error=forward&account=${encodeURIComponent(id)}`);
  await db.emailAccount.update({where:{id},data:{
    quoteScanEnabled:f.get("quoteScanEnabled")==="on",
    quoteForwardTo:quoteForwardTo||null,
  }});
  await audit("EMAIL_QUOTE_SETTINGS_UPDATED",account.emailAddress,"EmailAccount",id);
  revalidatePath("/settings/email"); revalidatePath("/messages");
  redirect(`/settings/email?quoteSettings=1&account=${encodeURIComponent(id)}`);
}

async function saveMessageAsQuoteDraft(account:Awaited<ReturnType<typeof readableMailbox>>,messageId:string,userId:string){
  if(!account) return {created:false,forwarded:false};
  const existing=await db.emailQuoteDraft.findUnique({where:{emailAccountId_providerMessageId:{emailAccountId:account.id,providerMessageId:messageId}}});
  if(existing) return {created:false,forwarded:false};
  const message=await readMailboxMessage(account,messageId);
  const parsed=parseQuoteRequest(message);
  if(!parsed.likelyQuoteRequest||!parsed.senderEmail||parsed.senderEmail===account.emailAddress.toLowerCase())return {created:false,forwarded:false};
  const draft=await db.emailQuoteDraft.create({data:{
    ownerId:userId,emailAccountId:account.id,providerMessageId:messageId,
    senderName:parsed.senderName,senderEmail:parsed.senderEmail,subject:message.subject,
    sourceText:message.text.slice(0,12000),description:parsed.description,quantity:parsed.quantity,
    material:parsed.material,colour:parsed.colour,estimatedGrams:parsed.estimatedGrams,
    estimatedMinutes:parsed.estimatedMinutes,missingFields:parsed.missingFields,
    confidence:parsed.confidence,status:parsed.missingFields.length?"NEEDS_REVIEW":"READY",
  }});
  let forwarded=false;
  if(account.quoteForwardTo){
    const review=quoteReviewEmail(account,{draftId:draft.id,subject:draft.subject,senderEmail:draft.senderEmail,
      description:draft.description,quantity:draft.quantity,material:draft.material,colour:draft.colour,
      estimatedGrams:draft.estimatedGrams,estimatedMinutes:draft.estimatedMinutes,missingFields:draft.missingFields});
    try{
      await sendMailboxMessage(account,review);
      await db.emailQuoteDraft.update({where:{id:draft.id},data:{forwardedAt:new Date()}});
      forwarded=true;
    }catch{}
  }
  return {created:true,forwarded};
}

export async function scanEmailForQuoteAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_VIEW);
  if(!(await userAllows(user.id,user.role,PermissionKey.QUOTES_CREATE)))redirect("/?error=forbidden");
  const accountId=s(f,"accountId"),messageId=s(f,"messageId");
  const account=await readableMailbox(accountId,user);
  if(!account)redirect("/messages?error=access");
  const result=await saveMessageAsQuoteDraft(account,messageId,user.id);
  await audit("EMAIL_QUOTE_SCANNED",`${account.emailAddress}: ${messageId}`,"EmailAccount",account.id);
  revalidatePath("/messages/quote-drafts");
  redirect(`/messages/quote-drafts?${result.created?"created=1":"duplicate=1"}`);
}

export async function scanMailboxForQuotesAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_VIEW);
  if(!(await userAllows(user.id,user.role,PermissionKey.QUOTES_CREATE)))redirect("/?error=forbidden");
  const accountId=s(f,"accountId");
  const account=await readableMailbox(accountId,user);
  if(!account)redirect("/messages?error=access");
  let created=0,forwarded=0;
  const messages=await listMailbox(account);
  for(const message of messages){
    try{
      const result=await saveMessageAsQuoteDraft(account,message.id,user.id);
      if(result.created)created++;
      if(result.forwarded)forwarded++;
    }catch{}
  }
  await db.emailAccount.update({where:{id:account.id},data:{lastSyncAt:new Date()}});
  await audit("EMAIL_INBOX_QUOTE_SCAN",`${account.emailAddress}: ${created} drafts, ${forwarded} forwarded`,"EmailAccount",account.id);
  revalidatePath("/messages"); revalidatePath("/messages/quote-drafts");
  redirect(`/messages/quote-drafts?scanned=${created}&forwarded=${forwarded}`);
}

export async function updateEmailQuoteDraftAction(f:FormData){
  const user=await requirePermission(PermissionKey.QUOTES_EDIT);
  const id=s(f,"id");
  const draft=await db.emailQuoteDraft.findUnique({where:{id}});
  if(!draft||draft.ownerId!==user.id)redirect("/messages/quote-drafts?error=access");
  const material=s(f,"material")||null,grams=Number(s(f,"estimatedGrams"))||null,minutes=Number(s(f,"estimatedMinutes"))||null;
  const missingFields=[...(!material?["material"]:[]),...(!grams?["estimated grams per item"]:[]),...(!minutes?["estimated print minutes per item"]:[])];
  await db.emailQuoteDraft.update({where:{id},data:{
    senderName:s(f,"senderName")||null,senderEmail:s(f,"senderEmail").toLowerCase(),
    description:s(f,"description"),quantity:Math.max(1,Number(s(f,"quantity"))||1),
    material,colour:s(f,"colour")||null,estimatedGrams:grams,estimatedMinutes:minutes,
    missingFields,status:missingFields.length?"NEEDS_REVIEW":"READY",
  }});
  await audit("EMAIL_QUOTE_DRAFT_UPDATED",draft.subject,"EmailQuoteDraft",id);
  revalidatePath("/messages/quote-drafts");
  redirect("/messages/quote-drafts?saved=1");
}

async function createQuoteFromEmailDraft(id:string,user:{id:string;role:any;customerAccessMode:any},sendToCustomer:boolean){
  const draft=await db.emailQuoteDraft.findUnique({where:{id},include:{emailAccount:{include:{access:{where:{userId:user.id}}}},quote:true}});
  if(!draft||draft.ownerId!==user.id)redirect("/messages/quote-drafts?error=access");
  if(draft.quote)return draft;
  if(!draft.material||!draft.estimatedGrams||!draft.estimatedMinutes)redirect("/messages/quote-drafts?error=missing");
  if(!(await userAllows(user.id,user.role,PermissionKey.CUSTOMERS_CREATE)))redirect("/?error=forbidden");
  if(sendToCustomer&&!(await userAllows(user.id,user.role,PermissionKey.EMAIL_CREATE)))redirect("/?error=forbidden");
  let customer=await db.customer.findFirst({where:{email:{equals:draft.senderEmail,mode:"insensitive"},...customerWhere(user)}});
  if(!customer)customer=await db.customer.create({data:{
    name:draft.senderName||draft.senderEmail.split("@")[0],email:draft.senderEmail,assignedToId:user.id,
    notes:`Created from email quote request: ${draft.subject}`,
  }});
  const settings=await db.businessSetting.findUnique({where:{id:"primary"}});
  const catalog=materialRateCatalog(),markup=settings?.quoteMarkupPercent||catalog.defaultMarkupPercent;
  const pricing=calculateQuotePricing({
    costPerKgCents:await currentMaterialCostPerKg(draft.material),gramsPerItem:draft.estimatedGrams,
    minutesPerItem:draft.estimatedMinutes,quantity:draft.quantity,wasteMultiplier:materialWasteMultiplier(draft.material),
    hourlyRateCents:cents(String(catalog.defaultMachineHourlyRateCad)),setupFeeCents:cents(String(catalog.defaultSetupFeeCad)),
    markupPercent:markup,minimumQuoteCents:cents(String(catalog.minimumQuoteCad)),
  });
  const unit=pricing.automaticUnitPriceCents,subtotal=unit*draft.quantity;
  const tax=Math.round(subtotal*(settings?.taxRate||0)/100);
  const count=await db.quote.count(),number=`Q-${new Date().getFullYear()}-${String(count+1).padStart(4,"0")}`;
  const quote=await db.quote.create({data:{
    number,customerId:customer.id,status:sendToCustomer?"SENT":"DRAFT",subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax,
    notes:`Created from email: ${draft.subject}`,
    items:{create:{description:draft.description,quantity:draft.quantity,material:draft.material,colour:draft.colour,
      estimatedGrams:draft.estimatedGrams,estimatedMinutes:draft.estimatedMinutes,baseCostCents:pricing.baseCostPerItemCents,
      markupPercent:markup,priceSource:"EMAIL_AUTO_CONFIG",unitPriceCents:unit,lineTotalCents:subtotal}},
  }});
  if(sendToCustomer){
    const account=draft.emailAccount;
    const canSend=account.ownerId===user.id||(account.isTeamMailbox&&account.access.some((row)=>row.canSend));
    if(!canSend)redirect("/messages/quote-drafts?error=send-access");
    const money=(value:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(value/100);
    try{
      await sendMailboxMessage(account,{to:draft.senderEmail,subject:`Quote ${quote.number}: ${draft.description}`,text:[
        `Hello${draft.senderName ? ` ${draft.senderName}` : ""}`,``,`Thank you for your 3D printing request.`,
        `Quote: ${quote.number}`,`Description: ${draft.description}`,`Quantity: ${draft.quantity}`,
        `Material: ${draft.material}`,`Colour: ${draft.colour||"To be confirmed"}`,
        `Subtotal: ${money(quote.subtotalCents)}`,`Tax: ${money(quote.taxCents)}`,`Total: ${money(quote.totalCents)}`,
        ``,settings?.invoiceTerms||"Please reply to approve this quote.",``,`This quote was reviewed and approved in Project TITAN.`,
      ].join("\n")});
    }catch{
      await db.quote.update({where:{id:quote.id},data:{status:"DRAFT"}});
      await db.emailQuoteDraft.update({where:{id},data:{quoteId:quote.id,status:"QUOTE_CREATED"}});
      redirect("/messages/quote-drafts?error=send");
    }
  }
  await db.emailQuoteDraft.update({where:{id},data:{quoteId:quote.id,status:sendToCustomer?"SENT":"QUOTE_CREATED"}});
  await audit(sendToCustomer?"EMAIL_QUOTE_SENT":"EMAIL_QUOTE_CREATED",`${quote.number}: ${draft.senderEmail}`,"Quote",quote.id);
  revalidatePath("/quotes"); revalidatePath("/customers"); revalidatePath("/messages/quote-drafts");
  return {...draft,quote};
}

export async function createQuoteFromEmailDraftAction(f:FormData){
  const user=await requirePermission(PermissionKey.QUOTES_CREATE);
  await createQuoteFromEmailDraft(s(f,"id"),user,false);
  redirect("/messages/quote-drafts?quoteCreated=1");
}

export async function approveAndSendEmailQuoteAction(f:FormData){
  const user=await requirePermission(PermissionKey.QUOTES_CREATE);
  await createQuoteFromEmailDraft(s(f,"id"),user,true);
  redirect("/messages/quote-drafts?sent=1");
}

export async function forwardEmailQuoteDraftAction(f:FormData){
  const user=await requirePermission(PermissionKey.EMAIL_CREATE);
  const id=s(f,"id");
  const draft=await db.emailQuoteDraft.findUnique({where:{id},include:{emailAccount:true}});
  if(!draft||draft.ownerId!==user.id||draft.emailAccount.ownerId!==user.id)redirect("/messages/quote-drafts?error=access");
  if(!draft.emailAccount.quoteForwardTo)redirect("/messages/quote-drafts?error=forward-address");
  const review=quoteReviewEmail(draft.emailAccount,{draftId:draft.id,subject:draft.subject,senderEmail:draft.senderEmail,
    description:draft.description,quantity:draft.quantity,material:draft.material,colour:draft.colour,
    estimatedGrams:draft.estimatedGrams,estimatedMinutes:draft.estimatedMinutes,missingFields:draft.missingFields});
  await sendMailboxMessage(draft.emailAccount,review);
  await db.emailQuoteDraft.update({where:{id},data:{forwardedAt:new Date()}});
  await audit("EMAIL_QUOTE_FORWARDED",draft.subject,"EmailQuoteDraft",id);
  revalidatePath("/messages/quote-drafts");
  redirect("/messages/quote-drafts?forwarded=1");
}

export async function dismissEmailQuoteDraftAction(f:FormData){
  const user=await requirePermission(PermissionKey.QUOTES_EDIT);
  const id=s(f,"id"),draft=await db.emailQuoteDraft.findUnique({where:{id}});
  if(!draft||draft.ownerId!==user.id)redirect("/messages/quote-drafts?error=access");
  await db.emailQuoteDraft.update({where:{id},data:{status:"DISMISSED"}});
  await audit("EMAIL_QUOTE_DISMISSED",draft.subject,"EmailQuoteDraft",id);
  revalidatePath("/messages/quote-drafts");
}

export async function setTeamMailboxAction(f:FormData){
  await requirePermission(PermissionKey.EMAIL_EDIT);
  const user=await requireUser(), id=s(f,"id");
  const account=await db.emailAccount.findUnique({where:{id}});
  if(!account || account.ownerId!==user.id) return;
  const isTeamMailbox=f.get("isTeamMailbox")==="on";
  await db.emailAccount.update({where:{id},data:{isTeamMailbox}});
  if(!isTeamMailbox) await db.mailboxAccess.deleteMany({where:{emailAccountId:id}});
  await audit("TEAM_MAILBOX_UPDATED",`${account.emailAddress}: ${isTeamMailbox?"shared":"private"}`,"EmailAccount",id);
  revalidatePath("/messages"); revalidatePath("/settings/email");
}

export async function setMailboxAccessAction(f:FormData){
  await requireOwner();
  const emailAccountId=s(f,"emailAccountId"), userId=s(f,"userId");
  const account=await db.emailAccount.findUnique({where:{id:emailAccountId}});
  if(!account?.isTeamMailbox) return;
  if(f.get("enabled")!=="on") await db.mailboxAccess.deleteMany({where:{emailAccountId,userId}});
  else await db.mailboxAccess.upsert({where:{emailAccountId_userId:{emailAccountId,userId}},update:{canRead:true,canSend:f.get("canSend")==="on"},create:{emailAccountId,userId,canRead:true,canSend:f.get("canSend")==="on"}});
  await audit("MAILBOX_ACCESS_UPDATED",account.emailAddress,"EmailAccount",emailAccountId);
  revalidatePath("/settings/email");
}

export async function createPriceSourceAction(f:FormData){
  await requirePermission(PermissionKey.PRICING_CREATE);
  await db.materialPriceSource.create({data:{name:s(f,"name"),sourceType:(s(f,"sourceType")||"MANUAL") as any,endpointUrl:s(f,"endpointUrl")||null,priceJsonPath:s(f,"priceJsonPath")||null,materialType:s(f,"materialType")||null,brand:s(f,"brand")||null,currency:s(f,"currency")||"CAD",spoolGrams:Number(s(f,"spoolGrams"))||1000}});
  revalidatePath("/pricing");
}

function jsonPath(value:any,path:string){return path.split(".").filter(Boolean).reduce((current,key)=>current?.[key],value);}
export async function refreshPriceSourceAction(f:FormData){
  await requirePermission(PermissionKey.PRICING_EDIT); const id=s(f,"id");
  const source=await db.materialPriceSource.findUnique({where:{id}});
  if(!source)return;
  try{
    let price=Number(s(f,"manualPrice"));
    if(source.sourceType==="JSON_FEED"){
      if(!source.endpointUrl || !source.priceJsonPath) throw new Error("Feed URL or price path is missing");
      const url=new URL(source.endpointUrl);
      if(url.protocol!=="https:") throw new Error("Only HTTPS price feeds are allowed");
      const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error(`Feed returned ${response.status}`);
      price=Number(jsonPath(await response.json(),source.priceJsonPath));
    }
    if(!Number.isFinite(price)||price<=0)throw new Error("Price must be greater than zero");
    await db.$transaction([db.materialMarketPrice.create({data:{sourceId:id,materialType:source.materialType||"PLA",priceCents:cents(String(price)),currency:source.currency,spoolGrams:source.spoolGrams,productUrl:source.endpointUrl}}),db.materialPriceSource.update({where:{id},data:{lastCheckedAt:new Date(),lastError:null}})]);
  }catch(error){await db.materialPriceSource.update({where:{id},data:{lastCheckedAt:new Date(),lastError:error instanceof Error?error.message:"Price refresh failed"}});}
  revalidatePath("/pricing");
}

export async function deletePriceSourceAction(f:FormData){await requirePermission(PermissionKey.PRICING_DELETE);await db.materialPriceSource.delete({where:{id:s(f,"id")}});revalidatePath("/pricing");}

export async function createPortalAccessAction(f:FormData){
  const actor=await requirePermission(PermissionKey.PORTAL_CREATE);
  const customerId=s(f,"customerId"), days=Math.max(1,Number(s(f,"expiresDays"))||90);
  await requireCustomerAccess(customerId,actor);
  const token=randomBytes(32).toString("base64url");
  await db.portalAccessToken.create({data:{customerId,label:s(f,"label")||"Customer access",tokenHash:createHash("sha256").update(token).digest("hex"),encryptedToken:encryptSecret(token),expiresAt:new Date(Date.now()+days*86400000)}});
  await audit("PORTAL_ACCESS_CREATED","Customer portal access created","Customer",customerId);
  revalidatePath("/customer-portal");
}

export async function revokePortalAccessAction(f:FormData){
  const actor=await requirePermission(PermissionKey.PORTAL_DELETE); const id=s(f,"id");
  const existing=await db.portalAccessToken.findUnique({where:{id},select:{customerId:true}}); if(!existing)return;
  await requireCustomerAccess(existing.customerId,actor);
  const token=await db.portalAccessToken.update({where:{id},data:{revokedAt:new Date()}});
  await audit("PORTAL_ACCESS_REVOKED","Customer portal access revoked","Customer",token.customerId);
  revalidatePath("/customer-portal");
}

export async function saveBambuSettingsAction(f:FormData){
  await requireOwner();
  let errorMessage="";
  try{
    const raw=s(f,"configuration");
    const parsed=JSON.parse(raw);
    const {normalizeBambuConfiguration}=await import("@/lib/bambu");
    const config=normalizeBambuConfiguration(parsed,{allowMissingSecrets:true});
    const current=await db.integrationSetting.findUnique({where:{provider:"BAMBU"}});
    if(current?.encryptedJson){
      try{
        const old=normalizeBambuConfiguration(JSON.parse(decryptSecret(current.encryptedJson)));
        for(const printer of config.printers){
          const prior=old.printers.find(p=>p.id===printer.id);
          if(prior&&!printer.accessCode)printer.accessCode=prior.accessCode;
          if(prior&&!printer.bridgeToken)printer.bridgeToken=prior.bridgeToken;
        }
      }catch{}
    }
    for(const printer of config.printers){if(!printer.accessCode)throw new Error(`Printer ${printer.name} requires an accessCode.`);}
    await db.integrationSetting.upsert({where:{provider:"BAMBU"},update:{enabled:f.get("enabled")==="on",encryptedJson:encryptSecret(JSON.stringify(config))},create:{provider:"BAMBU",enabled:f.get("enabled")==="on",encryptedJson:encryptSecret(JSON.stringify(config))}});
    await audit("BAMBU_SETTINGS_UPDATED",`${config.printers.length} printer configuration(s) saved`,"IntegrationSetting","BAMBU");
    revalidatePath("/settings/bambu");revalidatePath("/bambu");
  }catch(error){
    console.error("Bambu settings save failed",error);
    errorMessage=error instanceof Error?error.message:"Invalid configuration";
  }
  if(errorMessage)redirect(`/settings/bambu?error=${encodeURIComponent(errorMessage)}`);
  redirect("/settings/bambu?success=saved");
}

export async function sendBambuCommandAction(f:FormData){
  await requirePermission(PermissionKey.INTEGRATIONS_MANAGE);
  const printerId=s(f,"printerId"),command=s(f,"command");
  if(!["pause","resume","stop","light-on","light-off"].includes(command))redirect("/bambu?error=command");
  const row=await db.integrationSetting.findUnique({where:{provider:"BAMBU"}});
  if(!row?.enabled||!row.encryptedJson)redirect("/bambu?error=disabled");
  let failed=false;
  try{
    const {normalizeBambuConfiguration}=await import("@/lib/bambu");
    const config=normalizeBambuConfiguration(JSON.parse(decryptSecret(row.encryptedJson)));
    const printer=config.printers.find(p=>p.id===printerId);
    if(!printer?.bridgeUrl){failed=true;}else{
      const response=await fetch(`${printer.bridgeUrl}/api/printers/${encodeURIComponent(printer.id)}/commands`,{method:"POST",headers:{"content-type":"application/json",...(printer.bridgeToken?{authorization:`Bearer ${printer.bridgeToken}`}:{})},body:JSON.stringify({command}),cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error(`Bridge returned ${response.status}`);
      await audit("BAMBU_COMMAND",`${printer.name}: ${command}`,"IntegrationSetting","BAMBU");
    }
  }catch(error){console.error("Bambu command failed",error);failed=true;}
  if(failed)redirect("/bambu?error=connection");
  redirect(`/bambu?success=${encodeURIComponent(command)}`);
}

