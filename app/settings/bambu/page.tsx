import Link from "next/link";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { requireOwner } from "@/lib/authorization";
import { emptyBambuPrinter, normalizeBambuConfiguration, publicBambuConfiguration } from "@/lib/bambu";
import { saveBambuSettingsAction } from "@/app/actions";

export const dynamic="force-dynamic";
export default async function BambuSettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireOwner();const params=await searchParams;
  const row=await db.integrationSetting.findUnique({where:{provider:"BAMBU"}});
  let config={printers:[emptyBambuPrinter()]};
  if(row?.encryptedJson){try{config=publicBambuConfiguration(normalizeBambuConfiguration(JSON.parse(decryptSecret(row.encryptedJson))));}catch{}}
  const json=JSON.stringify(config,null,2);
  return <><div className="top"><div><h1>Bambu Printer Settings</h1><p className="muted">Paste printer JSON, save it encrypted, and manage camera or control-bridge addresses.</p></div><Link className="secondary" href="/bambu">Open printer dashboard</Link></div>
  {params.success&&<div className="alert goodText">Bambu settings saved.</div>}{params.error&&<div className="alert">Could not save: {params.error}</div>}
  <section className="card"><form action={saveBambuSettingsAction} className="form"><label className="check"><input type="checkbox" name="enabled" defaultChecked={row?.enabled}/> Enable Bambu integration</label><label>Printer configuration JSON<textarea name="configuration" rows={28} defaultValue={json} spellCheck={false} required/></label><p className="muted">Required for each printer: <code>id</code>, <code>name</code>, <code>host</code>, <code>serialNumber</code>, and <code>accessCode</code>. Saved access codes and bridge tokens are encrypted. When editing an existing printer, leave those two values blank to keep the saved secrets.</p><button className="button">Save Bambu settings</button></form></section>
  <section className="card section"><h2>Camera and controls</h2><p className="muted"><code>cameraUrl</code> must be a browser-viewable MJPEG, HLS, snapshot, or proxy URL. <code>bridgeUrl</code> is optional and enables pause, resume, stop, and chamber-light commands through a compatible LAN bridge.</p></section></>;
}
