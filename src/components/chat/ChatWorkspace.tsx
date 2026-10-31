"use client";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import { ChatClient, mergeMessages, type ChatMessage, type ChatThread, type ChatUser } from "./chatClient";
import styles from "./chat.module.css";
const failureText = (error: unknown) => error instanceof Error ? error.message : "Messages could not be loaded. Please retry.";

function Conversation({ client, thread, me, back, introduction }: { client: ChatClient; thread: ChatThread; me: ChatUser; back: () => void; introduction?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]), [text, setText] = useState(introduction || "");
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [error, setError] = useState(""), [sendError, setSendError] = useState("");
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const pendingRef = useRef(pending), sendingRef = useRef(false), end = useRef<HTMLDivElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let busy = false, after = 0;
    function merge(rows: ChatMessage[]) {
      setMessages(previous => mergeMessages(previous, rows));
      const draft = pendingRef.current;
      if (draft && rows.some(m => m.sender_id === me.id && m.client_id === draft.id)) { pendingRef.current = null; setPending(null); setText(""); setSendError(""); }
    }
    async function load() {
      if (busy || controller.signal.aborted || document.hidden) return;
      busy = true;
      try {
        for (let page = 0; page < 50; page++) {
          const result = await client.messages(thread.id, after, controller.signal);
          if (controller.signal.aborted) return;
          if (result.messages.some(m => m.sequence <= after) || result.hasMore && !result.messages.length) throw new Error("Messages could not be refreshed. Please retry.");
          merge(result.messages); setError("");
          if (result.messages.length) after = result.messages.at(-1)!.sequence;
          if (!result.hasMore) break;
        }
      } catch (error) { if (!controller.signal.aborted) setError(failureText(error)); }
      finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => void load(), 3000);
    document.addEventListener("visibilitychange", load); window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("focus", load); };
  }, [client, thread.id, me.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  async function send() {
    if (sendingRef.current) return;
    const draft = pendingRef.current || { id: crypto.randomUUID(), text: text.trim() };
    if (!draft.text || draft.text.length > 2000) return;
    sendingRef.current = true; pendingRef.current = draft; setPending(draft); setSending(true); setSendError("");
    try {
      const message = await client.send(thread.id, draft.id, draft.text, lifetime.current?.signal);
      if (lifetime.current?.signal.aborted) return;
      setMessages(previous => mergeMessages(previous, [message])); pendingRef.current = null; setPending(null); setText("");
    } catch (error) { if (!lifetime.current?.signal.aborted && pendingRef.current?.id === draft.id) setSendError(failureText(error)); }
    finally { sendingRef.current = false; if (!lifetime.current?.signal.aborted) setSending(false); }
  }
  return <section className={styles.conversation} aria-label={`Conversation with ${thread.peer.name}`}>
    <header className={styles.threadHeader}><button type="button" className={styles.back} onClick={back} aria-label="Back to conversations">←</button><span className={styles.avatar}><ShopperIcon name="user" /></span><div><h2>{thread.peer.name}</h2><p>Marketplace messages</p></div></header>
    {loading ? <p role="status" className={styles.notice}>Loading messages...</p> : null}
    {error ? <p role="alert" className={styles.error}>{error} Messages refresh automatically while this screen is open.</p> : null}
    <div className={styles.messages} aria-label="Message history">
      {!loading && !error && !messages.length ? <p className={styles.empty}>Start the conversation with a question.</p> : null}
      {messages.map(message => <article className={styles.bubble} data-mine={message.sender_id === me.id} key={message.id}><span>{message.text}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></article>)}<div ref={end} />
    </div>
    {sendError ? <p role="alert" className={styles.error}>{sendError} Retry to confirm this message.</p> : null}
    <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className={styles.srOnly} htmlFor="chat-message">Write a message</label><textarea id="chat-message" rows={2} maxLength={2000} value={text} disabled={sending || !!pending} placeholder="Write a message..." onChange={event => setText(event.target.value)} />
      <button type="submit" disabled={sending || !text.trim()}>{sending ? "Sending..." : pending ? "Retry send" : "Send"}<ShopperIcon name="arrow" size={17} /></button>
    </form>
  </section>;
}

function AccountChat({ sellerId, productTitle }: { sellerId?: string; productTitle?: string }) {
  const [client] = useState(() => new ChatClient());
  const [me, setMe] = useState<ChatUser | null>(null), [threads, setThreads] = useState<ChatThread[]>([]), [sellers, setSellers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<ChatThread | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [starting, setStarting] = useState(false), [revision, setRevision] = useState(0);
  const lock = useRef(false), lifetime = useRef<AbortController | null>(null), requested = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let busy = false, identity: ChatUser | null = null;
    async function load() {
      if (busy || controller.signal.aborted || document.hidden) return;
      busy = true;
      try {
        identity = identity || await client.connect(controller.signal);
        const conversations = await client.threads(controller.signal);
        const directory = identity.role === "buyer" ? await client.sellers(controller.signal) : [];
        if (!controller.signal.aborted) { setMe(identity); setThreads(conversations); setSellers(directory); setError(""); }
        if (sellerId && identity.role === "buyer" && !requested.current) {
          requested.current = true;
          if (!directory.some(seller => seller.id === sellerId)) throw new Error("This seller isn't available to message yet. Try again later.");
          const conversation = await client.start(sellerId, controller.signal);
          if (!controller.signal.aborted) setSelected(conversation);
        }
      } catch (error) { if (!controller.signal.aborted) setError(failureText(error)); }
      finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => void load(), 3000);
    document.addEventListener("visibilitychange", load); window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("focus", load); };
  }, [client, sellerId, revision]);
  async function start(seller: ChatUser) {
    if (lock.current) return;
    lock.current = true; setStarting(true); setError("");
    try { const thread = await client.start(seller.id, lifetime.current?.signal); if (!lifetime.current?.signal.aborted) { setSelected(thread); setThreads(previous => previous.some(t => t.id === thread.id) ? previous : [thread, ...previous]); } }
    catch (error) { if (!lifetime.current?.signal.aborted) setError(failureText(error)); }
    finally { lock.current = false; if (!lifetime.current?.signal.aborted) setStarting(false); }
  }
  const availableSellers = sellers.filter(seller => !threads.some(thread => thread.peer.id === seller.id));
  return <div className={styles.workspace} data-open={!!selected}>
    <aside className={styles.inbox} aria-label="Conversations"><header className={styles.heading}><div><h1>Messages</h1><p>Your conversations, together.</p></div><button type="button" aria-label="Refresh conversations" onClick={() => { requested.current = false; setRevision(r => r + 1); }}><ShopperIcon name="refresh" size={19} /></button></header>
      {loading ? <p role="status" className={styles.notice}>Loading conversations...</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {!loading && !error && !threads.length ? <p className={styles.empty}>No conversations yet.</p> : null}
      <nav aria-label="Conversation list">{threads.map(thread => <button type="button" key={thread.id} className={styles.thread} aria-pressed={selected?.id === thread.id} onClick={() => setSelected(thread)}><span className={styles.avatar}><ShopperIcon name="user" size={19} /></span><span><strong>{thread.peer.name}</strong><small>{thread.last_message || "Start a conversation"}</small></span><ShopperIcon name="arrow" size={16} /></button>)}</nav>
      {me?.role === "buyer" && (!sellers.length || availableSellers.length > 0) ? <section className={styles.directory}><h2>Start a conversation</h2>{!sellers.length ? <p>No sellers are available to message yet.</p> : availableSellers.map(seller => <button type="button" key={seller.id} disabled={starting} onClick={() => void start(seller)}><ShopperIcon name="chat" size={18} />{seller.name}<span>Message</span></button>)}</section> : null}
    </aside>
    {selected && me ? <Conversation key={selected.id} client={client} thread={selected} me={me} back={() => setSelected(null)} introduction={sellerId === selected.peer.id && productTitle ? `Hi, I'd like to ask about ${productTitle}.` : undefined} /> : <section className={styles.placeholder}><ShopperIcon name="chat" size={48} /><h2>A conversation starts here.</h2><p>Choose a conversation{me?.role === "buyer" ? " or a seller" : ""} to get started.</p></section>}
  </div>;
}
export default function ChatWorkspace(props: { sellerId?: string; productTitle?: string }) {
  const user = useAuthUser();
  if (!user) return <p>Please sign in to use Messages.</p>;
  return <AccountChat key={`${user.id || user.email}:${getAuth()?.access_token}`} {...props} />;
}
