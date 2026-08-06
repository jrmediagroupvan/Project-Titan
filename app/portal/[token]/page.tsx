import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import CustomerAiChat from "@/components/CustomerAiChat";
import { loadAiConfiguration } from "@/lib/ai";
export const dynamic="force-dynamic";

export default async function CustomerPortal({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const record=await db.portalAccessToken.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},include:{customer:{include:{quotes:{orderBy:{createdAt:"desc"}},orders:{orderBy:{createdAt:"desc"},include:{payments:true,shipments:true,jobs:true}}}}}});
  if(!record||record.revokedAt||(record.expiresAt&&record.expiresAt<=new Date()))notFound();
  await db.portalAccessToken.update({where:{id:record.id},data:{lastUsedAt:new Date()}});
  const customer=record.customer;
  let customerAi=false;try{customerAi=(await loadAiConfiguration()).customerPortalEnabled===true}catch{}
  return <main className="portalPage"><div className="brand big">PROJECT <span>TITAN</span></div><h1>Welcome, {customer.name}</h1><p className="muted">Your quotes, orders, payments, shipping, and production progress.</p>{customerAi&&<CustomerAiChat token={token}/>}<section className="card section"><h2>Quotes</h2>{customer.quotes.map(quote=><div className="lineItem" key={quote.id}><span>{quote.number} · {quote.status}</span><b>{money(quote.totalCents)}</b></div>)}{!customer.quotes.length&&<p className="muted">No quotes yet.</p>}</section><section className="card section"><h2>Orders</h2>{customer.orders.map(order=><article className="record" key={order.id}><div className="top"><b>{order.number}</b><span className="pill">{order.status}</span></div><div>Total: {money(order.totalCents)} · Paid: {money(order.paidCents)}</div>{order.jobs.map(job=><div className="muted" key={job.id}>Production: {job.status}</div>)}{order.shipments.map(shipment=><div className="muted" key={shipment.id}>Shipping: {shipment.status}{shipment.trackingNumber?` · ${shipment.trackingNumber}`:""}</div>)}</article>)}{!customer.orders.length&&<p className="muted">No orders yet.</p>}</section></main>;
}
