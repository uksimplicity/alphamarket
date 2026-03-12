import { proxyAuthRequest } from "../_proxy";

export async function POST(req: Request) {
  return proxyAuthRequest("/auth/login", req);
}
