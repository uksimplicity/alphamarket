import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
export type ChatUser = { id: string; name: string; role: string };
export type ChatThread = { id: string; peer: ChatUser; last_message: string; updated_at: string };
export type ChatMessage = { id: string; client_id: string; sender_id: string; text: string; sequence: number; created_at: string };
type Row = Record<string, unknown>;
function record(value: unknown): Row { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Row; }
function string(value: unknown): string { if (typeof value !== "string") throw new Error(); return value; }
function user(value: unknown): ChatUser { const row = record(value); const id = string(row.id); if (!id) throw new Error(); return { id, name: string(row.name), role: row.role === undefined ? "" : string(row.role) }; }
function thread(value: unknown): ChatThread { const row = record(value); return { id: string(row.id), peer: user(row.peer), last_message: string(row.last_message), updated_at: string(row.updated_at) }; }
function message(value: unknown): ChatMessage { const row = record(value); if (!Number.isSafeInteger(row.sequence) || Number(row.sequence) <= 0) throw new Error(); return { id: string(row.id), client_id: string(row.client_id), sender_id: string(row.sender_id), text: string(row.text), sequence: Number(row.sequence), created_at: string(row.created_at) }; }
function list<T>(value: unknown, decode: (value: unknown) => T): T[] { if (!Array.isArray(value)) throw new Error(); return value.map(decode); }
export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) { return [...new Map([...previous, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.sequence - b.sequence); }
export class ChatClient {
  readonly stamp = accountStamp();
  async request<T>(method: "GET" | "POST", path: string, decode: (payload: Row) => T, body?: unknown, signal?: AbortSignal): Promise<T> {
    checkAccount(this.stamp);
    const token = getAuth()!.access_token.replace(/^Bearer\s+/i, "").trim();
    const response = await fetch(`/api/chat/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
    const payload = await response.json();
    checkAccount(this.stamp);
    if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Messages could not be loaded or saved. Please retry.");
    try { return decode(record(payload)); } catch { throw new Error("The message server returned an invalid response. Please retry."); }
  }
  connect(signal?: AbortSignal) { return this.request("POST", "session", v => user(v.user), {}, signal); }
  sellers(signal?: AbortSignal) { return this.request("GET", "sellers", v => list(v.sellers, user), undefined, signal); }
  threads(signal?: AbortSignal) { return this.request("GET", "conversations", v => list(v.conversations, thread), undefined, signal); }
  start(sellerId: string, signal?: AbortSignal) { return this.request("POST", "conversations", v => thread(v.conversation), { seller_id: sellerId }, signal); }
  messages(id: string, after: number, signal?: AbortSignal) { return this.request("GET", `conversations/${encodeURIComponent(id)}/messages?after=${after}`, v => { if (typeof v.has_more !== "boolean") throw new Error(); return { messages: list(v.messages, message), hasMore: v.has_more }; }, undefined, signal); }
  send(id: string, clientId: string, text: string, signal?: AbortSignal) { return this.request("POST", `conversations/${encodeURIComponent(id)}/messages`, v => message(v.message), { client_id: clientId, text }, signal); }
}
