import AdDetail from "@/components/ads/AdDetail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdDetail id={id} basePath="/dashboard/my-ads" />; }
