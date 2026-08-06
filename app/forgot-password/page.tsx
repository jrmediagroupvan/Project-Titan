import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="loginWrap">
      <form action={requestPasswordResetAction} className="card loginCard">
        <div className="brand big">PROJECT <span>TITAN</span></div>
        <h1>Recover your account</h1>
        <p className="muted">Enter your TITAN account email. If the account exists, a secure reset link will be sent.</p>
        {query.sent && <div className="alert goodText">Check your email for a password reset link. The link expires in 30 minutes.</div>}
        {query.error === "mail" && <div className="alert">Password recovery email is not configured. Ask the TITAN owner to configure an outbound mailbox.</div>}
        <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <button className="button">Send reset link</button>
        <Link className="secondary button" href="/login">Back to sign in</Link>
      </form>
    </div>
  );
}
