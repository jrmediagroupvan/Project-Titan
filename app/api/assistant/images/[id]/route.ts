import { readFile } from "node:fs/promises";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { safeStoragePath } from "@/lib/storage";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await requireUser();
  const {id}=await params;
  const image=await db.aiGeneratedImage.findFirst({where:{id,userId:actor.id}});
  if(!image)return new Response("Not found",{status:404});
  try{
    const bytes=await readFile(/*turbopackIgnore: true*/ safeStoragePath(image.storageKey));
    return new Response(bytes,{headers:{"Content-Type":image.mimeType,"Content-Length":String(bytes.length),"Cache-Control":"private, max-age=3600"}});
  }catch{return new Response("Not found",{status:404});}
}
