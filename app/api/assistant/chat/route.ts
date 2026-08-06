import { PermissionKey } from "@prisma/client";
import { loadAiConfiguration } from "@/lib/ai";
import { createTitanAgentReply } from "@/lib/ai-agent";
import { aiScopeAllows, aiScopeInstructions, RESTRICTED_AI_SCOPE_MESSAGE } from "@/lib/ai-scope";
import type { AiToolMode } from "@/lib/ai-tools";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";

export async function POST(request:Request){
  const actor=await requireUser();
  if(!(await userAllows(actor.id,actor.role,PermissionKey.AI_CHAT_CREATE)))return Response.json({error:"AI chat permission is required."},{status:403});
  const body=await request.json().catch(()=>({})) as {message?:unknown;conversationId?:unknown;mode?:unknown};
  const message=typeof body.message==="string"?body.message.trim():"";
  const mode=(["AUTO","CRM","WEB","PRICING"].includes(String(body.mode))?String(body.mode):"AUTO") as AiToolMode;
  if(!message||message.length>8000)return Response.json({error:"Enter a message up to 8,000 characters."},{status:400});
  let conversation=typeof body.conversationId==="string"
    ?await db.aiConversation.findFirst({where:{id:body.conversationId,userId:actor.id}})
    :null;
  if(!conversation)conversation=await db.aiConversation.create({data:{userId:actor.id,title:message.slice(0,70)}});
  const previous=await db.aiMessage.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:"asc"},take:20});
  const scopeAllowed=aiScopeAllows({
    role:actor.role,
    message,
    recentMessages:previous.filter(item=>item.role==="USER").map(item=>item.content),
  });
  if(!scopeAllowed){
    await db.$transaction([
      db.aiMessage.create({data:{conversationId:conversation.id,role:"USER",content:message}}),
      db.aiMessage.create({data:{conversationId:conversation.id,role:"ASSISTANT",content:RESTRICTED_AI_SCOPE_MESSAGE}}),
      db.aiConversation.update({where:{id:conversation.id},data:{updatedAt:new Date()}}),
    ]);
    return Response.json({
      conversationId:conversation.id,
      reply:RESTRICTED_AI_SCOPE_MESSAGE,
      citations:[],
      toolsUsed:[],
      restricted:true,
    });
  }
  try{
    const config=await loadAiConfiguration(actor.id);
    const canWebSearch=await userAllows(actor.id,actor.role,PermissionKey.AI_WEB_SEARCH);
    const business=await db.businessSetting.findUnique({where:{id:"primary"}});
    const system=[
      config.systemPrompt||"You are TITAN AI, an expert copilot for a Canadian 3D-printing business.",
      `Business: ${business?.name||"Project TITAN user"}. Currency: ${business?.currency||"CAD"}. Default quote markup: ${business?.quoteMarkupPercent??13}%.`,
      "Use TITAN tools for CRM facts, current prices, file facts, and current business state. Never invent a record, price, print time, material weight, action result, or web source.",
      "Every tool is permission-filtered for the signed-in user. Never ask for or expose credentials. Never attempt to work around a missing tool or permission.",
      "CRM changes are never immediate: use propose_crm_action, clearly explain what is staged, and wait for a human to approve it in TITAN.",
      "When calculating a quote, label it a draft estimate and state the important assumptions. When web search is used, retain source links.",
      aiScopeInstructions(actor.role),
      `Current mode: ${mode}.`,
    ].join("\n\n");
    const result=await createTitanAgentReply({
      config,
      actor,
      conversationId:conversation.id,
      instructions:system,
      mode,
      allowNativeWebSearch:config.provider==="OPENAI"&&canWebSearch&&(mode==="AUTO"||mode==="WEB"),
      messages:[
      ...previous.map(x=>({role:x.role==="USER"?"user" as const:"assistant" as const,content:x.content})),
      {role:"user",content:message},
      ],
    });
    await db.$transaction([
      db.aiMessage.create({data:{conversationId:conversation.id,role:"USER",content:message}}),
      db.aiMessage.create({data:{conversationId:conversation.id,role:"ASSISTANT",content:result.text}}),
      db.aiConversation.update({where:{id:conversation.id},data:{updatedAt:new Date()}}),
    ]);
    return Response.json({conversationId:conversation.id,reply:result.text,citations:result.citations,toolsUsed:result.toolsUsed});
  }catch(error){
    const detail=error instanceof Error?error.message:"AI request failed";
    const status=/not configured|configuration is incomplete|personal AI configuration is incomplete/i.test(detail)?503:502;
    return Response.json({error:detail},{status});
  }
}
