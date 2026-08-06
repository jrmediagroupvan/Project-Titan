import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import AiChat from "@/components/AiChat";
import { deleteAiConversationAction } from "@/app/actions";
import { reviewAiActionAction } from "@/app/actions";
import { loadAiConfiguration } from "@/lib/ai";
import { db } from "@/lib/db";
import { requirePermission, userAllows } from "@/lib/permissions";

export const dynamic="force-dynamic";

export default async function Assistant({searchParams}:{searchParams:Promise<{conversation?:string}>}){
  const actor=await requirePermission(PermissionKey.AI_CHAT_VIEW);
  const selected=(await searchParams).conversation;
  const [conversations,canChat,canDelete,canCreateImages,canSearchCrm,canSearchWeb,canPrice,canAnalyzeFiles,canProposeActions,canApproveActions,setting,images]=await Promise.all([
    db.aiConversation.findMany({where:{userId:actor.id},orderBy:{updatedAt:"desc"},take:30}),
    userAllows(actor.id,actor.role,PermissionKey.AI_CHAT_CREATE),
    userAllows(actor.id,actor.role,PermissionKey.AI_CHAT_DELETE),
    userAllows(actor.id,actor.role,PermissionKey.AI_IMAGES_CREATE),
    userAllows(actor.id,actor.role,PermissionKey.AI_CRM_SEARCH),
    userAllows(actor.id,actor.role,PermissionKey.AI_WEB_SEARCH),
    userAllows(actor.id,actor.role,PermissionKey.AI_PRICING_USE),
    userAllows(actor.id,actor.role,PermissionKey.AI_FILES_ANALYZE),
    userAllows(actor.id,actor.role,PermissionKey.AI_ACTIONS_PROPOSE),
    userAllows(actor.id,actor.role,PermissionKey.AI_ACTIONS_APPROVE),
    db.aiUserSetting.findUnique({where:{userId:actor.id}}),
    db.aiGeneratedImage.findMany({where:{userId:actor.id},orderBy:{createdAt:"desc"},take:12}),
  ]);
  const proposals=canApproveActions
    ?await db.aiActionProposal.findMany({where:{status:"PENDING"},include:{proposedBy:{select:{name:true}}},orderBy:{createdAt:"desc"},take:20})
    :await db.aiActionProposal.findMany({where:{proposedById:actor.id},include:{proposedBy:{select:{name:true}}},orderBy:{createdAt:"desc"},take:10});
  const conversation=selected?await db.aiConversation.findFirst({where:{id:selected,userId:actor.id},include:{messages:{orderBy:{createdAt:"asc"}}}}):null;
  let provider="NOT_CONFIGURED";
  let configurationError="";
  try{provider=(await loadAiConfiguration(actor.id)).provider;}catch(error){
    configurationError=error instanceof Error?error.message:"AI assistant is not configured";
  }
  const owner=actor.role==="OWNER";
  return <><div className="top"><div><h1>TITAN AI Assistant</h1><p className="muted">{owner?"Full OWNER assistant access for general questions and TITAN business work.":"AI access is limited to 3D-printing projects and authorized TITAN work."} Using {setting?.useServerConfig===false?"your private API":"the shared server API"}.</p></div><div className="actions"><span className="pill">{owner?"Full OWNER access":"3D printing only"}</span><Link className="secondary" href="/assistant/settings">My AI Settings</Link><Link className="button" href="/assistant">New chat</Link></div></div>
    <div className="aiLayout"><aside className="card aiHistory"><h2>Conversations</h2>{!conversations.length&&<p className="muted">No chats yet.</p>}{conversations.map(item=><div className="aiHistoryRow" key={item.id}><Link href={`/assistant?conversation=${item.id}`}>{item.title}</Link>{canDelete&&<form action={deleteAiConversationAction}><input type="hidden" name="id" value={item.id}/><button className="danger small" aria-label={`Delete ${item.title}`}>×</button></form>}</div>)}</aside>
      <AiChat initialConversationId={conversation?.id||null} initialMessages={(conversation?.messages||[]).map(x=>({id:x.id,role:x.role,content:x.content}))} canChat={canChat} canCreateImages={canCreateImages} provider={provider} configurationError={configurationError} initialImages={images.map(x=>({id:x.id,prompt:x.prompt,model:x.model,createdAt:x.createdAt.toISOString()}))} canSearchCrm={canSearchCrm} canSearchWeb={canSearchWeb} canPrice={canPrice} canAnalyzeFiles={canAnalyzeFiles} canProposeActions={canProposeActions} isOwner={owner}/>
    </div>
    {!!proposals.length&&<section className="card section"><h2>{canApproveActions?"AI Action Approval Queue":"My AI Action Requests"}</h2><p className="muted">TITAN AI never applies these changes silently. A permitted reviewer must approve each action.</p>{proposals.map(proposal=><article className="record" key={proposal.id}><div className="top"><div><b>{proposal.title}</b><div className="muted">{proposal.actionType.replaceAll("_"," ")} · proposed by {proposal.proposedBy?.name||"you"} · {proposal.createdAt.toLocaleString()}</div></div><span className="pill">{proposal.status}</span></div><p>{proposal.description}</p>{proposal.resultSummary&&<p className="muted">{proposal.resultSummary}</p>}{canApproveActions&&proposal.status==="PENDING"&&<div className="actions"><form action={reviewAiActionAction}><input type="hidden" name="id" value={proposal.id}/><input type="hidden" name="decision" value="approve"/><button className="button small">Approve & run</button></form><form action={reviewAiActionAction}><input type="hidden" name="id" value={proposal.id}/><input type="hidden" name="decision" value="reject"/><button className="danger small">Reject</button></form></div>}</article>)}</section>}
  </>;
}
