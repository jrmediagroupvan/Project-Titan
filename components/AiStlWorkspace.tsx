"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Download, FilePlus2, LoaderCircle, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import ThreeDViewer from "@/components/ThreeDViewer";

type Design = {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  revision: number;
  bytes: number;
  dimensions: { x: number; y: number; z: number; triangles: number };
  ownerName: string;
  customerName: string | null;
  customerId: string | null;
  updatedAt: string;
};

export default function AiStlWorkspace({
  designs,
  customers,
  selectedId,
  permissions,
}: {
  designs: Design[];
  customers: { id: string; name: string }[];
  selectedId: string | null;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean };
}) {
  const router = useRouter();
  const selected = designs.find((design) => design.id === selectedId) || null;
  const [prompt, setPrompt] = useState("");
  const [customerId, setCustomerId] = useState(selected?.customerId || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const examples = [
    "Make a 115 × 50 × 8 mm locksmith pinning tray with 10 rounded compartments numbered 1–10.",
    "Create a 70 mm round coaster, 4 mm thick, with raised text that says PROJECT TITAN.",
    "Design a wall-mount bracket for a 37 mm tube with two 4.5 mm screw holes and 3 mm walls.",
  ];
  useEffect(() => setCustomerId(selected?.customerId || ""), [selected?.id, selected?.customerId]);

  async function generate(designId?: string) {
    if (!prompt.trim()) {
      setError("Describe the model you want TITAN to build.");
      return;
    }
    setBusy(designId ? "revising" : "generating");
    setError("");
    try {
      const response = await fetch("/api/stl-developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, customerId: customerId || undefined, designId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "TITAN could not generate this STL.");
      setPrompt("");
      router.push(`/stl-developer?design=${body.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TITAN could not generate this STL.");
    } finally {
      setBusy("");
    }
  }

  async function exportToCustomer() {
    if (!selected || !customerId) {
      setError("Choose a customer before saving to Customer Files.");
      return;
    }
    setBusy("exporting");
    setError("");
    try {
      const response = await fetch(`/api/stl-developer/${selected.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "TITAN could not export this design.");
      router.push(`/uploads?view=${body.fileId}&success=ai-stl`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TITAN could not export this design.");
    } finally {
      setBusy("");
    }
  }

  async function deleteDesign() {
    if (!selected || !window.confirm(`Delete ${selected.title}? This removes the generated STL and its design history.`)) return;
    setBusy("deleting");
    setError("");
    try {
      const response = await fetch(`/api/stl-developer/${selected.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "TITAN could not delete this design.");
      router.push("/stl-developer");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TITAN could not delete this design.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>AI STL Developer</h1>
          <p className="muted">Describe a printable part, generate a real STL, refine it with follow-up instructions, then send it to Bambu slicing and quoting.</p>
        </div>
        <span className="pill"><Sparkles size={14} /> Parametric AI geometry</span>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="stlDevLayout section">
        <aside className="card stlDevHistory">
          <div className="top compact"><h2>Designs</h2><span className="pill">{designs.length}</span></div>
          <a className="button" href="/stl-developer?new=1"><FilePlus2 size={16} /> New design</a>
          <div className="stlDesignList">
            {designs.map((design) => (
              <a className={design.id === selected?.id ? "active" : ""} href={`/stl-developer?design=${design.id}`} key={design.id}>
                <b>{design.title}</b>
                <span>Revision {design.revision} · {new Date(design.updatedAt).toLocaleDateString()}</span>
              </a>
            ))}
            {!designs.length && <p className="muted">Your generated STL designs will appear here.</p>}
          </div>
        </aside>

        <div className="stlDevMain">
          {selected ? (
            <>
              <section className="card">
                <div className="top compact">
                  <div>
                    <h2>{selected.title}</h2>
                    <p className="muted">{selected.summary}</p>
                  </div>
                  <div className="actions">
                    <a className="secondary small" href={`/api/stl-developer/${selected.id}?download=1`}><Download size={15} /> Download STL</a>
                    {permissions.canDelete && <button className="danger small" type="button" onClick={deleteDesign} disabled={Boolean(busy)}><Trash2 size={15} /> Delete</button>}
                  </div>
                </div>
                <ThreeDViewer
                  fileName={`${selected.title}.stl`}
                  fileType="STL"
                  sourceUrl={`/api/stl-developer/${selected.id}`}
                />
                <div className="stlStats">
                  <span><b>{selected.dimensions.x.toFixed(1)} mm</b> Width</span>
                  <span><b>{selected.dimensions.y.toFixed(1)} mm</b> Depth</span>
                  <span><b>{selected.dimensions.z.toFixed(1)} mm</b> Height</span>
                  <span><b>{selected.dimensions.triangles.toLocaleString()}</b> Triangles</span>
                  <span><b>{Math.max(1, Math.round(selected.bytes / 1024)).toLocaleString()} KB</b> STL size</span>
                  <span><b>R{selected.revision}</b> Revision</span>
                </div>
              </section>

              {(permissions.canEdit || permissions.canExport) && (
                <section className="two section">
                  {permissions.canEdit && (
                    <div className="card form">
                      <h2>Refine this design</h2>
                      <p className="muted">Describe only what should change. TITAN keeps the rest of the current design.</p>
                      <label>Revision instructions<textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Make the walls 3 mm thick and add two 4.5 mm mounting holes…" /></label>
                      <button className="button" type="button" onClick={() => generate(selected.id)} disabled={Boolean(busy)}>
                        {busy === "revising" ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Generate revision
                      </button>
                    </div>
                  )}
                  {permissions.canExport && (
                    <div className="card form">
                      <h2>Send to production workflow</h2>
                      <p className="muted">Save a copy to Customer Files, then use the real Bambu Studio bridge for material weight, print time, and quote pricing.</p>
                      <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                      <button className="button" type="button" onClick={exportToCustomer} disabled={Boolean(busy) || !customerId}>
                        {busy === "exporting" ? <LoaderCircle className="spin" size={17} /> : <Box size={17} />} Save to Customer Files
                      </button>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="card stlDevCreate">
              <div className="stlDevHero"><Sparkles size={38} /><div><h2>Build a new printable model</h2><p className="muted">Include exact dimensions, hole sizes, wall thickness, fit clearances, labels, and how the part will be used.</p></div></div>
              <label>Describe your STL<textarea rows={8} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Create a 115 × 50 mm locksmith pin tray with 10 numbered compartments, rounded corners, a 3 mm base, and no fragile details." /></label>
              <label>Link to customer (optional)<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Personal design</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
              <div className="promptExamples">{examples.map((example) => <button type="button" onClick={() => setPrompt(example)} key={example}>{example}</button>)}</div>
              {permissions.canCreate ? (
                <button className="button" type="button" onClick={() => generate()} disabled={Boolean(busy)}>
                  {busy === "generating" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Generate printable STL
                </button>
              ) : <p className="alert">Your profile has view-only access to the AI STL Developer.</p>}
              <p className="muted">Generated geometry must be reviewed before printing. Filament usage and print time appear only after a successful Bambu Studio slice.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
