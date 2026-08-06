import { requireFeature } from "@/lib/features";
export default async function Layout({children}:{children:React.ReactNode}){await requireFeature("REPORTS" as any);return children;}
