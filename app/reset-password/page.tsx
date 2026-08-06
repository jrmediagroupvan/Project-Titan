import Link from "next/link";
import { resetPasswordAction } from "@/app/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; success?: string }>;
}) {
  const query = await searchParams;
  const token = query.token || "";

  if (query.success) {
    return (
      <div className="loginWrap">
        <div className="card loginCard">
          <div className="brand big">PROJECT <span>TITAN</span></div>
          <h1>Password updated</h1>
          <p className="muted">Your password has been changed. You can now sign in.</p>
          <Link className="button" href="/login">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="loginWrap">
      <form action={resetPasswordAction} className="card loginCard">
        <div className="brand big">PROJECT <span>TITAN</span></div>
        <h1>Create a new password</h1>
        <p className="muted">Use at least 12 characters. The reset link works once and expires after 30 minutes.</p>
        {query.error === "invalid" && <div className="alert">This reset link is invalid, expired, or has already been used.</div>}
        {query.error === "password" && <div className="alert">Passwords must match and contain at least 12 characters.</div>}
        <input type="hidden" name="token" value={token} />
        <label>New password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label>
        <label>Confirm password<input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" /></label>
        <button className="button" disabled={!token}>Reset password</button>
        <Link className="secondary button" href="/forgot-password">Request another link</Link>
      </form>
    </div>
  );
}
