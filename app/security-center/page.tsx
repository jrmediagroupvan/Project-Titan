import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authorization";

export default async function Page(){
  await requireOwner();
  const [users,keys,hooks,mailboxes,events,twoFactorCount,recentFailures]=await Promise.all([
    db.user.findMany({select:{id:true,email:true,role:true,active:true,lastLoginAt:true,mustChangePassword:true,twoFactorCredential:{select:{enabled:true}}}}),
    db.apiCredential.count({where:{active:true}}),
    db.webhookEndpoint.count({where:{active:true}}),
    db.emailAccount.count(),
    db.auditEvent.findMany({orderBy:{createdAt:"desc"},take:20}),
    db.twoFactorCredential.count({where:{enabled:true}}),
    db.loginAttempt.count({where:{successful:false,createdAt:{gte:new Date(Date.now()-24*60*60*1000)}}}),
  ]);
  const forced=users.filter(u=>u.mustChangePassword).length;
  return <>
    <h1>TITAN Security Center</h1><p className="muted">A single view of identities, two-step verification, secrets, integrations and sensitive activity.</p>
    <div className="stats"><div className="stat"><span>Active users</span><b>{users.filter(u=>u.active).length}</b></div><div className="stat"><span>2FA protected</span><b>{twoFactorCount}</b></div><div className="stat"><span>Failed logins · 24h</span><b>{recentFailures}</b></div><div className="stat"><span>Password changes due</span><b>{forced}</b></div><div className="stat"><span>Active API keys</span><b>{keys}</b></div><div className="stat"><span>Active webhooks</span><b>{hooks}</b></div><div className="stat"><span>Email accounts</span><b>{mailboxes}</b></div></div>
    <div className="two"><section className="card"><h2>User posture</h2>{users.map(u=><div className="lineItem" key={u.id}><span>{u.email} · {u.role}<small>{u.twoFactorCredential?.enabled?"Authenticator protected":"2FA not enabled"}</small></span><span>{!u.active?"Disabled":u.mustChangePassword?"Password change required":"Active"}</span></div>)}</section><section className="card"><h2>Recent sensitive activity</h2>{events.map(e=><div className="lineItem" key={e.id}><span>{e.action}</span><span>{e.createdAt.toLocaleString()}</span></div>)}</section></div>
    <div className="card"><h2>Recommended controls</h2><p>Use HTTPS and set COOKIE_SECURE=true before exposing TITAN externally. Require two-step verification for privileged users, rotate exposed secrets, keep private mailboxes non-shared, and test backups regularly.</p></div>
  </>;
}
