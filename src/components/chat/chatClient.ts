import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
export type ChatUser = { id: string; name: string; role: string };
export type ChatThread = { id: string; peer: ChatUser; type: string; status: string; contextId: string; last_message: string; updated_at: string; unread: number };
export type ChatMessage = { id: string; conversation_id: string; sender_id: string; text: string; attachment: string; created_at: string };
type Row = Record<string, unknown>;
function record(value: unknown): Row { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Row; }
function string(value: unknown): string { if (typeof value !== "string") throw new Error(); return value; }
function id(value: unknown): string { const result = string(value); if (!result.trim()) throw new Error(); return result; }
function date(value: unknown): string { const result = string(value); if (!Number.isFinite(Date.parse(result))) throw new Error(); return result; }
function list<T>(value: unknown, decode: (value: unknown) => T): T[] { if (!Array.isArray(value)) throw new Error(); return value.map(decode); }
function user(value: unknown): ChatUser { const row = record(value); return { id: id(row.id), name: string(row.name), role: row.role === undefined ? "" : string(row.role) }; }
export function decodeThread(value: unknown, myId: string): ChatThread {
  const row = record(value);
  const participants = list(row.participants, value => { const p = record(value); return { id: id(p.user_id), name: string(p.name), role: string(p.role) }; });
  if (!participants.some(p => p.id === myId)) throw new Error();
  const peers = participants.filter(p => p.id !== myId);
  const peer = peers[0] || { id: "", name: row.type === "support" ? "Marketplace support" : "Conversation", role: "" };
  if (!Number.isSafeInteger(row.unread_count) || Number(row.unread_count) < 0) throw new Error();
  return { id: id(row.id), peer, type: string(row.type), status: string(row.status), contextId: typeof row.context_id === "string" ? row.context_id : "",
    last_message: row.last_message_preview == null ? "" : string(row.last_message_preview), updated_at: date(row.last_message_at || row.created_at), unread: Number(row.unread_count) };
}
export function decodeMessage(value: unknown): ChatMessage {
  const row = record(value);
  return { id: id(row.id), conversation_id: id(row.conversation_id), sender_id: id(row.sender_id),
    text: row.body == null ? "" : string(row.body), attachment: typeof row.attachment_url === "string" && /^https:\/\//i.test(row.attachment_url) ? row.attachment_url : "", created_at: date(row.created_at) };
}
// Preserve sub-millisecond ordering in the backend's RFC3339 timestamps.
function compareDates(a: string, b: string) {
  return Date.parse(a) - Date.parse(b) || (a.match(/\.(\d+)/)?.[1] || "").padEnd(9, "0").localeCompare((b.match(/\.(\d+)/)?.[1] || "").padEnd(9, "0"));
}
export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  return [...new Map([...previous, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => compareDates(a.created_at, b.created_at) || a.id.localeCompare(b.id));
}
export function mergeThreads(previous: ChatThread[], incoming: ChatThread[]) {
  return [...new Map([...previous, ...incoming].map(t => [t.id, t])).values()].sort((a, b) => compareDates(b.updated_at, a.updated_at));
}
export class ChatClient {
  readonly stamp = accountStamp();
  readonly myId = id(getAuth()?.user.id);
  async request<T>(method: "GET" | "POST", path: string, decode: (payload: Row) => T, body?: unknown, signal?: AbortSignal): Promise<T> {
    checkAccount(this.stamp);
    const token = getAuth()!.access_token.replace(/^Bearer\s+/i, "").trim();
    const response = await fetch("/api/chat/" + path, { method, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", redirect: "error",
      headers: { Authorization: "Bearer " + token, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
    const payload = await response.json();
    checkAccount(this.stamp);
    if (!response.ok || payload?.success === false) throw new Error(typeof payload?.error === "string" ? payload.error : "Messages could not be loaded or saved. Please retry.");
    try { return decode(record(payload)); } catch { throw new Error("The message server returned an invalid response. Please refresh."); }
  }
  // Read-only presentation directory remains solely for existing catalog name lookups.
  sellers(signal?: AbortSignal) { return this.request("GET", "sellers", v => list(v.sellers, user), undefined, signal); }
  threads(offset = 0, signal?: AbortSignal) { return this.request("GET", "conversations?limit=20&offset=" + offset, v => {
    const rows = list(v.data, row => decodeThread(row, this.myId));
    const meta = record(v.meta);
    if (!Number.isSafeInteger(meta.total) || Number(meta.total) < 0) throw new Error();
    return { threads: rows, total: Number(meta.total) };
  }, undefined, signal); }
  thread(threadId: string, signal?: AbortSignal) { return this.request("GET", "conversations/" + encodeURIComponent(threadId), v => decodeThread(v.data, this.myId), undefined, signal); }
  start(productId: string, signal?: AbortSignal) { return this.request("POST", "conversations", v => decodeThread(v.data, this.myId), { type: "product", context_id: productId }, signal); }
  messages(threadId: string, before = "", signal?: AbortSignal) { return this.request("GET", "conversations/" + encodeURIComponent(threadId) + "/messages?limit=30" + (before ? "&before=" + encodeURIComponent(before) : ""), v => {
    const rows = list(v.data, decodeMessage);
    if (rows.some(row => row.conversation_id !== threadId)) throw new Error();
    return mergeMessages([], rows);
  }, undefined, signal); }
  send(threadId: string, text: string, signal?: AbortSignal) { return this.request("POST", "conversations/" + encodeURIComponent(threadId) + "/messages", v => { if (v.success !== true) throw new Error(); }, { body: text }, signal); }
  read(threadId: string, signal?: AbortSignal) { return this.request("POST", "conversations/" + encodeURIComponent(threadId) + "/read", v => { if (v.success !== true) throw new Error(); }, undefined, signal); }
}
