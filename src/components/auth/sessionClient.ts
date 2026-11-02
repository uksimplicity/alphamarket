import { authGeneration, getAuth, type AuthPayload, type AuthUser } from "./authStorage";
import { tokenExpired, verifiedProfile } from "./sessionValidation";

const freshFor = 60000;
type Entry = { token: string; identity: string; epoch: number; profile: AuthUser; checked: number };
let verified: Entry | null = null;
let pending: { token: string; identity: string; epoch: number; promise: Promise<AuthUser> } | null = null;
const identity = (saved: AuthPayload) => saved.user.id || saved.user.email?.toLowerCase() || "";
const matches = (entry: { token: string; identity: string; epoch: number }, saved: AuthPayload) => entry.token === saved.access_token && entry.identity === identity(saved) && entry.epoch === authGeneration();

export function cachedSession(saved: AuthPayload | null): AuthUser | null {
  return saved && verified && matches(verified, saved) && Date.now() - verified.checked < freshFor && !tokenExpired(saved.access_token) ? verified.profile : null;
}
export function rememberSession(saved: AuthPayload, profile: AuthUser) {
  verified = { token: saved.access_token, identity: identity(saved), epoch: authGeneration(), profile, checked: verified?.token === saved.access_token && verified.identity === identity(saved) && verified.profile === profile ? verified.checked : Date.now() };
}
export function verifySession(saved: AuthPayload): Promise<AuthUser> {
  if (tokenExpired(saved.access_token)) return Promise.reject(new Error("Your session has expired. Please sign in again."));
  const cached = cachedSession(saved);
  if (cached) return Promise.resolve(cached);
  if (pending && matches(pending, saved)) return pending.promise;
  const epoch = authGeneration();
  const request = { token: saved.access_token, identity: identity(saved), epoch, promise: Promise.resolve(saved.user) };
  request.promise = (async () => {
    const response = await fetch("/api/user/profile", { headers: { Authorization: `Bearer ${saved.access_token.replace(/^Bearer\s+/i, "").trim()}` }, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    if (!response.ok) throw new Error("Your sign-in could not be checked. Please retry.");
    const profile = verifiedProfile(await response.json(), saved);
    const current = getAuth();
    if (!current || !matches(request, current)) throw new Error("Your sign-in changed. Please retry.");
    rememberSession(saved, profile);
    return profile;
  })().finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request.promise;
}