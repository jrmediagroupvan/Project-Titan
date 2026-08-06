import { db } from "@/lib/db";
import { PermissionKey } from "@prisma/client";
import { requirePermission, userAllows } from "@/lib/permissions";
import { decryptSecret } from "@/lib/crypto";
import { createPortalAccessAction, revokePortalAccessAction } from "@/app/actions";
import { customerRelationWhere, customerWhere } from "@/lib/customer-access";
export const dynamic="force-dynamic";

export default async function CustomerPortalAdmin(){
  const actor=await requirePermission(PermissionKey.PORTAL_VIEW);
  const canEdit=await userAllows(actor.id,actor.role,PermissionKey.PORTAL_EDIT);
  const [customers,tokens]=await Promise.all([
    db.customer.findMany({where:customerWhere(actor),orderBy:{name:"asc"}}),
    db.portalAccessToken.findMany({where:customerRelationWhere(actor),include:{customer:true},orderBy:{createdAt:"desc"}}),
  ]);
  const base=process.env.TITAN_BASE_URL||"http://localhost:1200";
  return <><div className="top"><div><h1>Customer Portal</h1><p className="muted">Create expiring, revocable access links for customers to view their quotes, orders, payments, shipments, and production status.</p></div></div><div className="two"><section className="card"><h2>Access links</h2>{tokens.map(token=>{const active=!token.revokedAt&&(!token.expiresAt||token.expiresAt>new Date());let raw="";try{raw=decryptSecret(token.encryptedToken)}catch{}return <div className="record" key={token.id}><b>{token.customer.name}</b><div className="muted">{token.label} · {active?"Active":"Inactive"} · expires {token.expiresAt?.toLocaleDateString("en-CA")||"never"}</div>{active&&raw&&<input readOnly value={`${base}/portal/${raw}`}/>} {canEdit&&<form action={revokePortalAccessAction}><input type="hidden" name="id" value={token.id}/><button className="danger small" disabled={!active}>Revoke</button></form>}</div>})}{!tokens.length&&<p className="muted">No customer access links yet.</p>}</section>{canEdit&&<form action={createPortalAccessAction} className="card form"><h2>New access link</h2><label>Customer<select name="customerId" required><option value="">Select customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Label<input name="label" defaultValue="Customer access"/></label><label>Expires after days<input name="expiresDays" type="number" min="1" defaultValue="90"/></label><button className="button">Create secure link</button></form>}</div></>;
}
