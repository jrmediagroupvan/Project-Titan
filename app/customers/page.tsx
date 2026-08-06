import { PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessAllCustomers, customerWhere } from "@/lib/customer-access";
import { requirePermission, userAllows } from "@/lib/permissions";
import { createCustomer, safeDeleteCustomer, updateCustomer } from "../actions";
import ConfirmDelete from "@/components/ConfirmDelete";

export const dynamic = "force-dynamic";

export default async function Customers() {
  const actor = await requirePermission(PermissionKey.CUSTOMERS_VIEW);
  const canManageAssignments = actor.role === "OWNER" || actor.role === "ADMIN";
  const [canCreate, canEdit, canDelete, rows, users] = await Promise.all([
    userAllows(actor.id, actor.role, PermissionKey.CUSTOMERS_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.CUSTOMERS_EDIT),
    userAllows(actor.id, actor.role, PermissionKey.CUSTOMERS_DELETE),
    db.customer.findMany({
      where: customerWhere(actor),
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { quotes: true, orders: true, uploads: true } },
      },
    }),
    canManageAssignments
      ? db.user.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Customers</h1>
          <p className="muted">
            {canAccessAllCustomers(actor)
              ? "You can view all customer profiles."
              : "Private workspace: only customers assigned to you are shown."}
          </p>
        </div>
        {canDelete && <span className="pill good">Delete controls enabled</span>}
      </div>

      <div className="two">
        <section className="card">
          <h2>Customer list</h2>
          {rows.map((customer) => (
            <div className="customerRow" key={customer.id}>
              <details className="record">
                <summary>
                  <b>{customer.name}</b>{" "}
                  <span className="muted">
                    {customer.company || ""} · {customer._count.quotes} quotes ·{" "}
                    {customer._count.orders} orders · {customer._count.uploads} files · Assigned to{" "}
                    {customer.assignedTo?.name || "nobody"}
                  </span>
                </summary>
                {canEdit ? (
                  <form action={updateCustomer} className="form editForm">
                    <input type="hidden" name="id" value={customer.id} />
                    <div className="formRow">
                      <label>
                        Name
                        <input name="name" defaultValue={customer.name} required />
                      </label>
                      <label>
                        Company
                        <input name="company" defaultValue={customer.company || ""} />
                      </label>
                    </div>
                    <div className="formRow">
                      <label>
                        Email
                        <input name="email" type="email" defaultValue={customer.email || ""} />
                      </label>
                      <label>
                        Phone
                        <input name="phone" defaultValue={customer.phone || ""} />
                      </label>
                    </div>
                    {canManageAssignments && (
                      <label>
                        Assigned user
                        <select name="assignedToId" defaultValue={customer.assignedToId || ""}>
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Notes
                      <textarea name="notes" rows={3} defaultValue={customer.notes || ""} />
                    </label>
                    <div className="actions">
                      <button className="button small">Save changes</button>
                    </div>
                  </form>
                ) : (
                  <div className="form editForm">
                    <p><b>Email:</b> {customer.email || "—"}</p>
                    <p><b>Phone:</b> {customer.phone || "—"}</p>
                    <p><b>Notes:</b> {customer.notes || "—"}</p>
                  </div>
                )}
              </details>
              {canDelete && (
                <ConfirmDelete
                  action={safeDeleteCustomer}
                  id={customer.id}
                  message={`Permanently delete ${customer.name} and all linked CRM records? This cannot be undone.`}
                >
                  Delete customer
                </ConfirmDelete>
              )}
            </div>
          ))}
          {!rows.length && <p className="muted">No customers are assigned to this profile yet.</p>}
        </section>

        {canCreate && (
          <form action={createCustomer} className="card form">
            <h2>Add customer</h2>
            <label>Name<input name="name" required /></label>
            <label>Company<input name="company" /></label>
            <label>Email<input name="email" type="email" /></label>
            <label>Phone<input name="phone" /></label>
            {canManageAssignments && (
              <label>
                Assign to
                <select name="assignedToId" defaultValue={actor.id}>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>Notes<textarea name="notes" rows={4} /></label>
            <button className="button">Save customer</button>
          </form>
        )}
      </div>
    </>
  );
}
