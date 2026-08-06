import { db } from "@/lib/db";
import { PermissionKey } from "@prisma/client";
import { requirePermission, userAllows } from "@/lib/permissions";
import { createPriceSourceAction, deletePriceSourceAction, refreshPriceSourceAction } from "@/app/actions";
import { money } from "@/lib/money";
export const dynamic="force-dynamic";

export default async function PricingPage(){
  const actor=await requirePermission(PermissionKey.PRICING_VIEW);
  const canEdit=await userAllows(actor.id,actor.role,PermissionKey.PRICING_EDIT);
  const sources=await db.materialPriceSource.findMany({include:{prices:{orderBy:{observedAt:"desc"},take:1}},orderBy:{name:"asc"}});
  return <><div className="top"><div><h1>Market Material Pricing</h1><p className="muted">Track supplier prices through approved JSON feeds or manual market checks. TITAN records the source and observation time; it does not scrape retailer websites.</p></div></div>
  <div className="two"><section className="card"><h2>Price sources</h2>{sources.map(source=>{const latest=source.prices[0];return <div className="record" key={source.id}><b>{source.name}</b><div className="muted">{source.materialType||"PLA"} · {source.sourceType} · {latest?`${money(latest.priceCents)} / ${latest.spoolGrams} g`:"No price yet"}</div>{source.lastError&&<p className="alert">{source.lastError}</p>}{canEdit&&<><form action={refreshPriceSourceAction} className="inlineForm"><input type="hidden" name="id" value={source.id}/>{source.sourceType==="MANUAL"&&<input name="manualPrice" type="number" min="0.01" step="0.01" placeholder="Current CAD price" required/>}<button>Refresh price</button></form><form action={deletePriceSourceAction}><input type="hidden" name="id" value={source.id}/><button className="danger small">Delete source</button></form></>}</div>})}{!sources.length&&<p className="muted">No price sources are available.</p>}</section>
  {canEdit&&<form action={createPriceSourceAction} className="card form"><h2>Add source</h2><label>Supplier name<input name="name" placeholder="Example Filament Supplier" required/></label><label>Source type<select name="sourceType" defaultValue="MANUAL"><option value="MANUAL">Manual market check</option><option value="JSON_FEED">Approved JSON feed</option></select></label><div className="formRow"><label>Material<input name="materialType" defaultValue="PLA"/></label><label>Brand<input name="brand"/></label></div><div className="formRow"><label>Spool grams<input name="spoolGrams" type="number" defaultValue="1000"/></label><label>Currency<input name="currency" defaultValue="CAD"/></label></div><label>HTTPS JSON endpoint<input name="endpointUrl" type="url" placeholder="https://supplier.example/api/product"/></label><label>Price JSON path<input name="priceJsonPath" placeholder="product.price"/></label><button className="button">Add price source</button></form>}</div></>;
}
