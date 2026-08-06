import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PermissionKey } from "@prisma/client";
import { createOpenAiImage, loadAiConfiguration } from "@/lib/ai";
import { aiScopeAllows, RESTRICTED_AI_SCOPE_MESSAGE } from "@/lib/ai-scope";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeStoragePath } from "@/lib/storage";

const allowedSizes=new Set(["1024x1024","1536x1024","1024x1536"]);
const allowedQuality=new Set(["auto","low","medium","high"]);

export async function POST(request:Request){
  const actor=await requireUser();
  if(!(await userAllows(actor.id,actor.role,PermissionKey.AI_IMAGES_CREATE)))return Response.json({error:"AI image permission is required."},{status:403});
  const body=await request.json().catch(()=>({})) as {prompt?:unknown;size?:unknown;quality?:unknown};
  const prompt=typeof body.prompt==="string"?body.prompt.trim():"";
  if(!prompt||prompt.length>4000)return Response.json({error:"Enter an image prompt up to 4,000 characters."},{status:400});
  if(!aiScopeAllows({role:actor.role,message:prompt,allowNeutralChat:false})){
    return Response.json({error:RESTRICTED_AI_SCOPE_MESSAGE},{status:403});
  }
  const size=typeof body.size==="string"&&allowedSizes.has(body.size)?body.size:"1024x1024";
  const quality=typeof body.quality==="string"&&allowedQuality.has(body.quality)?body.quality:"auto";
  try{
    const config=await loadAiConfiguration(actor.id);
    const generated=await createOpenAiImage(config,prompt,{size,quality});
    const storageKey=path.posix.join("ai",actor.id,`${randomBytes(16).toString("hex")}.png`);
    const target=safeStoragePath(storageKey);
    await mkdir(/*turbopackIgnore: true*/ path.dirname(target),{recursive:true});
    await writeFile(/*turbopackIgnore: true*/ target,generated.bytes,{flag:"wx"});
    const image=await db.aiGeneratedImage.create({data:{userId:actor.id,prompt,storageKey,mimeType:"image/png",bytes:generated.bytes.length,model:generated.model}});
    return Response.json({id:image.id,url:`/api/assistant/images/${image.id}`,revisedPrompt:generated.revisedPrompt});
  }catch(error){
    const detail=error instanceof Error?error.message:"Image generation failed";
    return Response.json({error:detail},{status:502});
  }
}
