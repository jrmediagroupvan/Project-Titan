import UpdateCenterClient from "@/components/UpdateCenterClient";
import { requireOwner } from "@/lib/authorization";

export default async function UpdateCenterPage() {
  await requireOwner();

  return (
    <>
      <h1>TITAN Update Center</h1>
      <p className="muted">
        Install the newest validated Project TITAN release from GitHub without
        using SSH or manually running Docker commands.
      </p>

      <UpdateCenterClient />

      <section className="card">
        <h2>Protected data</h2>
        <p>
          The updater preserves <code>.env</code>, PostgreSQL data, uploads,
          storage, and backups. It never uses{" "}
          <code>docker compose down -v</code>.
        </p>
      </section>
    </>
  );
}
