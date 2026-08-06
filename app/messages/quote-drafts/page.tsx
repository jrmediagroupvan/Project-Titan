import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { materialRateCatalog } from "@/lib/pricing";
import { requirePermission, userAllows } from "@/lib/permissions";
import {
  approveAndSendEmailQuoteAction,
  createQuoteFromEmailDraftAction,
  dismissEmailQuoteDraftAction,
  forwardEmailQuoteDraftAction,
  updateEmailQuoteDraftAction,
} from "@/app/actions";

export const dynamic="force-dynamic";

export default async function EmailQuoteDrafts({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requirePermission(PermissionKey.EMAIL_VIEW);
  const query=await searchParams;
  const [canEdit,canCreate,canSend,drafts]=await Promise.all([
    userAllows(user.id,user.role,PermissionKey.QUOTES_EDIT),
    userAllows(user.id,user.role,PermissionKey.QUOTES_CREATE),
    userAllows(user.id,user.role,PermissionKey.EMAIL_CREATE),
    db.emailQuoteDraft.findMany({
      where:{ownerId:user.id,status:{not:"DISMISSED"}},
      include:{emailAccount:true,quote:{include:{items:true}}},
      orderBy:{createdAt:"desc"},
    }),
  ]);
  const catalog=materialRateCatalog();
  return <><div className="top"><div><h1>Email Quote Drafts</h1><p className="muted">Review extracted details before TITAN creates or sends a customer quote.</p></div><a className="secondary" href="/messages">Back to email</a></div>
    {query.created&&<p className="alert goodText">A new quote draft was created from the email.</p>}
    {query.duplicate&&<p className="alert">That email was already scanned or was not recognized as a quote request.</p>}
    {query.scanned!==undefined&&<p className="alert goodText">Inbox scan created {query.scanned} new draft(s) and forwarded {query.forwarded||0} review notification(s).</p>}
    {query.saved&&<p className="alert goodText">Quote draft saved.</p>}
    {query.quoteCreated&&<p className="alert goodText">The customer and quote were created as a DRAFT. Nothing was emailed.</p>}
    {query.sent&&<p className="alert goodText">The approved quote was emailed to the customer.</p>}
    {query.forwarded&&<p className="alert goodText">The draft review was forwarded to your configured address.</p>}
    {query.error==="missing"&&<p className="alert">Material, grams, and print minutes must be confirmed before creating a priced quote.</p>}
    {query.error==="send"&&<p className="alert">The quote was created as a draft, but email sending failed. Check SMTP settings and send access.</p>}
    {query.error==="forward-address"&&<p className="alert">Add your quote-forwarding address under Email Settings first.</p>}
    <section className="card">
      {drafts.map(draft=>{
        const item=draft.quote?.items[0];
        return <details id={draft.id} className="record" key={draft.id} open={draft.status==="NEEDS_REVIEW"}>
          <summary><b>{draft.subject}</b> · {draft.senderEmail} <span className={`pill ${draft.status==="READY"?"good":""}`}>{draft.status.replaceAll("_"," ")}</span></summary>
          <div className="quoteDraftGrid">
            <div>
              <p className="muted">Mailbox: {draft.emailAccount.emailAddress} · Detection confidence: {draft.confidence}%</p>
              <p><b>Original email</b></p><pre className="sourceEmail">{draft.sourceText}</pre>
            </div>
            <div>
              {canEdit&&!draft.quote?<form action={updateEmailQuoteDraftAction} className="form editForm">
                <input type="hidden" name="id" value={draft.id}/>
                <div className="formRow"><label>Customer name<input name="senderName" defaultValue={draft.senderName||""}/></label><label>Customer email<input name="senderEmail" type="email" required defaultValue={draft.senderEmail}/></label></div>
                <label>Description<input name="description" required defaultValue={draft.description}/></label>
                <div className="formRow"><label>Quantity<input name="quantity" type="number" min="1" defaultValue={draft.quantity}/></label><label>Material<select name="material" defaultValue={draft.material||""}><option value="">Select material</option>{catalog.materials.map(material=><option key={material.code} value={material.code}>{material.label}</option>)}</select></label></div>
                <div className="formRow"><label>Colour<input name="colour" defaultValue={draft.colour||""}/></label><label>Grams per item<input name="estimatedGrams" type="number" min="0" step=".1" defaultValue={draft.estimatedGrams||""}/></label></div>
                <label>Print minutes per item<input name="estimatedMinutes" type="number" min="0" defaultValue={draft.estimatedMinutes||""}/></label>
                {draft.missingFields.length>0&&<p className="alert">Confirm: {draft.missingFields.join(", ")}</p>}
                <button>Save review</button>
              </form>:<div className="editForm">
                <p><b>{draft.description}</b></p><p>{draft.quantity} × {draft.material||"material needed"} · {draft.colour||"colour not specified"}</p>
                <p>{draft.estimatedGrams??"?"} g · {draft.estimatedMinutes??"?"} min per item</p>
                {draft.quote&&<p className="goodText"><b>{draft.quote.number}</b> · {money(draft.quote.totalCents)} · {draft.quote.status}</p>}
              </div>}
              <div className="actions section">
                {!draft.quote&&canCreate&&draft.status==="READY"&&<form action={createQuoteFromEmailDraftAction}><input type="hidden" name="id" value={draft.id}/><button className="secondary small">Create quote draft only</button></form>}
                {!draft.quote&&canCreate&&canSend&&draft.status==="READY"&&<form action={approveAndSendEmailQuoteAction}><input type="hidden" name="id" value={draft.id}/><button className="small">Approve and email customer</button></form>}
                {canSend&&draft.emailAccount.quoteForwardTo&&<form action={forwardEmailQuoteDraftAction}><input type="hidden" name="id" value={draft.id}/><button className="secondary small">Forward to me</button></form>}
                {canEdit&&!draft.quote&&<form action={dismissEmailQuoteDraftAction}><input type="hidden" name="id" value={draft.id}/><button className="danger small">Dismiss</button></form>}
              </div>
              {item&&<p className="muted">Calculated with {item.markupPercent}% markup and {item.priceSource}.</p>}
            </div>
          </div>
        </details>;
      })}
      {!drafts.length&&<p className="muted">No quote-request drafts yet. Open My Email and scan an inbox or an individual message.</p>}
    </section>
  </>;
}
