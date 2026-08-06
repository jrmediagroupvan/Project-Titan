import { requireFeature } from "@/lib/features";
export default async function Layout({children}:{children:React.ReactNode}){await requireFeature("PRODUCTION" as any);return children;}
