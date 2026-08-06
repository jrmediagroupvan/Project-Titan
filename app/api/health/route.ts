import { db } from "@/lib/db";
export async function GET(){try{await db.$queryRaw`SELECT 1`;return Response.json({ok:true,service:"project-titan",time:new Date().toISOString()});}catch(error){return Response.json({ok:false,error:String(error)},{status:503});}}
