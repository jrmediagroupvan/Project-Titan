import { db } from "@/lib/db";
import { listMailbox } from "@/lib/email";
import { deleteEmailMessageAction, scanMailboxForQuotesAction, sendEmailAction, setTeamMailboxAction } from "@/app/actions";
import { PermissionKey } from "@prisma/client";
import { requirePermission, userAllows } from "@/lib/permissions";
export const dynamic = "force-dynamic";

export default async function Messages({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user = await requirePermission(PermissionKey.EMAIL_VIEW);
  const query = await searchParams;
  const [canSendPermission,canEdit,canDelete] = await Promise.all([
    userAllows(user.id,user.role,PermissionKey.EMAIL_CREATE),
    userAllows(user.id,user.role,PermissionKey.EMAIL_EDIT),
    userAllows(user.id,user.role,PermissionKey.EMAIL_DELETE),
  ]);
  const accounts = await db.emailAccount.findMany({
    where: { active: true, OR: [
      { ownerId: user.id },
      { isTeamMailbox: true, access: { some: { userId: user.id, canRead: true } } },
    ]},
    include:{access:{where:{userId:user.id}}},
    orderBy: { emailAddress: "asc" },
  });
  const selected = accounts.find((account)=>account.id===query.account)||accounts[0];
  const canSend=Boolean(selected&&canSendPermission&&(selected.ownerId===user.id||selected.access.some((row)=>row.canSend)));
  let messages: Awaited<ReturnType<typeof listMailbox>> = [];
  let inboxError = "";
  if (selected) {
    try {
      messages = await listMailbox(selected);
      await db.emailAccount.update({where:{id:selected.id},data:{lastSyncAt:new Date()}}).catch(()=>undefined);
    } catch (error) { inboxError = error instanceof Error ? error.message : "Unable to load inbox"; }
  }
  return <><div className="top"><div><h1>My Email</h1><p className="muted">Read, send, and turn customer requests into reviewable quote drafts.</p></div><div className="actions"><a className="button" href="/messages/quote-drafts">Quote drafts</a><a className="secondary" href="/settings/email">Email settings</a></div></div>
    {query.sent&&<p className="alert goodText">Email sent successfully.</p>}
    {query.deleted&&<p className="alert goodText">Email moved to Trash.</p>}
    {query.error==="delete"&&<p className="alert">Email could not be deleted. Gmail users may need to reconnect the mailbox to grant the new Modify permission.</p>}
    {query.error==="delete-access"&&<p className="alert">You do not have permission to delete messages from that mailbox.</p>}
    {query.error==="send"&&<p className="alert">Email could not be sent. Test the mailbox connection and check the SMTP settings.</p>}
    {query.error==="send-access"&&<p className="alert">You do not have Send access to that mailbox.</p>}
    {query.error==="compose"&&<p className="alert">Recipient, subject, and message are required.</p>}
    <div className="emailLayout">
      <section className="card"><h2>Mailboxes</h2>{accounts.map(account=><a className={`mailboxLink ${selected?.id===account.id?"active":""}`} href={`/messages?account=${encodeURIComponent(account.id)}`} key={account.id}><b>{account.emailAddress}</b><span className="muted">{account.ownerId===user.id?(account.isTeamMailbox?"My team mailbox":"My private mailbox"):"Shared with me"}</span></a>)}{!accounts.length&&<><p className="muted">No mailbox is connected.</p>{canEdit&&<a className="button" href="/settings/email">Connect email</a>}</>}</section>
      <section className="card"><div className="top compact"><h2>{selected?`Inbox · ${selected.emailAddress}`:"Inbox"}</h2>{selected&&canSendPermission&&<form action={scanMailboxForQuotesAction}><input type="hidden" name="accountId" value={selected.id}/><button className="secondary small">Scan inbox for quote requests</button></form>}</div>{inboxError&&<p className="alert">{inboxError}</p>}{messages.map(message=><div className="record mailRow" key={message.id}><a href={`/messages/${encodeURIComponent(selected!.id)}/${encodeURIComponent(message.id)}`}><div><b>{message.unread?"● ":""}{message.subject}</b><div className="muted">{message.from} · {message.date}</div>{message.snippet&&<p>{message.snippet}</p>}</div></a>{canDelete&&<form action={deleteEmailMessageAction}><input type="hidden" name="accountId" value={selected!.id}/><input type="hidden" name="messageId" value={message.id}/><button className="danger small" title="Move email to Trash">Delete</button></form>}</div>)}{selected&&!inboxError&&!messages.length&&<p className="muted">No inbox messages found.</p>}</section>
      <section className="card">{canSend&&selected?<form action={sendEmailAction} className="form"><h2>Compose</h2><input type="hidden" name="accountId" value={selected.id}/><label>From<input value={selected.emailAddress} readOnly/></label><label>To<input name="to" type="email" multiple required defaultValue={query.to||""}/></label><label>CC<input name="cc" type="email" multiple/></label><label>Subject<input name="subject" required defaultValue={query.subject||""}/></label><label>Message<textarea name="body" rows={12} required/></label><button>Send email</button></form>:<><h2>Compose</h2><p className="muted">{selected?"You have Read access but not Send access for this mailbox.":"Connect a mailbox before composing."}</p></>}</section>
    </div>
    {selected&&selected.ownerId===user.id&&canEdit&&<section className="card section"><h2>Sharing</h2><form action={setTeamMailboxAction} className="inlineForm"><input type="hidden" name="id" value={selected.id}/><label className="check"><input type="checkbox" name="isTeamMailbox" defaultChecked={selected.isTeamMailbox}/> Make this a team mailbox that the OWNER can assign to users</label><button className="small">Save sharing</button></form></section>}
  </>;
}
