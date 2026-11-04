"use client";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import { ChatClient, mergeMessages, mergeThreads, type ChatMessage, type ChatThread } from "./chatClient";
import styles from "./chat.module.css";
const failureText = (error: unknown) => error instanceof Error ? error.message : "Messages could not be loaded. Please retry.";

function Conversation({ client, thread, back, introduction, onRead }: { client: ChatClient; thread: ChatThread; back: () => void; introduction?: string; onRead: (id: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]), [text, setText] = useState(introduction || "");
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [error, setError] = useState(""), [sendError, setSendError] = useState("");
  const [status, setStatus] = useState(thread.status), [hasOlder, setHasOlder] = useState(false), [olderLoading, setOlderLoading] = useState(false), [revision, setRevision] = useState(0);
  const [review, setReview] = useState(false);
  const rows = useRef<ChatMessage[]>([]), sendingRef = useRef(false), olderLock = useRef(false), end = useRef<HTMLDivElement>(null);
  const lifetime = useRef<AbortController | null>(null), readCallback = useRef(onRead), lastRead = useRef<string | null>(null);
  useEffect(() => { readCallback.current = onRead; }, [onRead]);
  function merge(incoming: ChatMessage[]) {
    rows.current = mergeMessages(rows.current, incoming);
    setMessages(rows.current);
  }
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted || document.hidden) return;
      busy = true;
      try {
        const detail = await client.thread(thread.id, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(detail.status);
        const known = new Set(rows.current.map(m => m.id));
        let before = "", incoming: ChatMessage[] = [];
        for (let page = 0; page < 50; page++) {
          const result = await client.messages(thread.id, before, controller.signal);
          if (controller.signal.aborted) return;
          incoming = mergeMessages(incoming, result);
          if (!known.size || result.length < 30 || result.some(m => known.has(m.id))) break;
          const next = result[0]?.created_at;
          if (!next || next === before || page === 49) throw new Error("Message history could not be fully refreshed. Please try again.");
          before = next;
        }
        if (!known.size) setHasOlder(incoming.length === 30);
        merge(incoming); setError(""); setLoading(false);
        // Only mark history read after it has loaded in the visible conversation.
        const newestId = rows.current.at(-1)?.id || "empty";
        if (!document.hidden && lastRead.current !== newestId) {
          try { await client.read(thread.id, controller.signal); if (!controller.signal.aborted) { lastRead.current = newestId; readCallback.current(thread.id); } }
          catch (failure) { if (!controller.signal.aborted) setError("Messages loaded, but read status could not be saved. " + failureText(failure)); }
        }
      } catch (failure) { if (!controller.signal.aborted) setError(failureText(failure)); }
      finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => void load(), 3000);
    document.addEventListener("visibilitychange", load); window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("focus", load); };
  }, [client, thread.id, revision]);
  const lastId = messages.at(-1)?.id;
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [lastId]);
  async function older() {
    if (olderLock.current || !rows.current.length) return;
    olderLock.current = true; setOlderLoading(true);
    const controller = lifetime.current;
    try {
      const before = rows.current[0].created_at;
      const incoming = await client.messages(thread.id, before, controller?.signal);
      if (controller?.signal.aborted) return;
      if (incoming.length && incoming[0].created_at === before) throw new Error("Older messages could not be loaded. Please try again.");
      merge(incoming); setHasOlder(incoming.length === 30); setError("");
    } catch (failure) { if (!controller?.signal.aborted) setError(failureText(failure)); }
    finally { olderLock.current = false; if (!controller?.signal.aborted) setOlderLoading(false); }
  }
  async function send() {
    const draft = text.trim();
    if (sendingRef.current || review || loading || status !== "open" || !draft || draft.length > 2000) return;
    sendingRef.current = true; setSending(true); setSendError("");
    const controller = lifetime.current;
    try {
      await client.send(thread.id, draft, controller?.signal);
      if (controller?.signal.aborted) return;
      setText(""); setRevision(r => r + 1);
    } catch (failure) {
      if (!controller?.signal.aborted) { setSendError(failureText(failure)); setReview(true); }
    } finally { sendingRef.current = false; if (!controller?.signal.aborted) setSending(false); }
  }
  return <section className={styles.conversation} aria-label={"Conversation with " + thread.peer.name}>
    <header className={styles.threadHeader}><button type="button" className={styles.back} onClick={back} aria-label="Back to conversations">{"\u2190"}</button><span className={styles.avatar}><ShopperIcon name="user" /></span><div><h2>{thread.peer.name}</h2><p>{thread.type} conversation · {status}</p></div><button type="button" disabled={sending} onClick={() => setRevision(r => r + 1)} aria-label="Refresh messages"><ShopperIcon name="refresh" size={18} /></button></header>
    {loading ? <p role="status" className={styles.notice}>Loading messages...</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <div className={styles.messages} aria-label="Message history">
      {hasOlder ? <button type="button" onClick={() => void older()} disabled={olderLoading}>{olderLoading ? "Loading..." : "Load older messages"}</button> : null}
      {!loading && !error && !messages.length ? <p className={styles.empty}>Start the conversation with a question.</p> : null}
      {messages.map(message => <article className={styles.bubble} data-mine={message.sender_id === client.myId} key={message.id}><span>{message.text || (message.attachment ? "" : "Message")}</span>{message.attachment ? <a href={message.attachment} target="_blank" rel="noreferrer">Open attachment</a> : null}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></article>)}<div ref={end} />
    </div>
    {sendError ? <div role="alert" className={styles.error}>{sendError} Your draft is preserved. Check the refreshed history before sending it again.{review ? <button type="button" onClick={() => { setReview(false); setSendError(""); }}>I checked the history</button> : null}</div> : null}
    {status !== "open" ? <p className={styles.notice}>This conversation is read-only.</p> : <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className={styles.srOnly} htmlFor="chat-message">Write a message</label><textarea id="chat-message" rows={2} maxLength={2000} value={text} disabled={sending || review} placeholder="Write a message..." onChange={event => setText(event.target.value)} />
      <button type="submit" disabled={loading || sending || review || !text.trim()}>{sending ? "Sending..." : "Send"}<ShopperIcon name="arrow" size={17} /></button>
    </form>}
  </section>;
}

function AccountChat({ productId, productTitle }: { productId?: string; productTitle?: string }) {
  const [client] = useState(() => new ChatClient());
  const [threads, setThreads] = useState<ChatThread[]>([]), [selected, setSelected] = useState<ChatThread | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [starting, setStarting] = useState(false), [revision, setRevision] = useState(0);
  const [pages, setPages] = useState(1), [total, setTotal] = useState(0);
  const lock = useRef(false), lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted || document.hidden) return;
      busy = true;
      try {
        let all: ChatThread[] = [], count = 0;
        for (let page = 0; page < pages; page++) {
          const result = await client.threads(page * 20, controller.signal);
          count = result.total; all = mergeThreads(all, result.threads);
          if (result.threads.length < 20) break;
        }
        if (!controller.signal.aborted) { setThreads(all); setTotal(count); setError(""); }
      } catch (failure) { if (!controller.signal.aborted) setError(failureText(failure)); }
      finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    document.addEventListener("visibilitychange", load); window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("focus", load); };
  }, [client, pages, revision]);
  async function start() {
    if (lock.current || !productId) return;
    lock.current = true; setStarting(true); setError("");
    const controller = lifetime.current;
    try {
      const conversation = await client.start(productId, controller?.signal);
      if (!controller?.signal.aborted) { setSelected(conversation); setThreads(previous => mergeThreads(previous, [conversation])); }
    } catch (failure) { if (!controller?.signal.aborted) setError(failureText(failure)); }
    finally { lock.current = false; if (!controller?.signal.aborted) setStarting(false); }
  }
  return <div className={styles.workspace} data-open={!!selected}>
    <aside className={styles.inbox} aria-label="Conversations"><header className={styles.heading}><div><h1>Messages</h1><p>Your conversations, together.</p></div><button type="button" aria-label="Refresh conversations" disabled={starting} onClick={() => setRevision(r => r + 1)}><ShopperIcon name="refresh" size={19} /></button></header>
      {productId ? <section className={styles.directory}><h2>{productTitle || "Product enquiry"}</h2><button type="button" disabled={starting} onClick={() => void start()}><ShopperIcon name="chat" size={18} />{starting ? "Opening..." : "Message seller"}</button></section> : null}
      {loading ? <p role="status" className={styles.notice}>Loading conversations...</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {!loading && !error && !threads.length ? <p className={styles.empty}>No conversations yet. Open a product and choose “Ask the seller a question” to start one.</p> : null}
      <nav aria-label="Conversation list">{threads.map(thread => <button type="button" key={thread.id} className={styles.thread} aria-pressed={selected?.id === thread.id} onClick={() => setSelected(thread)}><span className={styles.avatar}><ShopperIcon name="user" size={19} /></span><span><strong>{thread.peer.name}</strong><small>{thread.last_message || thread.type + " conversation"}</small><small>{thread.status}{thread.unread > 0 ? " · " + thread.unread + " unread" : ""}</small></span><ShopperIcon name="arrow" size={16} /></button>)}</nav>
      {threads.length < total ? <button type="button" className={styles.notice} disabled={loading || starting} onClick={() => { setLoading(true); setPages(p => p + 1); }}>Load more conversations</button> : null}
    </aside>
    {selected ? <Conversation key={selected.id} client={client} thread={selected} back={() => setSelected(null)} onRead={id => setThreads(previous => previous.map(t => t.id === id ? { ...t, unread: 0 } : t))} introduction={productId === selected.contextId && productTitle ? "Hi, I'd like to ask about " + productTitle + "." : undefined} /> : <section className={styles.placeholder}><ShopperIcon name="chat" size={48} /><h2>A conversation starts here.</h2><p>Choose a conversation, or open a product to contact its seller.</p></section>}
  </div>;
}
export default function ChatWorkspace(props: { productId?: string; productTitle?: string }) {
  const user = useAuthUser();
  if (!user?.id) return <p>Please sign in to use Messages.</p>;
  return <AccountChat key={user.id + ":" + getAuth()?.access_token} {...props} />;
}
