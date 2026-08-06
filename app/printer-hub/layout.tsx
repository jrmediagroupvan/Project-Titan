import { requireUser } from "@/lib/authorization";
export default async function Layout({children}:{children:React.ReactNode}){await requireUser();return children;}
