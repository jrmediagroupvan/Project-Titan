import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { customerRelationWhere } from "@/lib/customer-access";
import { requireUser } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function Reports() {
  const actor = await requireUser();
  const customerFilter = customerRelationWhere(actor);
  const [orders, quotes, expenses, payments, materials] = await Promise.all([
    db.order.findMany({ where: customerFilter }),
    db.quote.findMany({ where: customerFilter }),
    db.expense.findMany(),
    db.payment.findMany({ where: { status: "PAID", ...customerFilter } }),
    db.material.findMany(),
  ]);
  const sales=payments.reduce((a,x)=>a+x.amountCents,0),costs=expenses.reduce((a,x)=>a+x.amountCents+x.taxCents,0),quoted=quotes.reduce((a,x)=>a+x.totalCents,0),receivable=orders.reduce((a,x)=>a+Math.max(0,x.totalCents-x.paidCents),0),inventory=materials.reduce((a,x)=>a+Math.round(x.gramsOnHand/1000*x.costPerKgCents),0);
  return <><h1>Business Reports</h1><p className="muted">Customer totals are limited to the customers available to your profile.</p><div className="grid"><div className="card">Payments collected<div className="value">{money(sales)}</div></div><div className="card">Recorded expenses<div className="value">{money(costs)}</div></div><div className="card">Gross margin<div className="value">{money(sales-costs)}</div></div><div className="card">Accounts receivable<div className="value">{money(receivable)}</div></div></div><div className="grid section"><div className="card">Quoted pipeline<div className="value">{money(quoted)}</div></div><div className="card">Inventory value<div className="value">{money(inventory)}</div></div><div className="card">Orders<div className="value">{orders.length}</div></div><div className="card">Quotes<div className="value">{quotes.length}</div></div></div><section className="card section"><h2>Commercial reporting status</h2><p>These live totals come from TITAN records. Tax filings, payroll, bank reconciliation and formal accounting exports should still be verified in accounting software.</p></section></>;
}
