"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireOwner, requireUser } from "@/lib/authorization";
import { encryptSecret } from "@/lib/crypto";

const s=(f:FormData,k:string)=>String(f.get(k)||"").trim();
const cents=(v:string)=>Math.round((Number(v)||0)*100);

export async function createSupplierAction(f:FormData){
  await requireAdmin();
  await db.supplier.create({data:{name:s(f,"name"),contactName:s(f,"contactName")||null,email:s(f,"email")||null,phone:s(f,"phone")||null,website:s(f,"website")||null,notes:s(f,"notes")||null}});
  revalidatePath("/procurement");
}
export async function updateSupplierAction(f:FormData){
  await requireAdmin(); const id=s(f,"id");
  await db.supplier.update({where:{id},data:{name:s(f,"name"),contactName:s(f,"contactName")||null,email:s(f,"email")||null,phone:s(f,"phone")||null,website:s(f,"website")||null,notes:s(f,"notes")||null,active:f.get("active")==="on"}});
  revalidatePath("/procurement");
}
export async function deleteSupplierAction(f:FormData){
  await requireOwner(); const id=s(f,"id");
  const count=await db.purchaseOrder.count({where:{supplierId:id}});
  if(count) redirect("/procurement?error=linked");
  await db.supplier.delete({where:{id}}); revalidatePath("/procurement");
}
export async function createPurchaseOrderAction(f:FormData){
  await requireAdmin(); const supplierId=s(f,"supplierId");
  const supplier=await db.supplier.findUnique({where:{id:supplierId}}); if(!supplier)return;
  const subtotal=cents(s(f,"subtotal")), tax=cents(s(f,"tax"));
  const number=`PO-${new Date().getFullYear()}-${String((await db.purchaseOrder.count())+1).padStart(4,"0")}`;
  await db.purchaseOrder.create({data:{number,supplierId,supplierName:supplier.name,status:s(f,"status")||"DRAFT",subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax,expectedAt:s(f,"expectedAt")?new Date(s(f,"expectedAt")):null,notes:s(f,"notes")||null}});
  revalidatePath("/procurement");
}
export async function updatePurchaseOrderAction(f:FormData){
  await requireAdmin(); const id=s(f,"id"), subtotal=cents(s(f,"subtotal")), tax=cents(s(f,"tax"));
  await db.purchaseOrder.update({where:{id},data:{status:s(f,"status"),subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax,expectedAt:s(f,"expectedAt")?new Date(s(f,"expectedAt")):null,notes:s(f,"notes")||null}});
  revalidatePath("/procurement");
}
export async function deletePurchaseOrderAction(f:FormData){await requireOwner();await db.purchaseOrder.delete({where:{id:s(f,"id")}});revalidatePath("/procurement");}

export async function createAutomationRuleAction(f:FormData){
  await requireOwner();
  await db.automationRule.create({data:{name:s(f,"name"),triggerType:s(f,"triggerType"),actionType:s(f,"actionType"),conditions:{notes:s(f,"conditions")},actionConfig:{notes:s(f,"actionConfig")}}});
  revalidatePath("/automations");
}
export async function toggleAutomationRuleAction(f:FormData){await requireOwner();const id=s(f,"id");const r=await db.automationRule.findUnique({where:{id}});if(r)await db.automationRule.update({where:{id},data:{enabled:!r.enabled}});revalidatePath("/automations");}
export async function deleteAutomationRuleAction(f:FormData){await requireOwner();await db.automationRule.delete({where:{id:s(f,"id")}});revalidatePath("/automations");}

export async function installPluginAction(f:FormData){
  await requireOwner(); const slug=s(f,"slug");
  await db.pluginInstallation.upsert({where:{slug},update:{name:s(f,"name"),category:s(f,"category"),enabled:true},create:{slug,name:s(f,"name"),category:s(f,"category"),enabled:true}});
  revalidatePath("/plugins");
}
export async function togglePluginAction(f:FormData){await requireOwner();const id=s(f,"id");const p=await db.pluginInstallation.findUnique({where:{id}});if(p)await db.pluginInstallation.update({where:{id},data:{enabled:!p.enabled}});revalidatePath("/plugins");}
export async function uninstallPluginAction(f:FormData){await requireOwner();await db.pluginInstallation.delete({where:{id:s(f,"id")}});revalidatePath("/plugins");}

export async function createSupportTicketAction(f:FormData){
  await requireUser(); const customerId=s(f,"customerId")||null;
  const customer=customerId?await db.customer.findUnique({where:{id:customerId}}):null;
  const number=`TKT-${new Date().getFullYear()}-${String((await db.supportTicket.count())+1).padStart(4,"0")}`;
  await db.supportTicket.create({data:{number,customerId,customerName:customer?.name||null,subject:s(f,"subject"),description:s(f,"description"),priority:s(f,"priority")||"NORMAL"}});
  revalidatePath("/support");
}
export async function updateSupportTicketAction(f:FormData){
  await requireAdmin(); const id=s(f,"id");
  await db.supportTicket.update({where:{id},data:{status:s(f,"status"),priority:s(f,"priority"),assignedToId:s(f,"assignedToId")||null,assignedToName:s(f,"assignedToName")||null}});
  revalidatePath("/support");
}
export async function deleteSupportTicketAction(f:FormData){await requireAdmin();await db.supportTicket.delete({where:{id:s(f,"id")}});revalidatePath("/support");}

export async function createPrinterConnectorAction(f:FormData){
  await requireOwner(); const secret=s(f,"apiKey");
  await db.printerConnector.create({data:{name:s(f,"name"),connectorType:s(f,"connectorType"),endpointUrl:s(f,"endpointUrl")||null,apiKeyEncrypted:secret?encryptSecret(secret):null}});
  revalidatePath("/printer-hub");
}
export async function testPrinterConnectorAction(f:FormData){
  await requireOwner(); const id=s(f,"id"), c=await db.printerConnector.findUnique({where:{id}}); if(!c)return;
  let status="CONFIGURED", lastError:string|null=null;
  if(c.endpointUrl){try{const u=new URL(c.endpointUrl);if(!["http:","https:"].includes(u.protocol))throw new Error("Invalid URL protocol");}catch(e){status="ERROR";lastError=e instanceof Error?e.message:"Invalid endpoint";}}
  await db.printerConnector.update({where:{id},data:{status,lastError,lastCheckedAt:new Date()}}); revalidatePath("/printer-hub");
}
export async function deletePrinterConnectorAction(f:FormData){await requireOwner();await db.printerConnector.delete({where:{id:s(f,"id")}});revalidatePath("/printer-hub");}

export async function createMarketplaceChannelAction(f:FormData){await requireOwner();await db.marketplaceChannel.create({data:{name:s(f,"name"),channelType:s(f,"channelType"),enabled:f.get("enabled")==="on",configuration:{notes:s(f,"configuration")}}});revalidatePath("/channels");}
export async function toggleMarketplaceChannelAction(f:FormData){await requireOwner();const id=s(f,"id");const c=await db.marketplaceChannel.findUnique({where:{id}});if(c)await db.marketplaceChannel.update({where:{id},data:{enabled:!c.enabled,lastSyncAt:new Date(),lastError:null}});revalidatePath("/channels");}
export async function deleteMarketplaceChannelAction(f:FormData){await requireOwner();await db.marketplaceChannel.delete({where:{id:s(f,"id")}});revalidatePath("/channels");}

export async function markNotificationReadAction(f:FormData){const u=await requireUser();const id=s(f,"id");const n=await db.titanNotification.findUnique({where:{id}});if(n&&(n.userId===null||n.userId===u.id))await db.titanNotification.update({where:{id},data:{readAt:new Date()}});revalidatePath("/notifications");}
export async function createSystemNotificationAction(f:FormData){await requireAdmin();await db.titanNotification.create({data:{userId:s(f,"userId")||null,title:s(f,"title"),message:s(f,"message"),severity:s(f,"severity")||"INFO",linkUrl:s(f,"linkUrl")||null}});revalidatePath("/notifications");}
