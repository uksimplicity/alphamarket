import { PublicAdDetail } from "@/components/ads/PublicAds";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PublicAdDetail id={id} />; }
