"use client";

import { useMemo, useState } from "react";
import { createQuote } from "@/app/actions";

type CustomerOption = { id: string; name: string };
type FileOption = {
  id: string;
  customerId: string;
  name: string;
  fileType: string;
  gramsPerItem?: number;
  minutesPerItem?: number;
};
type MaterialOption = {
  code: string;
  label: string;
  marketCostPerKgCad: number;
  wastePercent: number;
};

const cad = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

export default function QuoteBuilder({ customers, files, materials, defaults }: {
  customers: CustomerOption[];
  files: FileOption[];
  materials: MaterialOption[];
  defaults: { markup: number; tax: number; hourlyRate: number; setupFee: number; minimumQuote: number };
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [fileId, setFileId] = useState("");
  const [material, setMaterial] = useState(materials[0]?.code || "PLA");
  const [quantity, setQuantity] = useState(1);
  const [grams, setGrams] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(defaults.hourlyRate);
  const [setupFee, setSetupFee] = useState(defaults.setupFee);
  const [markup, setMarkup] = useState(defaults.markup);
  const [taxRate, setTaxRate] = useState(defaults.tax);
  const [pricingMode, setPricingMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualUnit, setManualUnit] = useState(0);
  const customerFiles = files.filter((file) => file.customerId === customerId);
  const selectedFile = files.find((file) => file.id === fileId);
  const selectedMaterial = materials.find((item) => item.code === material) || materials[0];
  const breakdown = useMemo(() => {
    const materialEach = Math.ceil((selectedMaterial?.marketCostPerKgCad || 0) * 100 * Math.max(0, grams) / 1000 * (1 + (selectedMaterial?.wastePercent || 0) / 100));
    const machineEach = Math.ceil(Math.max(0, hourlyRate) * 100 * Math.max(0, minutes) / 60);
    const jobBase = (materialEach + machineEach) * Math.max(1, quantity) + Math.max(0, setupFee) * 100;
    const automaticTotal = Math.max(defaults.minimumQuote * 100, Math.ceil(jobBase * (1 + Math.max(0, markup) / 100)));
    const automaticUnit = Math.ceil(automaticTotal / Math.max(1, quantity));
    const unit = pricingMode === "MANUAL" ? Math.max(0, manualUnit) * 100 : automaticUnit;
    const subtotal = unit * Math.max(1, quantity);
    const tax = Math.round(subtotal * Math.max(0, taxRate) / 100);
    return { materialEach, machineEach, jobBase, unit, subtotal, tax, total: subtotal + tax };
  }, [selectedMaterial, grams, hourlyRate, minutes, quantity, setupFee, markup, pricingMode, manualUnit, taxRate, defaults.minimumQuote]);

  function chooseFile(value: string) {
    setFileId(value);
    const file = files.find((item) => item.id === value);
    if (file?.gramsPerItem) setGrams(file.gramsPerItem);
    if (file?.minutesPerItem) setMinutes(file.minutesPerItem);
  }

  return (
    <form action={createQuote} className="card quoteBuilder">
      <div className="quoteSteps"><span className="active"><b>1</b> Upload & customer</span><span className="active"><b>2</b> Configure</span><span><b>3</b> Review & create</span></div>
      <div className="quoteBuilderGrid">
        <section className="quoteConfig">
          <h2>Detailed quote builder</h2>
          <label>Customer<select name="customerId" value={customerId} onChange={(event) => { setCustomerId(event.target.value); setFileId(""); }} required><option value="">Select customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
          <label>Uploaded 3D file<select name="customerFileId" value={fileId} onChange={(event) => chooseFile(event.target.value)}><option value="">No linked file</option>{customerFiles.map((file) => <option value={file.id} key={file.id}>{file.name} · {file.fileType}</option>)}</select></label>
          <div className="linkedFileCard">{selectedFile ? <><span className="fileBadge">{selectedFile.fileType}</span><div><b>{selectedFile.name}</b><p className="muted">Linked to this quote. Bambu slice values are loaded when available.</p></div><a className="secondary small" href={`/uploads?view=${selectedFile.id}`}>Preview</a></> : <><span className="fileBadge">3D</span><div><b>Select an uploaded model</b><p className="muted">STL, 3MF, OBJ, STEP, STP, or G-code</p></div><a className="secondary small" href="/uploads">Upload files</a></>}</div>
          <label>Description<input name="description" required placeholder="Custom printed mounting bracket" defaultValue={selectedFile ? `3D print: ${selectedFile.name}` : ""} key={selectedFile?.id || "blank"} /></label>
          <div className="formRow"><label>Quantity<input name="quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label><label>Material<select name="material" value={material} onChange={(event) => setMaterial(event.target.value)}>{materials.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label></div>
          <div className="formRow"><label>Colour<input name="colour" placeholder="Black" /></label><label>Pricing method<select name="pricingMode" value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "AUTO" | "MANUAL")}><option value="AUTO">Automatic market pricing</option><option value="MANUAL">Manual unit price</option></select></label></div>
          <div className="formRow"><label>Material per item (g)<input name="estimatedGrams" type="number" min="0" step="0.1" value={grams || ""} onChange={(event) => setGrams(Number(event.target.value) || 0)} required /></label><label>Print time per item (minutes)<input name="estimatedMinutes" type="number" min="0" value={minutes || ""} onChange={(event) => setMinutes(Number(event.target.value) || 0)} required /></label></div>
          <div className="formRow"><label>Machine rate (CAD/hour)<input name="machineHourlyRate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(Number(event.target.value) || 0)} /></label><label>Setup/labour fee (CAD)<input name="setupFee" type="number" min="0" step="0.01" value={setupFee} onChange={(event) => setSetupFee(Number(event.target.value) || 0)} /></label></div>
          <div className="formRow"><label>Markup %<input name="markupPercent" type="number" min="0" step="0.01" value={markup} onChange={(event) => setMarkup(Number(event.target.value) || 0)} /></label><label>Tax %<input name="taxRate" type="number" min="0" step="0.01" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value) || 0)} /></label></div>
          {pricingMode === "MANUAL" && <><label>Manual unit price (CAD)<input name="unitPrice" type="number" min="0" step="0.01" value={manualUnit || ""} onChange={(event) => setManualUnit(Number(event.target.value) || 0)} required /></label><label className="check"><input name="allowBelowCost" type="checkbox" /> Allow below calculated cost</label></>}
          <label>Customer/internal notes<textarea name="notes" rows={3} placeholder="Lead time, finish, packaging, special requirements…" /></label>
        </section>
        <aside className="quoteSummary">
          <h2>Cost breakdown</h2>
          <div className="costLine"><span>Material per item</span><b>{cad(breakdown.materialEach)}</b></div>
          <div className="costLine"><span>Machine time per item</span><b>{cad(breakdown.machineEach)}</b></div>
          <div className="costLine"><span>Quantity</span><b>× {quantity}</b></div>
          <div className="costLine"><span>Setup / labour</span><b>{cad(setupFee * 100)}</b></div>
          <div className="costLine"><span>Base job cost</span><b>{cad(breakdown.jobBase)}</b></div>
          <div className="costLine"><span>Markup</span><b>{markup.toFixed(1)}%</b></div>
          <div className="costLine emphasis"><span>Unit price</span><b>{cad(breakdown.unit)}</b></div>
          <div className="costLine"><span>Subtotal</span><b>{cad(breakdown.subtotal)}</b></div>
          <div className="costLine"><span>Tax ({taxRate.toFixed(1)}%)</span><b>{cad(breakdown.tax)}</b></div>
          <div className="quoteTotal"><span>Total</span><strong>{cad(breakdown.total)}</strong></div>
          <p className="muted">Preview uses the configured material catalog. TITAN recalculates the saved draft with the newest market or inventory price on the server.</p>
          <button className="button" disabled={!customerId || !grams || !minutes}>Create draft quote</button>
        </aside>
      </div>
    </form>
  );
}
