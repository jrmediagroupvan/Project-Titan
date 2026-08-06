"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireOwner, requireUser } from "@/lib/authorization";
import { encryptSecret } from "@/lib/crypto";
import { createHash, randomBytes } from "node:crypto";

const s=(f:FormData,k:string)=>String(f.get(k)||"").trim();
const cents=(v:string)=>Math.round((Number(v)||0)*100);
const date=(v:string)=>v?new Date(v):null;
const list=(v:string)=>v.split(",").map(x=>x.trim()).filter(Boolean);
const slugify=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

export async function createQualityInspectionAction(f:FormData){const u=await requireUser();await db.qualityInspection.create({data:{referenceType:s(f,"referenceType")||"ORDER",referenceId:s(f,"referenceId")||null,referenceLabel:s(f,"referenceLabel")||null,inspectorId:u.id,inspectorName:u.email,status:s(f,"status")||"PENDING",score:Number(s(f,"score"))||null,checklist:{items:list(s(f,"checklist"))},notes:s(f,"notes")||null,photoUrl:s(f,"photoUrl")||null,inspectedAt:s(f,"status")==="PASSED"||s(f,"status")==="FAILED"?new Date():null}});revalidatePath("/quality");}
export async function updateQualityInspectionAction(f:FormData){await requireAdmin();const id=s(f,"id"),status=s(f,"status");await db.qualityInspection.update({where:{id},data:{status,score:Number(s(f,"score"))||null,notes:s(f,"notes")||null,inspectedAt:["PASSED","FAILED"].includes(status)?new Date():null}});revalidatePath("/quality");}
export async function deleteQualityInspectionAction(f:FormData){await requireAdmin();await db.qualityInspection.delete({where:{id:s(f,"id")}});revalidatePath("/quality");}

export async function createMaintenanceAction(f:FormData){await requireAdmin();await db.maintenanceRecord.create({data:{assetType:s(f,"assetType")||"PRINTER",assetId:s(f,"assetId")||null,assetName:s(f,"assetName"),maintenanceType:s(f,"maintenanceType"),status:s(f,"status")||"SCHEDULED",scheduledAt:date(s(f,"scheduledAt")),meterHours:Number(s(f,"meterHours"))||null,costCents:cents(s(f,"cost")),performedBy:s(f,"performedBy")||null,notes:s(f,"notes")||null}});revalidatePath("/maintenance");}
export async function updateMaintenanceAction(f:FormData){await requireAdmin();const id=s(f,"id"),status=s(f,"status");await db.maintenanceRecord.update({where:{id},data:{status,scheduledAt:date(s(f,"scheduledAt")),completedAt:status==="COMPLETED"?new Date():null,meterHours:Number(s(f,"meterHours"))||null,costCents:cents(s(f,"cost")),performedBy:s(f,"performedBy")||null,notes:s(f,"notes")||null}});revalidatePath("/maintenance");}
export async function deleteMaintenanceAction(f:FormData){await requireOwner();await db.maintenanceRecord.delete({where:{id:s(f,"id")}});revalidatePath("/maintenance");}

export async function createKnowledgeArticleAction(f:FormData){const u=await requireAdmin();const title=s(f,"title");let slug=slugify(s(f,"slug")||title);if(await db.knowledgeArticle.findUnique({where:{slug}}))slug=`${slug}-${Date.now()}`;await db.knowledgeArticle.create({data:{title,slug,category:s(f,"category")||"GENERAL",summary:s(f,"summary")||null,content:s(f,"content"),status:s(f,"status")||"DRAFT",authorId:u.id,authorName:u.email,publishedAt:s(f,"status")==="PUBLISHED"?new Date():null}});revalidatePath("/knowledge");}
export async function updateKnowledgeArticleAction(f:FormData){await requireAdmin();const id=s(f,"id"),status=s(f,"status");const a=await db.knowledgeArticle.findUnique({where:{id}});if(!a)return;await db.knowledgeArticle.update({where:{id},data:{title:s(f,"title"),category:s(f,"category"),summary:s(f,"summary")||null,content:s(f,"content"),status,version:{increment:1},publishedAt:status==="PUBLISHED"?(a.publishedAt||new Date()):null}});revalidatePath("/knowledge");}
export async function deleteKnowledgeArticleAction(f:FormData){await requireOwner();await db.knowledgeArticle.delete({where:{id:s(f,"id")}});revalidatePath("/knowledge");}

export async function createServicePlanAction(f:FormData){await requireOwner();await db.servicePlan.create({data:{name:s(f,"name"),description:s(f,"description")||null,billingInterval:s(f,"billingInterval")||"MONTHLY",priceCents:cents(s(f,"price")),includedHours:Number(s(f,"includedHours"))||0,discountPercent:Number(s(f,"discountPercent"))||0}});revalidatePath("/service-plans");}
export async function toggleServicePlanAction(f:FormData){await requireOwner();const id=s(f,"id"),p=await db.servicePlan.findUnique({where:{id}});if(p)await db.servicePlan.update({where:{id},data:{active:!p.active}});revalidatePath("/service-plans");}
export async function subscribeCustomerAction(f:FormData){await requireAdmin();const customer=await db.customer.findUnique({where:{id:s(f,"customerId")}}),plan=await db.servicePlan.findUnique({where:{id:s(f,"servicePlanId")}});if(!customer||!plan)return;await db.customerSubscription.create({data:{customerId:customer.id,customerName:customer.name,servicePlanId:plan.id,servicePlanName:plan.name,renewsAt:date(s(f,"renewsAt")),notes:s(f,"notes")||null}});revalidatePath("/service-plans");}
export async function cancelSubscriptionAction(f:FormData){await requireAdmin();await db.customerSubscription.update({where:{id:s(f,"id")},data:{status:"CANCELLED",cancelledAt:new Date()}});revalidatePath("/service-plans");}

export async function createApiCredentialAction(f:FormData){const u=await requireOwner();const supplied=s(f,"secret");const raw=supplied.length>=24?supplied:`titan_${randomBytes(24).toString("base64url")}`;await db.apiCredential.create({data:{name:s(f,"name"),keyPrefix:raw.slice(0,14),keyHash:createHash("sha256").update(raw).digest("hex"),encryptedKey:encryptSecret(raw),scopes:list(s(f,"scopes")),expiresAt:date(s(f,"expiresAt")),createdById:u.id,createdByName:u.email}});revalidatePath("/developer-api");}
export async function revokeApiCredentialAction(f:FormData){await requireOwner();await db.apiCredential.update({where:{id:s(f,"id")},data:{active:false}});revalidatePath("/developer-api");}
export async function createWebhookAction(f:FormData){await requireOwner();const secret=s(f,"secret")||randomBytes(24).toString("hex");await db.webhookEndpoint.create({data:{name:s(f,"name"),endpointUrl:s(f,"endpointUrl"),events:list(s(f,"events")),secretEncrypted:encryptSecret(secret)}});revalidatePath("/developer-api");}
export async function toggleWebhookAction(f:FormData){await requireOwner();const id=s(f,"id"),w=await db.webhookEndpoint.findUnique({where:{id}});if(w)await db.webhookEndpoint.update({where:{id},data:{active:!w.active}});revalidatePath("/developer-api");}
export async function deleteWebhookAction(f:FormData){await requireOwner();await db.webhookEndpoint.delete({where:{id:s(f,"id")}});revalidatePath("/developer-api");}

export async function registerBackupAction(f:FormData){const u=await requireOwner();await db.backupSnapshot.create({data:{label:s(f,"label"),backupType:s(f,"backupType")||"FULL",status:s(f,"status")||"REGISTERED",storagePath:s(f,"storagePath"),sizeBytes:s(f,"sizeBytes")?BigInt(s(f,"sizeBytes")):null,checksum:s(f,"checksum")||null,databaseOnly:f.get("databaseOnly")==="on",createdById:u.id,createdByName:u.email,completedAt:new Date(),notes:s(f,"notes")||null}});revalidatePath("/backups");}
export async function deleteBackupRecordAction(f:FormData){await requireOwner();await db.backupSnapshot.delete({where:{id:s(f,"id")}});revalidatePath("/backups");}
