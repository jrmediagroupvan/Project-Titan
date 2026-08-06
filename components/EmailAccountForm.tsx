"use client";

import { useState } from "react";
import { saveEmailAccountAction } from "@/app/actions";

const presets = {
  GMAIL: { smtpHost: "smtp.gmail.com", smtpPort: "465", smtpSecure: true, imapHost: "imap.gmail.com", imapPort: "993", imapSecure: true },
  MICROSOFT: { smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: false, imapHost: "outlook.office365.com", imapPort: "993", imapSecure: true },
  YAHOO: { smtpHost: "smtp.mail.yahoo.com", smtpPort: "465", smtpSecure: true, imapHost: "imap.mail.yahoo.com", imapPort: "993", imapSecure: true },
  ICLOUD: { smtpHost: "smtp.mail.me.com", smtpPort: "587", smtpSecure: false, imapHost: "imap.mail.me.com", imapPort: "993", imapSecure: true },
  ZOHO: { smtpHost: "smtp.zoho.com", smtpPort: "465", smtpSecure: true, imapHost: "imap.zoho.com", imapPort: "993", imapSecure: true },
  CUSTOM: { smtpHost: "", smtpPort: "587", smtpSecure: false, imapHost: "", imapPort: "993", imapSecure: true },
} as const;

type Existing = {
  id: string;
  providerPreset: string | null;
  emailAddress: string;
  displayName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  imapEnabled: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUsername: string | null;
  replyTo: string | null;
  signature: string | null;
  allowSelfSigned: boolean;
};

export default function EmailAccountForm({ account }: { account?: Existing }) {
  const initial = (account?.providerPreset && account.providerPreset in presets ? account.providerPreset : "CUSTOM") as keyof typeof presets;
  const [presetName, setPresetName] = useState<keyof typeof presets>(initial);
  const [server, setServer] = useState({
    smtpHost: account?.smtpHost || presets[initial].smtpHost,
    smtpPort: String(account?.smtpPort || presets[initial].smtpPort),
    smtpSecure: account?.smtpSecure ?? presets[initial].smtpSecure,
    imapHost: account?.imapHost || presets[initial].imapHost,
    imapPort: String(account?.imapPort || presets[initial].imapPort),
    imapSecure: account?.imapSecure ?? presets[initial].imapSecure,
  });
  function choose(value: keyof typeof presets) {
    setPresetName(value);
    setServer(presets[value]);
  }
  return <form action={saveEmailAccountAction} className="form">
    {account && <input type="hidden" name="id" value={account.id}/>}
    <label>Email provider<select name="providerPreset" value={presetName} onChange={(e)=>choose(e.target.value as keyof typeof presets)}>
      <option value="GMAIL">Gmail / Google Workspace</option><option value="MICROSOFT">Microsoft 365 / Outlook</option>
      <option value="YAHOO">Yahoo Mail</option><option value="ICLOUD">Apple iCloud Mail</option>
      <option value="ZOHO">Zoho Mail</option><option value="CUSTOM">Custom IMAP / SMTP</option>
    </select></label>
    <div className="formRow"><label>Email address<input name="emailAddress" type="email" required defaultValue={account?.emailAddress}/></label><label>Display name<input name="displayName" defaultValue={account?.displayName || ""}/></label></div>
    <div className="formRow"><label>SMTP server<input name="smtpHost" required value={server.smtpHost} onChange={(e)=>setServer({...server,smtpHost:e.target.value})}/></label><label>SMTP port<input name="smtpPort" type="number" min="1" max="65535" required value={server.smtpPort} onChange={(e)=>setServer({...server,smtpPort:e.target.value})}/></label></div>
    <label className="check"><input name="smtpSecure" type="checkbox" checked={server.smtpSecure} onChange={(e)=>setServer({...server,smtpSecure:e.target.checked})}/> Use direct TLS/SSL for SMTP (normally port 465; leave off for STARTTLS on port 587)</label>
    <div className="formRow"><label>SMTP username<input name="smtpUsername" defaultValue={account?.smtpUsername || ""} placeholder="Usually your full email address"/></label><label>SMTP password / app password<input name="smtpPassword" type="password" required={!account} placeholder={account?"Leave blank to keep saved password":"Use an app password when required"}/></label></div>
    <label className="check"><input name="imapEnabled" type="checkbox" defaultChecked={account?.imapEnabled ?? true}/> Enable inbox through IMAP</label>
    <div className="formRow"><label>IMAP server<input name="imapHost" value={server.imapHost} onChange={(e)=>setServer({...server,imapHost:e.target.value})}/></label><label>IMAP port<input name="imapPort" type="number" min="1" max="65535" value={server.imapPort} onChange={(e)=>setServer({...server,imapPort:e.target.value})}/></label></div>
    <label className="check"><input name="imapSecure" type="checkbox" checked={server.imapSecure} onChange={(e)=>setServer({...server,imapSecure:e.target.checked})}/> Use TLS/SSL for IMAP (normally port 993)</label>
    <div className="formRow"><label>IMAP username<input name="imapUsername" defaultValue={account?.imapUsername || ""} placeholder="Usually your full email address"/></label><label>IMAP password / app password<input name="imapPassword" type="password" placeholder={account?"Leave blank to keep saved password":"Leave blank to use the SMTP password"}/></label></div>
    <div className="formRow"><label>Reply-to address<input name="replyTo" type="email" defaultValue={account?.replyTo || ""}/></label><label className="check"><input name="allowSelfSigned" type="checkbox" defaultChecked={account?.allowSelfSigned}/> Allow a self-signed certificate (private servers only)</label></div>
    <label>Email signature<textarea name="signature" rows={4} defaultValue={account?.signature || ""}/></label>
    <button>{account?"Save account settings":"Add email account"}</button>
  </form>;
}
