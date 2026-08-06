import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "../components/AppShell";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { featureSetForUser } from "@/lib/features";

export const metadata: Metadata = {
  title: "Project TITAN",
  description: "3D Printing Business Operating System",
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#07111f",
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const allowedFeatures = user ? await featureSetForUser(user) : [];
  return (
    <html lang="en-CA">
      <body><AppShell allowedFeatures={allowedFeatures}>{children}</AppShell></body>
    </html>
  );
}
