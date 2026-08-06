import Link from "next/link";
import { FeatureCategory, PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authorization";
import { userHasFeature } from "@/lib/features";
import { userAllows } from "@/lib/permissions";

export const dynamic="force-dynamic";

export default async function Settings(){
  const me=await requireUser();
  const [settings,manageUsers,email,integrations,activity]=await Promise.all([
    userHasFeature(me,FeatureCategory.SETTINGS),
    userAllows(me.id,me.role,PermissionKey.USERS_MANAGE),
    userAllows(me.id,me.role,PermissionKey.EMAIL_VIEW),
    userAllows(me.id,me.role,PermissionKey.INTEGRATIONS_MANAGE),
    userAllows(me.id,me.role,PermissionKey.AUDIT_VIEW),
  ]);
  if(!settings&&!manageUsers)redirect("/settings/profile?error=feature");
  const owner=me.role==="OWNER";
  const [users,printers]=settings?await Promise.all([db.user.count(),db.printer.count()]):[0,0];
  return <><div className="top"><div><h1>Settings</h1><p className="muted">Profiles, access control, deployment and integrations.</p></div></div>{settings&&<div className="grid"><div className="card">Users<div className="value">{users}</div></div><div className="card">Printers<div className="value">{printers}</div></div><div className="card">Database<div className="value goodText">Connected</div></div><div className="card">Release<div className="value">v3.9.4</div></div></div>}<section className="card section"><h2>Account & administration</h2><div className="settingsLinks"><Link href="/settings/profile">My Profile</Link>{manageUsers?<Link href="/settings/users">Users & Roles</Link>:null}{owner?<Link href="/settings/permissions">Feature Categories & Permissions</Link>:null}{owner?<Link href="/settings/ai">Shared TITAN AI</Link>:null}{email?<Link href="/settings/email">Email Accounts & Servers</Link>:null}{owner?<Link href="/settings/business">Business Settings</Link>:null}{owner?<Link href="/settings/bambu">Bambu Printer Settings</Link>:null}{owner?<Link href="/settings/updates">TITAN Updates</Link>:null}{email?<Link href="/messages">My Email</Link>:null}{integrations?<Link href="/integrations">Integrations</Link>:null}{activity?<Link href="/activity">Activity Log</Link>:null}</div></section></>
}
