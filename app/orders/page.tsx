import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { customerRelationWhere } from "@/lib/customer-access";
import { requirePermission } from "@/lib/permissions";
import { recordPayment, updateOrder, createShipment, deleteOrder, deletePayment, deleteShipment } from "@/app/actions";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function Orders({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requirePermission(PermissionKey.ORDERS_VIEW);
  const q = await searchParams;
  const orders = await db.order.findMany({
    where: customerRelationWhere(actor),
    orderBy: { createdAt: "desc" },
    include: { customer: true, payments: true, shipments: true, jobs: true },
  });
  return <><div className="top"><div><h1>Orders & Fulfilment</h1><p className="muted">Edit orders, payments, and shipments for customers available to your profile.</p></div></div>{q.error==="financial"&&<p className="alert">Orders with payments or shipments cannot be deleted. Remove those records first or cancel the order.</p>}<div className="stack">{orders.map(o=><section className="card" key={o.id}><div className="quote"><div><h2>{o.number}</h2><b>{o.customer.name}</b><p className="muted">Total {money(o.totalCents)} • Paid {money(o.paidCents)} • {o.jobs.length} job(s)</p></div><span className="pill">{o.status}</span></div><form action={updateOrder} className="inlineForm"><input type="hidden" name="id" value={o.id}/><select name="status" defaultValue={o.status}>{["AWAITING_PAYMENT","PAID","QUEUED","PRINTING","QUALITY_CHECK","READY","SHIPPED","COMPLETED","CANCELLED"].map(x=><option key={x}>{x}</option>)}</select><input name="total" type="number" step="0.01" defaultValue={(o.totalCents/100).toFixed(2)} aria-label="Order total"/><input name="dueDate" type="date" defaultValue={o.dueDate?o.dueDate.toISOString().slice(0,10):""}/><button className="secondary small">Save order</button><ConfirmDelete action={deleteOrder} id={o.id} message="Delete this order? Orders with payments or shipments are protected."/></form><form action={recordPayment} className="inlineForm"><input type="hidden" name="orderId" value={o.id}/><input name="amount" type="number" step="0.01" placeholder="Payment amount" required/><select name="provider"><option>MANUAL</option><option>SQUARE</option><option>E_TRANSFER</option><option>CASH</option></select><input name="notes" placeholder="Payment note"/><button className="button small">Record payment</button></form>{o.payments.map(p=><div className="lineItem" key={p.id}><span>{p.provider} · {money(p.amountCents)} · {p.status}</span><ConfirmDelete action={deletePayment} id={p.id} message="Delete this payment and reduce the order paid total? Owner access required."/></div>)}<form action={createShipment} className="inlineForm"><input type="hidden" name="orderId" value={o.id}/><select name="carrier"><option>CANADA_POST</option><option>UPS</option><option>FEDEX</option><option>LOCAL_PICKUP</option></select><input name="service" placeholder="Service"/><input name="trackingNumber" placeholder="Tracking number"/><button className="secondary small">Add shipment</button></form>{o.shipments.map(x=><div className="lineItem" key={x.id}><span>{x.carrier}: {x.trackingNumber||"No tracking yet"} ({x.status})</span><ConfirmDelete action={deleteShipment} id={x.id} message="Delete this shipment record?"/></div>)}</section>)}{!orders.length&&<div className="card muted">No orders are available to this profile.</div>}</div></>;
}
