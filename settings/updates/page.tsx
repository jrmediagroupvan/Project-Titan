import { startTitanUpdateAction } from "@/app/actions";
import { requireOwner } from "@/lib/authorization";
import { getTitanUpdateStatus } from "@/lib/updater";
import packageInfo from "@/package.json";

export const dynamic="force-dynamic";

export default async function UpdatesPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireOwner();
  const [status,params]=await Promise.all([getTitanUpdateStatus(),searchParams]);
  const repository=process.env.TITAN_GIT_REPOSITORY||"Not configured";
  return <><div className="top"><div><h1>TITAN Updates</h1><p className="muted">OWNER-only GitHub updates with backup, database update, rebuild, health check and rollback.</p></div></div>
    {params.started&&<div className="alert goodText">The update started. TITAN may be unavailable briefly while the app rebuilds and restarts.</div>}
    {params.error&&<div className="alert">{params.error}</div>}
    <section className="card section"><h2>Installed release</h2><div className="value">v{packageInfo.version}</div><p>Repository: <code>{repository}</code></p><p>Branch: <code>{process.env.TITAN_UPDATE_BRANCH||"main"}</code></p></section>
    <section className="card section"><h2>One-click update</h2>
      <p>This downloads committed files from the configured GitHub repository. Before changing anything, TITAN refuses a mismatched repository or uncommitted server changes and creates a backup.</p>
      <p>Status: <strong>{status.state}</strong>{status.startedAt?` · started ${new Date(status.startedAt).toLocaleString()}`:""}{status.finishedAt?` · finished ${new Date(status.finishedAt).toLocaleString()}`:""}</p>
      {status.message&&<div className="alert">{status.message}</div>}
      {status.log?.length?<pre className="result">{status.log.join("\n")}</pre>:null}
      <div className="actions section">
        <form action={startTitanUpdateAction}><button type="submit" className="button" disabled={status.state==="running"||status.state==="unavailable"}>{status.state==="running"?"Update running…":"Update TITAN from GitHub"}</button></form>
        <a className="secondary" href="/settings/updates">Refresh status</a>
      </div>
    </section>
    <section className="card section"><h2>Terminal fallback</h2><pre>sudo ./scripts/titan update</pre><p className="muted">The update button requires the dedicated updater service, TITAN_PROJECT_DIR, TITAN_UPDATE_TOKEN, and access to the Docker socket. Keep TITAN on a private trusted network.</p></section>
  </>;
}
