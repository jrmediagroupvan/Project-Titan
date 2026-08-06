import { redirect } from "next/navigation";
import { getPendingTwoFactor } from "@/lib/auth";
import { verifyTwoFactorLoginAction } from "@/app/actions";

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const pending = await getPendingTwoFactor();
  if (!pending) redirect("/login");
  const query = await searchParams;
  return (
    <div className="loginWrap">
      <form action={verifyTwoFactorLoginAction} className="card loginCard">
        <div className="brand big">PROJECT <span>TITAN</span></div>
        <h1>Two-step verification</h1>
        <p className="muted">Enter the six-digit code from your authenticator app, or use one recovery code.</p>
        {query.error ? <div className="alert">That verification code was not accepted.</div> : null}
        <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus /></label>
        <label className="checkRow"><input name="remember" type="checkbox" value="yes" /> Trust this device for 30 days</label>
        <button className="button">Verify and sign in</button>
      </form>
    </div>
  );
}
