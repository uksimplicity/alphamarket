// Compatibility return path used by the payment backend. Keep verification in
// the existing checkout page and preserve the reference on the current origin.
export function GET(req: Request) {
  const source = new URL(req.url), query = new URLSearchParams();
  for (const key of ["reference", "trxref"]) {
    const value = source.searchParams.get(key);
    if (value) query.set(key, value);
  }
  return new Response(null, {
    status: 307,
    headers: {
      Location: "/dashboard/checkout/payment" + (query.size ? "?" + query.toString() : ""),
      "Cache-Control": "no-store",
    },
  });
}
