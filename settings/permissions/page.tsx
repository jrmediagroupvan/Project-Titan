import { FeatureCategory, PermissionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authorization";
import { FEATURE_LABELS } from "@/lib/features";
import { roleAllows } from "@/lib/permissions";
import { setUserFeatureAccessAction, setUserPermissionAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  await requireOwner();
  const users = await db.user.findMany({
    where: { role: { not: "OWNER" } },
    include: { permissions: true, featureCategories: true },
    orderBy: { name: "asc" },
  });
  const categories = Object.values(FeatureCategory);
  const permissions = Object.values(PermissionKey);

  return (
    <>
      <h1>Feature Categories & Permissions</h1>
      <p className="muted">
        Choose which TITAN sections each user can open. Detailed permissions then decide
        whether the user can view, edit, or delete information inside those assigned sections.
      </p>
      <div className="stack">
        {users.map((user) => {
          const assigned = new Set(user.featureCategories.map((row) => row.category));
          return (
            <section className="card" key={user.id}>
              <h2>{user.name} <span className="muted">· {user.role}</span></h2>
              <form action={setUserFeatureAccessAction} className="form">
                <input type="hidden" name="userId" value={user.id} />
                <label>
                  Feature access
                  <select name="featureAccessMode" defaultValue={user.featureAccessMode}>
                    <option value="ASSIGNED">Assigned categories only</option>
                    <option value="ALL">All TITAN features</option>
                  </select>
                </label>
                <div className="permissionGrid">
                  {categories.map((category) => (
                    <label className="permissionRow" key={category}>
                      <input
                        type="checkbox"
                        name="categories"
                        value={category}
                        defaultChecked={assigned.has(category)}
                      />
                      <span>{FEATURE_LABELS[category]}</span>
                    </label>
                  ))}
                </div>
                <button>Save feature categories</button>
              </form>

              <details className="record">
                <summary><b>Detailed view, edit, and delete permissions</b></summary>
                <p className="muted">
                  An allowed permission works only when its feature category is also assigned.
                </p>
                <div className="permissionGrid">
                  {permissions.map((permission) => {
                    const override = user.permissions.find((item) => item.permission === permission);
                    const selected = override ? (override.allowed ? "allow" : "deny") : "default";
                    return (
                      <form action={setUserPermissionAction} className="permissionRow" key={permission}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="permission" value={permission} />
                        <span>{permission.replaceAll("_", " ").toLowerCase()}</span>
                        <select name="mode" defaultValue={selected}>
                          <option value="default">
                            Role default ({roleAllows(user.role, permission) ? "allow" : "deny"})
                          </option>
                          <option value="allow">Allow</option>
                          <option value="deny">Deny</option>
                        </select>
                        <button className="small">Save</button>
                      </form>
                    );
                  })}
                </div>
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
