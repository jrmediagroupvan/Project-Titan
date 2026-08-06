import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendMailboxMessage } from "@/lib/email";

export const PASSWORD_RESET_TTL_MINUTES = 30;

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

function baseUrl() {
  const configured = process.env.TITAN_BASE_URL?.trim();
  if (!configured) throw new Error("TITAN_BASE_URL is required for password recovery.");
  return configured.replace(/\/$/, "");
}

async function recoveryMailbox() {
  const configuredId = process.env.TITAN_RECOVERY_EMAIL_ACCOUNT_ID?.trim();
  if (configuredId) {
    const configured = await db.emailAccount.findFirst({ where: { id: configuredId, active: true } });
    if (configured) return configured;
  }

  const teamMailbox = await db.emailAccount.findFirst({
    where: { active: true, isTeamMailbox: true },
    orderBy: { updatedAt: "desc" },
  });
  if (teamMailbox) return teamMailbox;

  return db.emailAccount.findFirst({
    where: { active: true, owner: { role: "OWNER", active: true } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function sendPasswordResetEmail(input: {
  recipient: string;
  displayName: string;
  token: string;
}) {
  const account = await recoveryMailbox();
  if (!account) {
    throw new Error(
      "No active recovery mailbox is configured. Connect an OWNER or team mailbox, or set TITAN_RECOVERY_EMAIL_ACCOUNT_ID.",
    );
  }

  const resetUrl = `${baseUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  await sendMailboxMessage(account, {
    to: input.recipient,
    subject: "Reset your Project TITAN password",
    text: [
      `Hello ${input.displayName},`,
      "",
      "A password reset was requested for your Project TITAN account.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.`,
      "If you did not request this reset, you can ignore this message.",
    ].join("\n"),
  });
}
