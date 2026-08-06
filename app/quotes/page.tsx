import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { customerRelationWhere, customerWhere } from "@/lib/customer-access";
import { requirePermission, userAllows } from "@/lib/permissions";
import { materialRateCatalog } from "@/lib/pricing";
import { createQuote, updateQuote, convertQuoteToOrder, deleteQuote } from "../actions";
import ConfirmDelete from "@/components/ConfirmDelete";
import QuoteBuilder from "@/components/QuoteBuilder";

export const dynamic = "force-dynamic";

export default async function Quotes({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
  const actor = await requirePermission(PermissionKey.QUOTES_VIEW);
  const qsp = await searchParams;
  const catalog = materialRateCatalog();
  const [canCreate, canEdit, canDelete, canCreateOrder, quotes, customers, settings, files] = await Promise.all([
    userAllows(actor.id, actor.role, PermissionKey.QUOTES_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.QUOTES_EDIT),
    userAllows(actor.id, actor.role, PermissionKey.QUOTES_DELETE),
    userAllows(actor.id, actor.role, PermissionKey.ORDERS_CREATE),
    db.quote.findMany({where:customerRelationWhere(actor),orderBy:{createdAt:"desc"},include:{customer:true,items:true,order:true}}),
    db.customer.findMany({where:customerWhere(actor),orderBy:{name:"asc"}}),
    db.businessSetting.findUnique({where:{id:"primary"}}),
    db.customerFile.findMany({where:customerRelationWhere(actor),orderBy:{createdAt:"desc"},take:250,select:{id:true,customerId:true,originalName:true,fileType:true,analysisJson:true}}),
  ]);
  const materialOptions = (selected?: string | null) => (
    <>
      <option value="">Select material</option>
      {selected && !catalog.materials.some((material) => material.code === selected) && (
        <option value={selected}>{selected} (legacy)</option>
      )}
      {catalog.materials.map((material) => (
        <option key={material.code} value={material.code}>
          {material.label} · ${(material.marketCostPerKgCad / 1000).toFixed(3)}/g raw
        </option>
      ))}
    </>
  );

  return (
    <>
      <div className="top">
        <div>
          <h1>Quotes & Orders</h1>
          <p className="muted">
            Material rates come from config/material-rates.json. Automatic quotes include
            material waste, machine time, setup, the minimum job price, and your markup.
          </p>
        </div>
      </div>
      {qsp.success==="created-from-slice"&&<p className="alert goodText">Draft quote created from the Bambu Studio slice. Review every price and setting before sending it to the customer.</p>}
      {qsp.error==="ordered"&&<p className="alert">Quotes already converted to orders cannot be edited or deleted.</p>}
      {qsp.error==="manual-price"&&<p className="alert">Enter a manual unit price, or choose Automatic pricing.</p>}
      {qsp.error==="below-cost"&&<p className="alert">That manual price is below the calculated cost. Review the price and select “Allow below-cost price” only if this is intentional.</p>}
      <div className="two">
        <section className="card">
          <h2>Quotes</h2>
          {quotes.map(q => {
            const item=q.items[0];
            const taxRate=q.subtotalCents?Math.round(q.taxCents/q.subtotalCents*10000)/100:0;
            return (
              <details className="record" key={q.id}>
                <summary>
                  <b>{q.number}</b> · {q.customer.name}{" "}
                  <span className="muted">{money(q.totalCents)} · {q.status}</span>
                </summary>
                {canEdit ? (
                  <form action={updateQuote} className="form editForm">
                    <input type="hidden" name="id" value={q.id}/>
                    <label>Customer<select name="customerId" defaultValue={q.customerId}>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                    <label>Description<input name="description" defaultValue={item?.description||""} required/></label>
                    <div className="formRow">
                      <label>Quantity<input name="quantity" type="number" min="1" defaultValue={item?.quantity||1}/></label>
                      <label>Pricing method<select name="pricingMode" defaultValue={item?.priceSource==="MANUAL_OVERRIDE"?"MANUAL":"AUTO"}><option value="AUTO">Automatic pricing</option><option value="MANUAL">Manual override</option></select></label>
                    </div>
                    <label>Manual unit price (CAD)<input name="unitPrice" type="number" min="0" step="0.01" defaultValue={item?.priceSource==="MANUAL_OVERRIDE"?((item?.unitPriceCents||0)/100).toFixed(2):""} placeholder="Only used with Manual override"/></label>
                    <div className="formRow">
                      <label>Tax %<input name="taxRate" type="number" step="0.01" defaultValue={taxRate}/></label>
                      <label>Status<select name="status" defaultValue={q.status}>{["DRAFT","SENT","VIEWED","APPROVED","DECLINED","EXPIRED","INVOICED"].map(x=><option key={x}>{x}</option>)}</select></label>
                    </div>
                    <div className="formRow">
                      <label>Material<select name="material" defaultValue={item?.material||""}>{materialOptions(item?.material)}</select></label>
                      <label>Colour<input name="colour" defaultValue={item?.colour||""}/></label>
                    </div>
                    <div className="formRow">
                      <label>Estimated grams per item<input name="estimatedGrams" type="number" step="0.1" defaultValue={item?.estimatedGrams||""}/></label>
                      <label>Estimated minutes per item<input name="estimatedMinutes" type="number" defaultValue={item?.estimatedMinutes||""}/></label>
                    </div>
                    <div className="formRow">
                      <label>Machine hourly rate (CAD)<input name="machineHourlyRate" type="number" min="0" step="0.01" defaultValue={catalog.defaultMachineHourlyRateCad}/></label>
                      <label>Setup fee for whole job (CAD)<input name="setupFee" type="number" min="0" step="0.01" defaultValue={catalog.defaultSetupFeeCad}/></label>
                    </div>
                    <label>Markup %<input name="markupPercent" type="number" min="0" step="0.01" defaultValue={item?.markupPercent??settings?.quoteMarkupPercent??catalog.defaultMarkupPercent}/></label>
                    <label className="check"><input name="allowBelowCost" type="checkbox"/> Allow a manual price below calculated cost</label>
                    <p className="muted">Current calculated cost {money(item?.baseCostCents||0)} per item · selling price {money(item?.unitPriceCents||0)} per item · {item?.priceSource||"legacy pricing"}. Automatic pricing recalculates when you save.</p>
                    <label>Notes<textarea name="notes" defaultValue={q.notes||""}/></label>
                    <div className="actions">
                      <button className="button small" disabled={!!q.order}>Save changes</button>
                      {canDelete&&!q.order&&<ConfirmDelete action={deleteQuote} id={q.id}/>}
                    </div>
                  </form>
                ) : (
                  <div className="form editForm">
                    <p><b>Description:</b> {item?.description||"—"}</p>
                    <p><b>Material:</b> {item?.material||"—"} · <b>Weight:</b> {item?.estimatedGrams||0} g</p>
                    <p><b>Unit price:</b> {money(item?.unitPriceCents||0)} · <b>Tax:</b> {taxRate}%</p>
                    <p><b>Notes:</b> {q.notes||"—"}</p>
                  </div>
                )}
                {!q.order&&canCreateOrder ? (
                  <form action={convertQuoteToOrder}>
                    <input type="hidden" name="id" value={q.id}/>
                    <button className="secondary small">Create order</button>
                  </form>
                ) : q.order ? <span className="pill good">Order {q.order.number}</span> : null}
              </details>
            );
          })}
          {!quotes.length&&<p className="muted">No quotes are available to this profile.</p>}
        </section>

      </div>
      {canCreate&&<section className="section"><QuoteBuilder
        customers={customers.map(customer=>({id:customer.id,name:customer.name}))}
        files={files.map(file=>{
          const analysis=file.analysisJson&&typeof file.analysisJson==="object"&&!Array.isArray(file.analysisJson)?file.analysisJson as Record<string,unknown>:{};
          const slice=analysis.sliceEstimate&&typeof analysis.sliceEstimate==="object"&&!Array.isArray(analysis.sliceEstimate)?analysis.sliceEstimate as Record<string,unknown>:null;
          const sliceQuantity=Math.max(1,Number(slice?.quantity)||1);
          return {id:file.id,customerId:file.customerId,name:file.originalName,fileType:file.fileType,gramsPerItem:slice?Number(slice.materialGrams||0)/sliceQuantity:undefined,minutesPerItem:slice?Number(slice.totalTimeSeconds||0)/60/sliceQuantity:undefined};
        })}
        materials={catalog.materials}
        defaults={{markup:settings?.quoteMarkupPercent??catalog.defaultMarkupPercent,tax:settings?.taxRate??12,hourlyRate:catalog.defaultMachineHourlyRateCad,setupFee:catalog.defaultSetupFeeCad,minimumQuote:catalog.minimumQuoteCad}}
      /></section>}
    </>
  );
}
