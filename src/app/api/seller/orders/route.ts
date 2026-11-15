import { orderRequest } from "../orderUpstream";

export async function GET(req: Request) {
  const input = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, fallback, maximum] of [["limit", 20, 200], ["offset", 0, 1e7]] as const) {
    const value = input.has(key) ? Number(input.get(key)) : fallback;
    if (!Number.isInteger(value) || value < (key === "limit" ? 1 : 0) || value > maximum) {
      return Response.json({ error: "Invalid order pagination." }, { status: 400 });
    }
    query.set(key, String(value));
  }
  for (const key of ["status", "payment_status"]) if (input.get(key)) query.set(key, input.get(key)!);
  // The authenticated user endpoint serves sellers and buyers.
  return orderRequest(req, `/user/orders?${query}`);
}
