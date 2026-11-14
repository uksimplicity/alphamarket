import { forwardAds } from "../../adsProxy";
export async function GET(req: Request, context: { params: Promise<{ path?: string[] }> }) {
  return forwardAds(req, "public", (await context.params).path);
}
