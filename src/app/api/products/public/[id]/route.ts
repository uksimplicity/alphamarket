import { GET as listProducts } from "../route";
import { buyerCatalogPage } from "@/components/dashboard/buyerCatalog";

// The backend documents only a public list. Never use a seller/admin endpoint
// to resolve a buyer's product link, or report not-found after just one page.
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id.trim() || id.length > 200) return Response.json({ error: "Invalid product ID." }, { status: 400 });
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
  let offset = 0;
  const seen = new Set<string>();
  try {
    while (!signal.aborted) {
      const url = new URL(req.url);
      url.search = new URLSearchParams({ limit: "100", offset: String(offset) }).toString();
      const response = await listProducts(new Request(url, { signal }));
      if (signal.aborted) break;
      if (!response.ok) return response;
      const page = buyerCatalogPage(await response.json(), 100, offset);
      const product = page.products.find(item => item.id === id);
      if (product) return Response.json({ data: product }, { headers: { "Cache-Control": "no-store" } });
      if (!page.hasMore) return Response.json({ error: "This product isn't available." }, { status: 404 });
      const fingerprint = JSON.stringify(page.products.map(item => item.id));
      if (page.products.length && seen.has(fingerprint)) throw new Error("The catalog repeated a page.");
      if (page.products.length) seen.add(fingerprint);
      offset = page.nextOffset;
    }
    return Response.json({ error: "Product lookup took too long. Please try again." }, { status: 504 });
  } catch {
    return Response.json({ error: "This product couldn't be loaded. Please try again." }, { status: signal.aborted ? 504 : 502 });
  }
}
