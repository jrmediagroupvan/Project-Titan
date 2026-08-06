import { db } from "@/lib/db";
import { readMailboxMessage } from "@/lib/email";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";
import { deleteEmailMessageAction, scanEmailForQuoteAction } from "@/app/actions";
import { userAllows } from "@/lib/permissions";
export const dynamic="force-dynamic";

export default async function MessagePage({params}:{params:Promise<{accountId:string;messageId:string}>}){
  const user=await requirePermission(PermissionKey.EMAIL_VIEW);
  const {accountId,messageId}=await params;
  const account=await db.emailAccount.findUnique({where:{id:accountId},include:{access:{where:{userId:user.id}}}});
  if(!account||(account.ownerId!==user.id&&!(account.isTeamMailbox&&account.access.some((row)=>row.canRead))))redirect("/messages?error=access");
  let message:Awaited<ReturnType<typeof readMailboxMessage>>|null=null;
  let error="";
  try{message=await readMailboxMessage(account,messageId);}catch(cause){error=cause instanceof Error?cause.message:"Unable to open message";}
  const replyAddress=message?.from.match(/<([^>]+)>/)?.[1]||message?.from||"";
  const replySubject=message?.subject.toLowerCase().startsWith("re:")?message?.subject:`Re: ${message?.subject||""}`;
  const [canCreateQuote,canDelete]=await Promise.all([userAllows(user.id,user.role,PermissionKey.QUOTES_CREATE),userAllows(user.id,user.role,PermissionKey.EMAIL_DELETE)]);
  return <><div className="top"><div><h1>{message?.subject||"Email message"}</h1><p className="muted">{account.emailAddress}</p></div><div className="actions">{message&&canCreateQuote&&<form action={scanEmailForQuoteAction}><input type="hidden" name="accountId" value={account.id}/><input type="hidden" name="messageId" value={messageId}/><button>Create quote draft</button></form>}{message&&<a className="button" href={`/messages?account=${encodeURIComponent(account.id)}&to=${encodeURIComponent(replyAddress)}&subject=${encodeURIComponent(replySubject)}`}>Reply</a>}{message&&canDelete&&<form action={deleteEmailMessageAction}><input type="hidden" name="accountId" value={account.id}/><input type="hidden" name="messageId" value={messageId}/><button className="danger">Delete</button></form>}<a className="secondary" href={`/messages?account=${encodeURIComponent(account.id)}`}>Back to inbox</a></div></div>{error?<p className="alert">{error}</p>:message&&<article className="card emailMessage"><dl><dt>From</dt><dd>{message.from}</dd><dt>To</dt><dd>{message.to}</dd><dt>Date</dt><dd>{message.date}</dd></dl><hr/><pre>{message.text}</pre></article>}</>;
}
