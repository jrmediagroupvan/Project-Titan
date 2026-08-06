"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, Factory, Boxes, Settings, Upload, LogOut, ShoppingCart, CheckSquare, Receipt, BarChart3, PlugZap, Activity, Mail, Printer, BadgeDollarSign, ExternalLink, Bot, CalendarDays, PanelLeftClose, PanelLeftOpen, WandSparkles, PersonStanding, Workflow, Puzzle, Headphones, Network, Store, BrainCircuit, Bell, PackageSearch, DownloadCloud, ShieldCheck, Wrench, BookOpen, KeyRound, DatabaseBackup, Repeat2, ClipboardCheck, Menu, X } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { FeatureCategory } from "@prisma/client";
import ThemeMenu from "./ThemeMenu";
import TitanBrand from "./TitanBrand";
import TitanThemeStyles from "./TitanThemeStyles";

const nav = [
  ["/", "Dashboard", LayoutDashboard, "DASHBOARD", "OPERATIONS"],
  ["/customers", "CRM Customers", Users, "CUSTOMERS", "OPERATIONS"],
  ["/quotes", "Quote Builder", FileText, "QUOTES", "OPERATIONS"],
  ["/orders", "Orders", ShoppingCart, "ORDERS", "OPERATIONS"],
  ["/production", "Production", Factory, "PRODUCTION", "OPERATIONS"],
  ["/uploads", "3D Files", Upload, "UPLOADS", "OPERATIONS"],
  ["/stl-developer", "AI STL Developer", WandSparkles, "AI_STL_DEVELOPER", "OPERATIONS"],
  ["/figure-forge", "TITAN Figure Forge", PersonStanding, "AI_STL_DEVELOPER", "OPERATIONS"],
  ["/inventory", "Inventory", Boxes, "INVENTORY", "OPERATIONS"],
  ["/pricing", "Market Pricing", BadgeDollarSign, "MARKET_PRICING", "OPERATIONS"],
  ["/expenses", "Accounting", Receipt, "EXPENSES", "OPERATIONS"],
  ["/procurement", "Procurement", PackageSearch, "INVENTORY", "OPERATIONS"],
  ["/support", "Support Desk", Headphones, "CUSTOMERS", "OPERATIONS"],
  ["/quality", "Quality Control", ClipboardCheck, "PRODUCTION", "OPERATIONS"],
  ["/maintenance", "Maintenance", Wrench, "PRODUCTION", "OPERATIONS"],
  ["/calendar", "Calendar", CalendarDays, "TASKS", "WORKSPACE"],
  ["/tasks", "Tasks", CheckSquare, "TASKS", "WORKSPACE"],
  ["/messages", "Email", Mail, "EMAIL", "WORKSPACE"],
  ["/reports", "Reports", BarChart3, "REPORTS", "WORKSPACE"],
  ["/business-intelligence", "Business Intelligence", BrainCircuit, "REPORTS", "WORKSPACE"],
  ["/notifications", "Notifications", Bell, "DASHBOARD", "WORKSPACE"],
  ["/knowledge", "Knowledge Base", BookOpen, "TASKS", "WORKSPACE"],
  ["/service-plans", "Service Plans", Repeat2, "CUSTOMERS", "WORKSPACE"],
  ["/margin-intelligence", "Margin Intelligence", BadgeDollarSign, "REPORTS", "WORKSPACE"],
  ["/assistant", "AI Assistant", Bot, "AI_ASSISTANT", "WORKSPACE"],
  ["/customer-portal", "Customer Portal", ExternalLink, "CUSTOMER_PORTAL", "WORKSPACE"],
  ["/bambu", "Bambu Printers", Printer, "INTEGRATIONS", "SYSTEM"],
  ["/printer-hub", "Universal Printer Hub", Network, "INTEGRATIONS", "SYSTEM"],
  ["/channels", "Sales Channels", Store, "INTEGRATIONS", "SYSTEM"],
  ["/automations", "Automations", Workflow, "INTEGRATIONS", "SYSTEM"],
  ["/plugins", "Plugin Center", Puzzle, "INTEGRATIONS", "SYSTEM"],
  ["/integrations", "Integrations", PlugZap, "INTEGRATIONS", "SYSTEM"],
  ["/developer-api", "Developer API", KeyRound, "INTEGRATIONS", "SYSTEM"],
  ["/backups", "Backups", DatabaseBackup, "SETTINGS", "SYSTEM"],
  ["/security-center", "Security Center", ShieldCheck, "SETTINGS", "SYSTEM"],
  ["/settings/security", "My Security", ShieldCheck, "SETTINGS", "SYSTEM"],
  ["/activity", "Activity Log", Activity, "ACTIVITY", "SYSTEM"],
  ["/update-center", "Update Center", DownloadCloud, "SETTINGS", "SYSTEM"],
  ["/settings", "Settings", Settings, "SETTINGS", "SYSTEM"],
] as const;

export default function AppShell({ children, allowedFeatures = [] }: { children: React.ReactNode; allowedFeatures?: FeatureCategory[] }) {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "titanMobileMenuOpen",
      mobileOpen,
    );
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    if (mobileOpen) {
      window.setTimeout(() => mobileCloseRef.current?.focus(), 50);
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.documentElement.classList.remove("titanMobileMenuOpen");
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);
  const publicPage = pathname === "/login" || pathname === "/two-factor" || pathname.startsWith("/public/") || pathname.startsWith("/portal/");
  const allowed = new Set<string>(allowedFeatures);

  const topbar = (
    <header className="appTopbar">
      <div className="appTopbarBrand">
        {!publicPage ? <button
          className="mobileMenuButton"
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="titan-mobile-navigation"
        >
          <Menu size={23} />
        </button> : null}
        <TitanBrand compact />
        <div className="appTopbarCopy"><strong>PROJECT TITAN</strong><span>Version 4.0 · Business Command Centre</span></div>
      </div>
      <div className="appTopbarActions"><ThemeMenu /></div>
    </header>
  );

  if (publicPage) {
    return <><TitanThemeStyles /><div className="publicLayout">{topbar}<main className="publicMain">{children}</main><footer className="siteFooter">© {year} Project TITAN 4.0 · JR Media Group. All Rights Reserved.</footer></div></>;
  }

  return (
    <>
      <TitanThemeStyles />
      <div className={`layout ${collapsed ? "sidebarCollapsed" : ""} ${mobileOpen ? "mobileNavOpen" : ""}`}>
      <button
        className="mobileNavBackdrop"
        type="button"
        aria-label="Close navigation menu"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        id="titan-mobile-navigation"
        className="sidebar"
        aria-label="Primary navigation"
        aria-modal={mobileOpen ? "true" : undefined}
        role={mobileOpen ? "dialog" : undefined}
      >
        <div className="brandRow">
          <div className="brand"><TitanBrand /><span className="brandText srOnly">PROJECT TITAN</span></div>
          <button
            ref={mobileCloseRef}
            className="mobileMenuClose"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={21} />
          </button>
          <button className="sidebarToggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
        </div>
        <div className="tag">Project TITAN · Version 4.0</div>
        <nav className="nav">
          {(["OPERATIONS", "WORKSPACE", "SYSTEM"] as const).map((group) => <div className="navGroup" key={group}><div className="navGroupLabel">{group}</div>{nav.filter(([href, , , feature, itemGroup]) => itemGroup === group && (allowed.has(feature) || (href === "/settings" && allowed.has("USER_MANAGEMENT")))).map(([href, label, Icon]) => <a href={href} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} key={href} aria-current={pathname === href ? "page" : undefined}><Icon size={17} /><span>{label}</span></a>)}</div>)}
        </nav>
        <form action={logoutAction}><button className="navLogout"><LogOut size={16}/> Sign out</button></form>
      </aside>
      <div className="contentColumn">{topbar}<main className="main">{children}</main><footer className="siteFooter">© {year} Project TITAN 4.0 · JR Media Group. All Rights Reserved.</footer></div>
      </div>
    </>
  );
}
