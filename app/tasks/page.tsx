import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessAllCustomers, customerWhere } from "@/lib/customer-access";
import { requirePermission } from "@/lib/permissions";
import { createTask, updateTask, deleteTask } from "@/app/actions";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function Tasks() {
  const actor = await requirePermission(PermissionKey.TASKS_VIEW);
  const taskWhere = canAccessAllCustomers(actor)
    ? {}
    : { OR: [{ customer: { assignedToId: actor.id } }, { customerId: null, assignedToId: actor.id }] };
  const [tasks, users, customers] = await Promise.all([
    db.task.findMany({
      where: taskWhere,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { assignedTo: true, customer: true },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.customer.findMany({ where: customerWhere(actor), orderBy: { name: "asc" } }),
  ]);
  return <><h1>Tasks</h1><div className="two"><section className="card"><h2>{canAccessAllCustomers(actor)?"Team task board":"My customer tasks"}</h2>{tasks.map(t=><details className="record" key={t.id}><summary><b>{t.title}</b> <span className="muted">{t.status} · {t.assignedTo?.name||"Unassigned"}</span></summary><form action={updateTask} className="form editForm"><input type="hidden" name="id" value={t.id}/><input name="title" defaultValue={t.title} required/><textarea name="description" defaultValue={t.description||""}/><div className="formRow"><select name="priority" defaultValue={t.priority}>{["LOW","NORMAL","HIGH","URGENT"].map(x=><option key={x}>{x}</option>)}</select><select name="status" defaultValue={t.status}>{["OPEN","IN_PROGRESS","BLOCKED","DONE","CANCELLED"].map(x=><option key={x}>{x}</option>)}</select></div><select name="assignedToId" defaultValue={t.assignedToId||""}><option value="">Unassigned</option>{users.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select><select name="customerId" defaultValue={t.customerId||""}><option value="">Internal task</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><input type="date" name="dueAt" defaultValue={t.dueAt?t.dueAt.toISOString().slice(0,10):""}/><div className="actions"><button className="button small">Save changes</button><ConfirmDelete action={deleteTask} id={t.id}/></div></form></details>)}{!tasks.length&&<p className="muted">No tasks are available to this profile.</p>}</section><form action={createTask} className="card form"><h2>Create task</h2><input name="title" placeholder="Task title" required/><textarea name="description" placeholder="Details"/><select name="priority"><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>LOW</option></select><select name="assignedToId" defaultValue={actor.id}><option value="">Unassigned</option>{users.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select><select name="customerId"><option value="">Internal task</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><input type="date" name="dueAt"/><button className="button">Create task</button></form></div></>;
}
