import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import {
  createQuoteFromSliceAction,
  deleteCustomerFile,
  sliceCustomerFileAction,
  uploadCustomerFile,
} from "@/app/actions";
import ConfirmDelete from "@/components/ConfirmDelete";
import ThreeDViewer from "@/components/ThreeDViewer";
import { customerRelationWhere, customerWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requirePermission, userAllows } from "@/lib/permissions";
import { materialRateCatalog } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const VIEWABLE_TYPES = new Set(["STL", "3MF", "OBJ", "GCODE", "STEP", "STP"]);
const fileSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default async function Uploads({ searchParams }: {
  searchParams: Promise<{ view?: string; error?: string; success?: string }>;
}) {
  const actor = await requirePermission(PermissionKey.UPLOADS_VIEW);
  const query = await searchParams;
  const [files, customers, canCreate, canEdit, canDelete, canCreateQuote] = await Promise.all([
    db.customerFile.findMany({
      where: customerRelationWhere(actor),
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    db.customer.findMany({ where: customerWhere(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    userAllows(actor.id, actor.role, PermissionKey.UPLOADS_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.UPLOADS_EDIT),
    userAllows(actor.id, actor.role, PermissionKey.UPLOADS_DELETE),
    userAllows(actor.id, actor.role, PermissionKey.QUOTES_CREATE),
  ]);
  const selected = query.view ? files.find((file) => file.id === query.view) : undefined;
  const catalog = materialRateCatalog();
  const analysis = selected?.analysisJson && typeof selected.analysisJson === "object" && !Array.isArray(selected.analysisJson)
    ? selected.analysisJson as Record<string, unknown>
    : {};
  const slice = analysis.sliceEstimate && typeof analysis.sliceEstimate === "object" && !Array.isArray(analysis.sliceEstimate)
    ? analysis.sliceEstimate as Record<string, unknown>
    : null;

  return (
    <>
      <div className="top">
        <div>
          <h1>Uploads & 3D Preview</h1>
          <p className="muted">Upload, securely download, and interactively view STL, 3MF, OBJ, G-code, STEP, and STP files.</p>
        </div>
        <span className="pill">50 MB maximum</span>
      </div>
      {query.success === "uploaded" && <p className="alert goodText">File uploaded successfully.</p>}
      {query.success === "ai-stl" && <p className="alert goodText">AI-generated STL saved to Customer Files. You can now preview, slice, and quote it.</p>}
      {query.success === "sliced" && <p className="alert goodText">Bambu Studio slice estimates saved.</p>}
      {query.error && <p className="alert">The file operation failed: {query.error.replaceAll("-", " ")}.</p>}

      {selected && VIEWABLE_TYPES.has(selected.fileType) && (
        <section className="card section">
          <div className="top compact">
            <div><h2>{selected.originalName}</h2><p className="muted">{selected.customer.name} · {selected.fileType} · {fileSize(selected.bytes)}</p></div>
            <div className="actions"><a className="secondary small" href={`/api/uploads/${selected.id}?download=1`}>Download</a><Link className="secondary small" href="/uploads">Close preview</Link></div>
          </div>
          <ThreeDViewer fileId={selected.id} fileName={selected.originalName} fileType={selected.fileType as "STL" | "3MF" | "OBJ" | "GCODE" | "STEP" | "STP"} />
          {canEdit && ["STL", "3MF"].includes(selected.fileType) && (
            <form action={sliceCustomerFileAction} className="formGrid section">
              <input type="hidden" name="id" value={selected.id} />
              <label>Bambu profile key<input name="profileKey" placeholder="x1c-pla-0.20" required /></label>
              <label>Material<select name="material" defaultValue="PLA">{catalog.materials.map((material) => <option key={material.code} value={material.code}>{material.label}</option>)}</select></label>
              <label>Colour<input name="colour" placeholder="Black" /></label>
              <label>Quantity<input name="quantity" type="number" min="1" max="100" defaultValue="1" /></label>
              <button className="button">Slice with Bambu Studio</button>
            </form>
          )}
          {slice && (
            <div className="card section">
              <h3>Saved Bambu estimate</h3>
              <p>{Number(slice.materialGrams || 0).toFixed(1)} g · {(Number(slice.totalTimeSeconds || 0) / 3600).toFixed(2)} hours · quantity {String(slice.quantity || 1)}</p>
              <p className="muted">Profile: {String(slice.profileKey || "—")} · Material: {String(slice.material || "—")} · Slicer: {String(slice.slicerVersion || "Bambu Studio")}</p>
              {canCreateQuote && (
                <form action={createQuoteFromSliceAction} className="inlineForm">
                  <input type="hidden" name="id" value={selected.id} />
                  <input name="description" defaultValue={`3D print: ${selected.originalName}`} />
                  <button className="button">Create draft quote</button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <div className="two section">
        <section className="card">
          <h2>Customer files</h2>
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>File</th><th>Customer</th><th>Type</th><th>Size</th><th>Actions</th></tr></thead>
              <tbody>{files.map((file) => <tr key={file.id}>
                <td>{file.originalName}<div className="muted">{file.createdAt.toLocaleString()}</div></td>
                <td>{file.customer.name}</td><td><span className="pill">{file.fileType}</span></td><td>{fileSize(file.bytes)}</td>
                <td><div className="actions">
                  {VIEWABLE_TYPES.has(file.fileType) && <Link className="secondary small" href={`/uploads?view=${file.id}`}>3D Preview</Link>}
                  <a className="secondary small" href={`/api/uploads/${file.id}?download=1`}>Download</a>
                  {canDelete && <ConfirmDelete action={deleteCustomerFile} id={file.id} message={`Delete ${file.originalName}? This removes the stored file and cannot be undone.`}>Delete</ConfirmDelete>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!files.length && <p className="muted">No files are available to this profile.</p>}
        </section>
        {canCreate && (
          <form action={uploadCustomerFile} className="card form">
            <h2>Upload a file</h2>
            <label>Customer<select name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>File<input name="file" type="file" accept=".stl,.3mf,.step,.stp,.obj,.gcode,.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.zip" required /></label>
            <p className="muted">3D preview: STL, 3MF, OBJ, G-code, STEP, and STP. Other supported uploads remain securely downloadable.</p>
            <button className="button" disabled={!customers.length}>Upload file</button>
          </form>
        )}
      </div>
    </>
  );
}
