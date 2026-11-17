"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration } from "@/components/auth/authStorage";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";
import { ChatClient, type ChatThread } from "./chatClient";

function AccountSupport() {
  const router = useRouter();
  const [client] = useState(() => new ChatClient());
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [category, setCategory] = useState("");
  const [categoryError, setCategoryError] = useState(""), [listError, setListError] = useState(""), [actionError, setActionError] = useState("");
  const [offset, setOffset] = useState(0), [total, setTotal] = useState(0), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [starting, setStarting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCategories([]); setThreads([]); setCategoryError(""); setListError("");
    void Promise.allSettled([
      client.categories(controller.signal).then(rows => { if (!controller.signal.aborted) setCategories(rows); }).catch(error => { if (!controller.signal.aborted) setCategoryError(error.message); }),
      client.threads(offset, controller.signal, "support").then(result => { if (!controller.signal.aborted) { setThreads(result.threads.filter(row => row.type === "support")); setTotal(result.total); } }).catch(error => { if (!controller.signal.aborted) setListError(error.message); }),
    ]).then(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, offset, revision]);
  useEffect(() => () => request.current?.abort(), []);
  async function start() {
    if (request.current || !categories.some(item => item.id === category)) return;
    const controller = new AbortController(); request.current = controller; setStarting(true); setActionError("");
    try {
      const thread = await client.startSupport(category, controller.signal);
      if (!controller.signal.aborted) router.push(`/dashboard/messages?conversationId=${encodeURIComponent(thread.id)}`);
    } catch (error) { if (!controller.signal.aborted) setActionError(error instanceof Error ? error.message : "Could not open support. Refresh your conversations before trying again."); }
    finally { if (!controller.signal.aborted) { request.current = null; setStarting(false); } }
  }
  return <div className="grid gap-6">
    <Card><SectionTitle title="Contact support" subtitle="Choose a topic to open a conversation with marketplace support." />
      {loading ? <p role="status" className="mt-4 text-sm">Loading support...</p> : null}
      {categoryError ? <p role="alert" className="mt-4 text-sm text-red-700">{categoryError}</p> : null}
      {!loading && !categoryError && !categories.length ? <p className="mt-4 text-sm text-slate-500">No support topics are currently available.</p> : null}
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void start(); }}>
        <label className="grid gap-2 text-sm text-slate-600">Topic<select className="rounded-lg border border-slate-200 p-3" value={category} onChange={event => setCategory(event.target.value)} disabled={loading || starting || Boolean(categoryError)} required><option value="">Choose a topic</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Button type="submit" disabled={loading || starting || !categories.some(item => item.id === category)}>{starting ? "Opening..." : "Open support conversation"}</Button>
      </form>{actionError ? <p role="alert" className="mt-4 text-sm text-red-700">{actionError}</p> : null}
    </Card>
    <Card><SectionTitle title="Your support conversations" action={<Button variant="ghost" disabled={loading || starting} onClick={() => setRevision(value => value + 1)}>Refresh</Button>} />
      {listError ? <p role="alert" className="mt-4 text-sm text-red-700">{listError}</p> : null}
      {!loading && !listError && !threads.length ? <p className="mt-4 text-sm text-slate-500">No support conversations on this page.</p> : null}
      <div className="mt-4 grid gap-3">{threads.map(thread => <Link className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-200 p-4 text-sm" key={thread.id} href={`/dashboard/messages?conversationId=${encodeURIComponent(thread.id)}`}><span><strong>{thread.peer.name || "Marketplace support"}</strong><span className="mt-1 block text-slate-500">{thread.last_message || "Open conversation"}</span></span><span>{thread.status}{thread.unread ? ` · ${thread.unread} unread` : ""}</span></Link>)}</div>
      <nav aria-label="Support conversation pages" className="mt-4 flex items-center justify-between text-sm text-slate-500"><Button variant="ghost" disabled={!offset || loading || starting} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</Button><span>Page {offset / 20 + 1}</span><Button variant="ghost" disabled={loading || starting || Boolean(listError) || offset + 20 >= total} onClick={() => setOffset(value => value + 20)}>Next</Button></nav>
    </Card>
  </div>;
}
export default function SupportWorkspace() {
  const user = useAuthUser();
  return user?.id ? <AccountSupport key={`${user.id}:${authGeneration()}`} /> : <p>Please sign in to contact support.</p>;
}
