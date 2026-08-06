import {
  CheckCircle2,
  Copy,
  History,
  KeyRound,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authorization";
import { authenticatorUri } from "@/lib/two-factor";
import { decryptSecret } from "@/lib/crypto";
import { generateTotpQrSvg } from "@/lib/totp-qr";
import {
  beginTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  revokeTrustedDeviceAction,
} from "@/app/actions";

type SecurityQuery = Record<string, string | undefined>;

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<SecurityQuery>;
}) {
  const user = await requireUser();
  const query = await searchParams;

  const [credential, devices, attempts] = await Promise.all([
    db.twoFactorCredential.findUnique({
      where: { userId: user.id },
    }),
    db.trustedDevice.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: "desc" },
    }),
    db.loginAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const secret =
    query.setup === "1" && credential
      ? decryptSecret(credential.encryptedSecret)
      : null;

  const uri = secret ? authenticatorUri(user.email, secret) : null;
  const qrSvg = uri ? generateTotpQrSvg(uri) : null;
  const codes = query.codes?.split(",").filter(Boolean) ?? [];

  return (
    <div className="securityV4Page">
      <header className="securityV4Header">
        <div>
          <span className="securityV4Eyebrow">
            PROJECT TITAN 4.0 · SECURITY CENTER
          </span>
          <h1>Security & two-step verification</h1>
          <p>
            Two-step verification is optional. Scan the QR code to protect
            your account, or continue using password sign-in only.
          </p>
        </div>

        <div
          className={
            credential?.enabled
              ? "securityV4State securityV4StateEnabled"
              : "securityV4State"
          }
        >
          <ShieldCheck size={22} />
          <span>
            <strong>
              {credential?.enabled ? "2FA enabled" : "2FA optional"}
            </strong>
            <small>
              {credential?.enabled
                ? "Your account has additional protection"
                : "Password sign-in remains available"}
            </small>
          </span>
        </div>
      </header>

      {query.enabled ? (
        <div className="success">
          Two-step verification is now enabled.
        </div>
      ) : null}

      {query.disabled ? (
        <div className="success">
          Two-step verification is disabled. Password sign-in remains active.
        </div>
      ) : null}

      {query.disableError ? (
        <div className="alert">
          Your password was not accepted. Two-step verification remains
          enabled.
        </div>
      ) : null}

      {codes.length ? (
        <section className="card securityRecovery">
          <div className="securityV4CardHeading">
            <div className="securityV4HeadingIcon">
              <KeyRound size={20} />
            </div>
            <div>
              <h2>Save your recovery codes</h2>
              <p>
                Each code works once. Store them somewhere secure because
                they will not be displayed again.
              </p>
            </div>
          </div>

          <div className="recoveryGrid">
            {codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        </section>
      ) : null}

      <div className="securityV4Grid">
        <section className="card securityV4PrimaryCard">
          <div className="securityV4CardHeading">
            <div className="securityV4HeadingIcon">
              <Smartphone size={21} />
            </div>
            <div>
              <h2>Authenticator app</h2>
              <p>
                Compatible with Microsoft Authenticator, Google
                Authenticator, 1Password, Bitwarden, Authy, and other TOTP
                applications.
              </p>
            </div>
          </div>

          {credential?.enabled ? (
            <>
              <div className="securityV4EnabledPanel">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Authenticator protection is active</strong>
                  <span>
                    A verification code is required after password sign-in.
                  </span>
                </div>
              </div>

              <form
                action={disableTwoFactorAction}
                className="securityV4DisableForm"
              >
                <h3>Disable two-step verification</h3>
                <p>
                  Confirm your current password. Recovery codes and trusted
                  device records will be removed.
                </p>

                <label>
                  Current password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>

                <button className="danger" type="submit">
                  Disable two-step verification
                </button>
              </form>
            </>
          ) : secret && uri && qrSvg ? (
            <div className="securityV4Setup">
              <div className="securityV4QrPanel">
                <div className="securityV4QrTitle">
                  <QrCode size={22} />
                  <div>
                    <strong>Scan this QR code</strong>
                    <span>
                      Open your authenticator app and add a new account.
                    </span>
                  </div>
                </div>

                <div
                  className="securityV4QrCode"
                  aria-label="Authenticator setup QR code"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />

                <span className="securityV4QrHint">
                  The QR code is generated locally. Your setup secret is not
                  sent to an external QR service.
                </span>
              </div>

              <div className="securityV4SetupDetails">
                <div className="securityV4Step">
                  <span>1</span>
                  <div>
                    <strong>Scan the QR code</strong>
                    <p>
                      Choose “Scan QR code” inside your authenticator app.
                    </p>
                  </div>
                </div>

                <div className="securityV4Step">
                  <span>2</span>
                  <div>
                    <strong>Manual setup key</strong>
                    <p>
                      Use this key when scanning is unavailable.
                    </p>
                  </div>
                </div>

                <div className="securityV4SecretBox">
                  <div>
                    <LockKeyhole size={18} />
                    <span>Setup key</span>
                  </div>
                  <code>{secret}</code>
                </div>

                <details className="securityV4UriDetails">
                  <summary>
                    <Copy size={16} />
                    Show authenticator URI
                  </summary>
                  <code>{uri}</code>
                </details>

                {query.error ? (
                  <div className="alert">
                    The code was not valid. Check your device time and try
                    again.
                  </div>
                ) : null}

                <form
                  action={confirmTwoFactorSetupAction}
                  className="securityV4ConfirmForm"
                >
                  <label>
                    6-digit verification code
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="123456"
                      required
                    />
                  </label>

                  <button className="button" type="submit">
                    <ShieldCheck size={18} />
                    Verify and enable
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="securityV4OptionalPanel">
              <div>
                <ShieldCheck size={28} />
                <span>
                  <strong>Optional · Not enabled</strong>
                  <small>
                    Project TITAN 4.0 works normally with password sign-in.
                  </small>
                </span>
              </div>

              <form action={beginTwoFactorSetupAction}>
                <button className="button" type="submit">
                  <QrCode size={18} />
                  Show setup QR code
                </button>
              </form>
            </div>
          )}
        </section>

        <section className="card">
          <div className="securityV4CardHeading">
            <div className="securityV4HeadingIcon">
              <Smartphone size={20} />
            </div>
            <div>
              <h2>Trusted devices</h2>
              <p>
                Trusted devices can skip the second step for up to 30 days.
              </p>
            </div>
          </div>

          {devices.length ? (
            devices.map((device) => (
              <div className="lineItem" key={device.id}>
                <span>
                  <strong>{device.name || "Browser"}</strong>
                  <small>
                    {device.userAgent?.slice(0, 70) || "Unknown device"}
                    <br />
                    Last used {device.lastUsedAt.toLocaleString()}
                  </small>
                </span>

                <form action={revokeTrustedDeviceAction}>
                  <input type="hidden" name="id" value={device.id} />
                  <button className="secondary" type="submit">
                    Revoke
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="securityV4Empty">
              <Smartphone size={27} />
              <strong>No trusted devices</strong>
              <span>Trusted devices appear after a verified login.</span>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="securityV4CardHeading">
          <div className="securityV4HeadingIcon">
            <History size={20} />
          </div>
          <div>
            <h2>Recent login history</h2>
            <p>Review successful and unsuccessful account activity.</p>
          </div>
        </div>

        {attempts.length ? (
          attempts.map((attempt) => (
            <div className="lineItem" key={attempt.id}>
              <span>
                <strong>
                  {attempt.successful
                    ? "Successful sign-in"
                    : "Failed sign-in"}
                </strong>
                <small>{attempt.ipAddress || "Unknown IP"}</small>
              </span>
              <time>{attempt.createdAt.toLocaleString()}</time>
            </div>
          ))
        ) : (
          <div className="securityV4Empty">
            <History size={27} />
            <strong>No login history yet</strong>
            <span>Sign-in activity will be shown here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
