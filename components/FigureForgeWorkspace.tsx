"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Download, ImagePlus, LoaderCircle, Sparkles, Trash2, UploadCloud } from "lucide-react";
import ThreeDViewer from "@/components/ThreeDViewer";

type Project = {
  id: string; title: string; style: string; baseStyle: string; nameplateText: string | null;
  instructions: string | null; status: string; errorMessage: string | null; customerId: string | null;
  sourceImageName: string; stlStorageKey: string | null; createdAt: string; updatedAt: string;
  customer: { id: string; name: string } | null;
};

const styles = [
  ["BOBBLEHEAD", "Bobblehead"], ["CHIBI", "Chibi"], ["REALISTIC_BUST", "Realistic bust"],
  ["CARTOON", "Cartoon figure"], ["HERO", "Hero figure"], ["BUSINESS_MASCOT", "Business mascot"],
  ["PET_FIGURINE", "Pet figurine"], ["TROPHY", "Trophy figure"],
];
const bases = [["ROUND", "Round"], ["SQUARE", "Square"], ["HEXAGON", "Hexagon"], ["TROPHY", "Trophy"], ["LOGO", "Logo base"]];

export default function FigureForgeWorkspace({ projects, customers, selectedId, permissions }: {
  projects: Project[]; customers: { id: string; name: string }[]; selectedId: string | null;
  permissions: { canCreate: boolean; canDelete: boolean; canExport: boolean };
}) {
  const router = useRouter();
  const selected = useMemo(() => projects.find((item) => item.id === selectedId) || null, [projects, selectedId]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState(selected?.customerId || "");

  async function createProject(formData: FormData) {
    setBusy("creating"); setError("");
    try {
      const response = await fetch("/api/figure-forge", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "TITAN could not create the figurine project.");
      router.push(`/figure-forge?project=${body.id}`); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Generation failed."); }
    finally { setBusy(""); }
  }

  async function removeProject() {
    if (!selected || !confirm(`Delete ${selected.title} and its stored files?`)) return;
    setBusy("deleting"); setError("");
    try {
      const response = await fetch(`/api/figure-forge/${selected.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Delete failed.");
      router.push("/figure-forge"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Delete failed."); }
    finally { setBusy(""); }
  }

  async function exportToCustomer() {
    if (!selected || !customerId) return setError("Choose a customer first.");
    setBusy("exporting"); setError("");
    try {
      const response = await fetch(`/api/figure-forge/${selected.id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Export failed.");
      router.push(`/uploads?view=${body.fileId}&success=figure-forge`); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Export failed."); }
    finally { setBusy(""); }
  }

  return <>
    <div className="top"><div><h1>TITAN Figure Forge</h1><p className="muted">Turn a customer photo into a custom bobblehead, bust, mascot, pet figure, or collectible STL.</p></div><span className="pill"><Sparkles size={14}/> Photo-to-figurine studio</span></div>
    {error && <div className="alert">{error}</div>}
    <div className="stlDevLayout section">
      <aside className="card stlDevHistory"><div className="top compact"><h2>Forge projects</h2><span className="pill">{projects.length}</span></div><a className="button" href="/figure-forge"><ImagePlus size={16}/> New figurine</a><div className="stlDesignList">{projects.map((project) => <a className={project.id === selected?.id ? "active" : ""} href={`/figure-forge?project=${project.id}`} key={project.id}><b>{project.title}</b><span>{project.status.replaceAll("_", " ")} · {new Date(project.updatedAt).toLocaleDateString()}</span></a>)}{!projects.length && <p className="muted">Saved figurine projects appear here.</p>}</div></aside>
      <div className="stlDevMain">
        {selected ? <>
          <section className="card"><div className="top compact"><div><h2>{selected.title}</h2><p className="muted">{selected.style.replaceAll("_", " ")} · {selected.baseStyle.toLowerCase()} base · source: {selected.sourceImageName}</p></div><div className="actions">{selected.stlStorageKey && <a className="secondary small" href={`/api/figure-forge/${selected.id}?download=1`}><Download size={15}/> Download STL</a>}{permissions.canDelete && <button className="danger small" onClick={removeProject} disabled={Boolean(busy)}><Trash2 size={15}/> Delete</button>}</div></div>
            {selected.status === "READY" && selected.stlStorageKey ? <ThreeDViewer fileName={`${selected.title}.stl`} fileType="STL" sourceUrl={`/api/figure-forge/${selected.id}`}/> : <div className="forgeStatus"><LoaderCircle className={selected.status === "PROCESSING" ? "spin" : ""} size={34}/><h3>{selected.status.replaceAll("_", " ")}</h3><p className="muted">{selected.errorMessage || (selected.status === "PROCESSING" ? "Your connected image-to-3D provider is creating the mesh." : "This project is waiting for generation.")}</p></div>}
          </section>
          {selected.status === "READY" && permissions.canExport && <section className="card form section"><h2>Send to production workflow</h2><label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><button className="button" type="button" onClick={exportToCustomer} disabled={busy === "exporting" || !customerId}>{busy === "exporting" ? <LoaderCircle className="spin" size={16}/> : <Box size={16}/>} Save STL to Customer Files</button></section>}
        </> : <form className="card form stlDevCreate" action={createProject}><div className="stlDevHero"><UploadCloud size={38}/><div><h2>Create a photo figurine</h2><p className="muted">Use a clear front-facing photo. A full-body photo improves clothing and pose accuracy.</p></div></div><label>Project title<input name="title" required maxLength={80} placeholder="Justin Project TITAN Bobblehead"/></label><label>Source photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label><div className="formRow"><label>Figure style<select name="style">{styles.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Base style<select name="baseStyle">{bases.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><label>Nameplate text<input name="nameplateText" maxLength={60} placeholder="PROJECT TITAN"/></label><label>Customer (optional)<select name="customerId"><option value="">Personal project</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label>Design instructions<textarea name="instructions" rows={5} maxLength={1500} placeholder="Keep the quilted vest, friendly smile, realistic shoes, strong connected fingers, thick printable details, and a stable display base."/></label>{permissions.canCreate ? <button className="button" disabled={Boolean(busy)}>{busy === "creating" ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} Create figurine STL</button> : <p className="alert">Your account has view-only AI STL access.</p>}<p className="muted">Generation requires a configured photo-to-3D provider. TITAN stores projects, files, permissions, audit records, and production export without replacing any current module.</p></form>}
      </div>
    </div>
  </>;
}
