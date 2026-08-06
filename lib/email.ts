import type { EmailAccount } from "@prisma/client";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { decryptSecret } from "@/lib/crypto";
import { accessToken } from "@/lib/gmail";

export type MailSummary = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

export type MailDetail = MailSummary & { text: string };

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function required(value: string | null | undefined, label: string) {
  if (!value) throw new Error(`${label} is not configured`);
  return value;
}

function imapClient(account: EmailAccount) {
  return new ImapFlow({
    host: required(account.imapHost, "IMAP host"),
    port: account.imapPort || 993,
    secure: account.imapSecure,
    auth: {
      user: required(account.imapUsername || account.emailAddress, "IMAP username"),
      pass: decryptSecret(required(account.encryptedImapPassword, "IMAP password")),
    },
    tls: { rejectUnauthorized: !account.allowSelfSigned },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

function addressText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((entry) => {
    const item = entry as { name?: string; address?: string };
    return item.name ? `${item.name} <${item.address || ""}>` : item.address || "";
  }).filter(Boolean).join(", ");
}

async function gmailRequest(account: EmailAccount, path: string, init?: RequestInit) {
  const token = await accessToken(account);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Gmail request failed (${response.status})`);
  return response;
}

function gmailBody(payload: any): string {
  const own = payload?.body?.data;
  if (own && (!payload.mimeType || payload.mimeType === "text/plain")) {
    return Buffer.from(own, "base64url").toString("utf8");
  }
  for (const part of payload?.parts || []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
  }
  for (const part of payload?.parts || []) {
    const nested = gmailBody(part);
    if (nested) return nested;
  }
  return "";
}

function gmailHeaders(message: any) {
  return new Map<string, string>((message.payload?.headers || []).map((header: any) => [
    String(header.name).toLowerCase(), String(header.value || ""),
  ]));
}

export async function listMailbox(account: EmailAccount): Promise<MailSummary[]> {
  if (account.provider === "GOOGLE") {
    const list = await gmailRequest(account, "messages?maxResults=25&q=in:inbox");
    const data = await list.json() as { messages?: { id: string }[] };
    return Promise.all((data.messages || []).map(async ({ id }) => {
      const response = await gmailRequest(account, `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
      const message = await response.json() as any;
      const headers = gmailHeaders(message);
      return {
        id,
        from: headers.get("from") || "",
        to: headers.get("to") || "",
        subject: headers.get("subject") || "(no subject)",
        date: headers.get("date") || "",
        snippet: message.snippet || "",
        unread: (message.labelIds || []).includes("UNREAD"),
      };
    }));
  }

  if (!account.imapEnabled) return [];
  const client = imapClient(account);
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0;
      if (!total) return [];
      const rows: MailSummary[] = [];
      for await (const message of client.fetch(`${Math.max(1, total - 24)}:*`, {
        uid: true, envelope: true, flags: true,
      })) {
        rows.push({
          id: String(message.uid),
          from: addressText(message.envelope?.from),
          to: addressText(message.envelope?.to),
          subject: message.envelope?.subject || "(no subject)",
          date: message.envelope?.date?.toISOString() || "",
          snippet: "",
          unread: !message.flags?.has("\\Seen"),
        });
      }
      return rows.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function readMailboxMessage(account: EmailAccount, id: string): Promise<MailDetail> {
  if (account.provider === "GOOGLE") {
    const response = await gmailRequest(account, `messages/${encodeURIComponent(id)}?format=full`);
    const message = await response.json() as any;
    const headers = gmailHeaders(message);
    return {
      id,
      from: headers.get("from") || "",
      to: headers.get("to") || "",
      subject: headers.get("subject") || "(no subject)",
      date: headers.get("date") || "",
      snippet: message.snippet || "",
      unread: (message.labelIds || []).includes("UNREAD"),
      text: gmailBody(message) || message.snippet || "(This message has no plain-text body.)",
    };
  }

  if (!/^\d+$/.test(id)) throw new Error("Invalid IMAP message ID");
  const client = imapClient(account);
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const message = await client.fetchOne(id, { uid: true, envelope: true, source: true }, { uid: true });
      if (!message || !message.source) throw new Error("Message was not found");
      const parsed = await simpleParser(message.source);
      await client.messageFlagsAdd(id, ["\\Seen"], { uid: true }).catch(() => undefined);
      return {
        id,
        from: parsed.from?.text || addressText(message.envelope?.from),
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((x) => x.text).join(", ") : parsed.to.text) : "",
        subject: parsed.subject || "(no subject)",
        date: parsed.date?.toISOString() || "",
        snippet: parsed.text?.slice(0, 180) || "",
        unread: false,
        text: parsed.text || (typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ") : "") || "(This message has no plain-text body.)",
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function deleteMailboxMessage(account: EmailAccount, id: string) {
  if (account.provider === "GOOGLE") {
    await gmailRequest(account, `messages/${encodeURIComponent(id)}/trash`, { method: "POST" });
    return { destination: "Gmail Trash" };
  }

  if (!/^\d+$/.test(id)) throw new Error("Invalid IMAP message ID");
  const client = imapClient(account);
  await client.connect();
  try {
    const folders = await client.list();
    const trash = folders.find((folder) => folder.specialUse === "\\Trash")
      || folders.find((folder) => /(^|[/. ])(trash|deleted items|bin)$/i.test(folder.path));
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (trash) {
        const moved = await client.messageMove(id, trash.path, { uid: true });
        if (!moved) throw new Error("The IMAP server did not move the message");
        return { destination: trash.path };
      }
      const deleted = await client.messageDelete(id, { uid: true });
      if (!deleted) throw new Error("The IMAP server did not delete the message");
      return { destination: "deleted" };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function testEmailAccount(account: EmailAccount) {
  const results: string[] = [];
  if (account.provider === "GOOGLE") {
    await gmailRequest(account, "profile");
    return ["Gmail OAuth connection successful"];
  }

  const transport = nodemailer.createTransport({
    host: required(account.smtpHost, "SMTP host"),
    port: account.smtpPort || (account.smtpSecure ? 465 : 587),
    secure: account.smtpSecure,
    auth: {
      user: required(account.smtpUsername || account.emailAddress, "SMTP username"),
      pass: decryptSecret(required(account.encryptedSmtpPassword, "SMTP password")),
    },
    tls: { rejectUnauthorized: !account.allowSelfSigned },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  await transport.verify();
  results.push("SMTP connection successful");

  if (account.imapEnabled) {
    const client = imapClient(account);
    await client.connect();
    await client.logout();
    results.push("IMAP connection successful");
  }
  return results;
}

export async function sendMailboxMessage(account: EmailAccount, input: { to: string; cc?: string; subject: string; text: string }) {
  const signature = account.signature ? `\n\n${account.signature}` : "";
  const text = `${input.text}${signature}`;
  if (account.provider === "GOOGLE") {
    const lines = [
      `From: ${cleanHeader(account.displayName ? `${account.displayName} <${account.emailAddress}>` : account.emailAddress)}`,
      `To: ${cleanHeader(input.to)}`,
      ...(input.cc ? [`Cc: ${cleanHeader(input.cc)}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(cleanHeader(input.subject)).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(text).toString("base64"),
    ];
    await gmailRequest(account, "messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(lines.join("\r\n")).toString("base64url") }),
    });
    return;
  }

  const transport = nodemailer.createTransport({
    host: required(account.smtpHost, "SMTP host"),
    port: account.smtpPort || (account.smtpSecure ? 465 : 587),
    secure: account.smtpSecure,
    auth: {
      user: required(account.smtpUsername || account.emailAddress, "SMTP username"),
      pass: decryptSecret(required(account.encryptedSmtpPassword, "SMTP password")),
    },
    tls: { rejectUnauthorized: !account.allowSelfSigned },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  await transport.sendMail({
    from: account.displayName ? { name: account.displayName, address: account.emailAddress } : account.emailAddress,
    replyTo: account.replyTo || undefined,
    to: input.to,
    cc: input.cc || undefined,
    subject: input.subject,
    text,
  });
}
