import type { AuthPayload, AuthUser } from "./authStorage";

export function tokenExpired(token: string, now = Date.now()) {
  try {
    const segment = token.split(".")[1];
    if (!segment) return false;
    const claims = JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.exp === "number" && claims.exp * 1000 <= now;
  } catch { return false; }
}
export function verifiedProfile(payload: unknown, saved: AuthPayload): AuthUser {
  let value = payload as Record<string, unknown>;
  if (!value || value.success === false) throw new Error("Your sign-in could not be verified.");
  for (let depth = 0; depth < 6; depth++) {
    const nested = ["user", "profile", "data", "result"].map(key => value[key]).find(v => v && typeof v === "object" && !Array.isArray(v));
    if (!nested) break;
    value = nested as Record<string, unknown>;
  }
  const string = (...names: string[]) => (names.map(key => value[key]).find(v => typeof v === "string" && v.trim()) as string | undefined)?.trim();
  const id = string("id", "user_id", "userId"), email = string("email");
  if (!id && !email) throw new Error("The server did not identify your account. Please retry.");
  if (saved.user.id ? id !== saved.user.id : !email || email.toLowerCase() !== saved.user.email?.toLowerCase()) throw new Error("The saved sign-in does not match this account. Please sign in again.");
  return { ...saved.user, id: id || saved.user.id, email: email || saved.user.email,
    role: (string("role", "user_role", "userRole", "account_role") || "").toLowerCase(),
    first_name: string("first_name", "firstName") || saved.user.first_name,
    last_name: string("last_name", "lastName") || saved.user.last_name,
  };
}
