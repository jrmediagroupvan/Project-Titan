import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { customerRelationWhere } from "@/lib/customer-access";
import { requirePermission } from "@/lib/permissions";
import { updateJob, createPrinter, updatePrinter, deletePrinter, deleteProductionJob } from "../actions";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function Production({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requirePermission(PermissionKey.PRODUCTION_VIEW);
  const q = await searchParams;
  const [jobs, printers] = await Promise.all([
    db.productionJob.findMany({
      where: { order: customerRelationWhere(actor) },
      orderBy: { createdAt: "desc" },
      include: { order: { include: { customer: true } }, printer: true },
    }),
    db.printer.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <><div className="top"><div><h1>Production</h1><p className="muted">Manage print jobs available to your customer profile.</p></div></div>{q.error&&<p className="alert">This item cannot be deleted while it is linked to active production data.</p>}<div className="two"><section className="card"><h2>Job queue</h2>{jobs.map(j=><article className="quote" key={j.id}><div><b>{j.order.number}</b> · {j.order.customer.name}<div className="muted">{j.printer?.name||"Unassigned"}</div></div><form action={updateJob} className="actions"><input type="hidden" name="id" value={j.id}/><select name="status" defaultValue={j.status}><option>QUEUED</option><option>PRINTING</option><option>QUALITY_CHECK</option><option>READY</option><option>COMPLETED</option><option>CANCELLED</option></select><select name="printerId" defaultValue={j.printerId||""}><option value="">No printer</option>{printers.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input name="notes" defaultValue={j.notes||""} placeholder="Job notes"/><button className="button small">Save</button></form><ConfirmDelete action={deleteProductionJob} id={j.id} message="Delete this queued or cancelled production job?"/></article>)}{!jobs.length&&<p className="muted">No production jobs are available to this profile.</p>}</section><section className="stack"><form action={createPrinter} className="card form"><h2>Add printer</h2><label>Printer name<input name="name" required placeholder="Bambu X1C #1"/></label><label>Model<input name="model" placeholder="Bambu Lab X1 Carbon"/></label><button className="button">Add printer</button></form><div className="card"><h2>Printers</h2>{printers.map(p=><details className="record" key={p.id}><summary><b>{p.name}</b> <span className="muted">{p.model||""} · {p.active?"Active":"Disabled"}</span></summary><form action={updatePrinter} className="form editForm"><input type="hidden" name="id" value={p.id}/><input name="name" defaultValue={p.name} required/><input name="model" defaultValue={p.model||""}/><textarea name="notes" defaultValue={p.notes||""}/><label className="check"><input type="checkbox" name="active" defaultChecked={p.active}/> Active</label><div className="actions"><button className="button small">Save changes</button><ConfirmDelete action={deletePrinter} id={p.id} message="Delete this printer? Printers linked to jobs cannot be deleted."/></div></form></details>)}</div></section></div></>;
}
