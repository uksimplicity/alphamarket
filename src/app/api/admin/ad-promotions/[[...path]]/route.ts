import { forwardAds } from "../../../adsProxy";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) { return forwardAds(req, "promotions", (await context.params).path); }
export { handle as GET, handle as POST };
