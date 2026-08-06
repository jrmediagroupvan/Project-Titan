import { db } from "@/lib/db";
import { requirePermission, userAllows } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import { disconnectEmailAccountAction, saveEmailQuoteSettingsAction, setMailboxAccessAction, testEmailAccountAction } from "@/app/actions";
import EmailAccountForm from "@/components/EmailAccountForm";
import ConfirmDelete from "@/components/ConfirmDelete";
export const dynamic="force-dynamic";

export default async function EmailSettingsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const me=await requirePermission(PermissionKey.EMAIL_VIEW);
  const query=await searchParams;
  const [canEdit,canDelete,accounts,teamAccounts,users]=await Promise.all([
    userAllows(me.id,me.role,PermissionKey.EMAIL_EDIT),
    userAllows(me.id,me.role,PermissionKey.EMAIL_DELETE),
    db.emailAccount.findMany({where:{ownerId:me.id},orderBy:{emailAddress:"asc"}}),
    me.role==="OWNER"?db.emailAccount.findMany({where:{isTeamMailbox:true},include:{access:true,owner:{select:{name:true}}},orderBy:{emailAddress:"asc"}}):Promise.resolve([]),
    me.role==="OWNER"?db.user.findMany({where:{active:true},orderBy:{name:"asc"}}):Promise.resolve([]),
  ]);
  return <><div className="top"><div><h1>Email Settings</h1><p className="muted">Connect a private Gmail account or configure any standard IMAP/SMTP mailbox. Saved passwords are encrypted and are never displayed again.</p></div><a className="secondary" href="/messages">Open My Email</a></div>
    {query.connected&&<p className="alert goodText">Email account saved.</p>}
    {query.updated&&<p className="alert goodText">Email account settings updated.</p>}
    {query.test==="success"&&<p className="alert goodText">SMTP and enabled IMAP connections were tested successfully.</p>}
    {query.test==="failed"&&<p className="alert">Connection test failed. Check the server, port, encryption mode, username, app password, and firewall.</p>}
    {query.error==="invalid"&&<p className="alert">Enter valid email server names and ports.</p>}
    {query.error==="password"&&<p className="alert">A password or provider app password is required.</p>}
    {query.error==="duplicate"&&<p className="alert">That standard email account is already connected.</p>}
    {query.error==="forward"&&<p className="alert">Enter a valid address for quote-review forwarding.</p>}
    {query.error==="access"&&<p className="alert">You cannot change that mailbox.</p>}
    {query.quoteSettings&&<p className="alert goodText">Email-to-quote settings saved.</p>}
    <section className="card section"><h2>My mailboxes</h2>
      {accounts.map(account=><details className="record" key={account.id} open={query.account===account.id}><summary><b>{account.emailAddress}</b> · {account.provider==="GOOGLE"?"Gmail OAuth":`${account.providerPreset||"Custom"} IMAP/SMTP`}</summary>
        <div className="editForm">
          {account.provider==="SMTP"&&canEdit?<EmailAccountForm account={account}/>:<p className="muted">This Gmail account uses Google OAuth. Disconnect and reconnect it to renew authorization.</p>}
          <div className="actions">
            {canEdit&&<form action={testEmailAccountAction}><input type="hidden" name="id" value={account.id}/><button className="secondary small">Test connection</button></form>}
            {canDelete&&<ConfirmDelete action={disconnectEmailAccountAction} id={account.id} message={`Disconnect ${account.emailAddress}? Saved credentials and mailbox sharing will be removed from TITAN.`}/>}
          </div>
          {canEdit&&<form action={saveEmailQuoteSettingsAction} className="form section">
            <input type="hidden" name="id" value={account.id}/>
            <h3>Email-to-quote scanning</h3>
            <label className="check"><input type="checkbox" name="quoteScanEnabled" defaultChecked={account.quoteScanEnabled}/> Enable quote-request scanning for this mailbox</label>
            <label>Forward new quote drafts to me<input type="email" name="quoteForwardTo" defaultValue={account.quoteForwardTo||me.email} placeholder="owner@example.com"/></label>
            <p className="muted">TITAN only forwards a review summary. It will not send a price to the customer until you approve it.</p>
            <button className="small">Save quote scanning</button>
          </form>}
        </div>
      </details>)}
      {!accounts.length&&<p className="muted">You have not connected an email account yet.</p>}
    </section>
    {canEdit&&<div className="two section"><section className="card"><h2>Connect Gmail securely</h2><p className="muted">Uses Google authorization without storing your Google password. Google OAuth must be configured in TITAN&apos;s private environment file.</p><a className="button" href="/api/gmail/connect">Connect Gmail / Google Workspace</a></section><section className="card"><h2>Add IMAP / SMTP account</h2><EmailAccountForm/></section></div>}
    {me.role==="OWNER"&&<section className="card section"><h2>Shared mailbox access</h2><p className="muted">Private user accounts do not appear here. Only mailboxes their owner marks as a team mailbox can be assigned.</p>
      {teamAccounts.map(account=><div className="record" key={account.id}><h3>{account.emailAddress}</h3><p className="muted">Owner: {account.owner.name}</p>{users.map(user=>{const access=account.access.find(x=>x.userId===user.id);return <form action={setMailboxAccessAction} className="permissionRow" key={user.id}><input type="hidden" name="emailAccountId" value={account.id}/><input type="hidden" name="userId" value={user.id}/><span>{user.name}</span><label className="inline"><input type="checkbox" name="enabled" defaultChecked={!!access}/> Read</label><label className="inline"><input type="checkbox" name="canSend" defaultChecked={access?.canSend}/> Send</label><button className="small">Save</button></form>})}</div>)}
      {!teamAccounts.length&&<p className="muted">No team mailboxes are enabled.</p>}
    </section>}
  </>;
}
