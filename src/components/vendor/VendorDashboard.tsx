"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAuth, getDisplayName } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import Icon, { type AdminIconName } from "@/components/admin/AdminIcon";
import { asRow, humanize, isPaid, money, needsFulfillment, orderTone, parseSellerOrders, parseSellerProducts, salesSeries, scopedOrders, type SellerOrder, type SellerProduct } from "./sellerData";
import styles from "./sellerDashboard.module.css";

type Snapshot = { owner: string; products: SellerProduct[] | null; orders: SellerOrder[] | null; errors: string[]; updatedAt: Date | null };
const empty: Snapshot = { owner: "", products: null, orders: null, errors: [], updatedAt: null };
const statusLabel = (status: string) => ["publish", "published"].includes(status) ? "Live" : humanize(status);

export default function VendorDashboard() {
  const user = useAuthUser();
  const [params, setParams] = useSearchParams();
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [refreshing, setRefreshing] = useState(true);
  const [revision, setRevision] = useState(0);
  const [range, setRange] = useState(30);
  const [orderTab, setOrderTab] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const query = params.get("search") ?? "";
  const current = snapshot.owner === user?.id ? snapshot : empty;
  const products = current.products ?? [];
  const orders = current.orders ?? [];

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function load() {
      if (inFlight || controller.signal.aborted) return;
      const auth = getAuth();
      if (!auth?.access_token || !auth.user.id) {
        setSnapshot({ ...empty, errors: ["Sign in with your seller account to see your store activity."] });
        setRefreshing(false); return;
      }
      inFlight = true; setRefreshing(true);
      const owner = auth.user.id;
      const headers = { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" };
      async function request(path: string) {
        const response = await fetch(path, { headers, cache: "no-store", signal: controller.signal });
        const payload: unknown = await response.json();
        const row = asRow(payload);
        if (!response.ok || row.success === false) throw new Error(typeof row.error === "string" ? row.error : `Request failed (${response.status}).`);
        return payload;
      }
      const results = await Promise.allSettled([
        request("/api/seller/products?limit=200&offset=0"), request("/api/seller/orders?limit=200&offset=0"),
      ]);
      if (controller.signal.aborted) return;
      setSnapshot(previous => {
        const next = previous.owner === owner ? { ...previous } : { ...empty, owner };
        const errors: string[] = [];
        if (results[0].status === "fulfilled") next.products = parseSellerProducts(results[0].value, owner);
        else errors.push("Products could not be refreshed. " + (results[0].reason instanceof Error ? results[0].reason.message : "Please try again."));
        if (results[1].status === "fulfilled") next.orders = parseSellerOrders(results[1].value, owner);
        else errors.push("Orders could not be refreshed. " + (results[1].reason instanceof Error ? results[1].reason.message : "Please try again."));
        next.errors = errors;
        if (!errors.length) next.updatedAt = new Date();
        return next;
      });
      inFlight = false; setRefreshing(false);
    }
    void load();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(visibleRefresh, 60000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("alpha-products-updated", visibleRefresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); window.removeEventListener("alpha-products-updated", visibleRefresh); };
  }, [user?.id, revision]);

  const periodOrders = useMemo(() => scopedOrders(orders, range), [orders, range]);
  const paidOrders = periodOrders.filter(isPaid);
  const paidValue = paidOrders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  const amountMissing = paidOrders.some(order => order.amount === null);
  const chart = useMemo(() => salesSeries(orders, range), [orders, range]);
  const fulfillment = orders.filter(needsFulfillment);
  const stockAlerts = products.filter(product => product.stock !== null && product.stock <= 10);
  const live = products.filter(product => ["publish", "published", "active"].includes(product.status));
  const drafts = products.filter(product => product.status === "draft");
  const inventoryKnown = products.filter(product => product.stock !== null);
  const outOfStock = inventoryKnown.filter(product => product.stock === 0);
  const stockGroups = [
    { label: "Healthy stock", count: inventoryKnown.filter(product => (product.stock ?? 0) > 10).length, tone: "healthy" },
    { label: "Running low", count: inventoryKnown.filter(product => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10).length, tone: "low" },
    { label: "Out of stock", count: outOfStock.length, tone: "out" },
  ];
  const recentOrders = [...orders].filter(order => orderTab === "all" || (orderTab === "action" ? needsFulfillment(order) : ["delivered", "confirmed", "completed"].includes(order.status)))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 5);
  const filteredProducts = products.filter(product => {
    const matches = `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    return matches && (productFilter === "all" || (productFilter === "low" ? product.stock !== null && product.stock <= 10 : product.status === "draft"));
  }).slice(0, 5);
  const firstName = user?.first_name?.trim() || getDisplayName(user).split(" ")[0] || "seller";
  function searchProducts(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("search", value); else next.delete("search");
    setParams(next, { replace: true });
  }
  function exportOrders() {
    const cell = (value: string | number | null) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [["Order ID", "Customer", "Order status", "Payment status", "Amount (NGN)", "Created"], ...periodOrders.map(order => [order.id, order.customer, order.status, order.paymentStatus, order.amount, order.createdAt])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `alpha-orders-${range}-days.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const metrics: Array<{ title: string; value: string; note: string; icon: AdminIconName; href: string; color: string }> = [
    { title: "Paid sales", value: current.orders === null ? "—" : money(amountMissing ? null : paidValue), note: amountMissing ? "Some paid orders have no reported amount" : `Confirmed payments · last ${range} days`, icon: "chart", href: "#performance", color: "blue" },
    { title: "Orders to fulfill", value: current.orders === null ? "—" : String(fulfillment.length), note: "Paid orders awaiting dispatch", icon: "orders", href: "/vendor/orders", color: "amber" },
    { title: "Live products", value: current.products === null ? "—" : String(live.length), note: current.products === null ? "Your published storefront listings" : `${drafts.length} drafts ready for your attention`, icon: "catalog", href: "/vendor/products", color: "violet" },
    { title: "Stock alerts", value: current.products === null ? "—" : String(stockAlerts.length), note: current.products === null ? "Review stock availability" : `${outOfStock.length} out of stock · restock to keep selling`, icon: "alert", href: "/vendor/products/stock", color: "rose" },
  ];

  return <div className={styles.dashboard}>
    <section className={styles.heading}>
      <div><div className={styles.eyebrow}>YOUR BUSINESS, AT A GLANCE</div><h1>Let’s make today a good one, {firstName}.</h1><p>Everything you need to keep your store moving.</p></div>
      <div className={styles.headingActions}><button className={styles.outlineButton} onClick={exportOrders} disabled={current.orders === null || !periodOrders.length}><Icon name="external" size={15} />Export report</button><button className={styles.refreshButton} onClick={() => setRevision(value => value + 1)} disabled={refreshing} aria-label="Refresh dashboard"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg></button></div>
    </section>
    {current.errors.length || snapshot.errors.length && !snapshot.owner ? <div className={styles.errorBanner} role="alert"><Icon name="alert" size={19} /><div>{(current.errors.length ? current.errors : snapshot.errors).map(message => <p key={message}>{message}</p>)}{current.updatedAt ? <small>Showing the last available snapshot.</small> : null}</div><button onClick={() => setRevision(value => value + 1)} disabled={refreshing}>Try again</button></div> : null}
    <div className={styles.toolbar}><span className={styles.syncStatus}><i className={refreshing ? styles.syncing : ""} />{refreshing ? "Updating your workspace..." : current.updatedAt ? `Last synced ${current.updatedAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : "Waiting for store data"}</span><label className={styles.rangeSelect}><Icon name="orders" size={15} /><select aria-label="Sales reporting period" value={range} onChange={event => setRange(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
    <section className={styles.metrics} aria-label="Store performance">{metrics.map(metric => <Link to={metric.href} key={metric.title} className={styles.metric}><div className={styles.metricTop}><span>{metric.title}</span><span className={`${styles.metricIcon} ${styles[metric.color]}`}><Icon name={metric.icon} size={18} /></span></div><strong className={refreshing && !current.updatedAt ? styles.loadingValue : ""}>{metric.value}</strong><p>{metric.note}</p><Icon name="chevron" size={14} className={styles.metricArrow} /></Link>)}</section>
    <div className={styles.topGrid}>
      <section id="performance" className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Sales performance</h2><p>A clearer view of your paid orders.</p></div><span className={styles.legend}><i />Paid sales</span></div>
        <div className={styles.chartSummary}><strong>{current.orders === null ? "—" : money(amountMissing ? null : paidValue)}</strong><span>{paidOrders.length} paid {paidOrders.length === 1 ? "order" : "orders"} in this period</span></div>
        {current.orders === null || amountMissing ? <div className={styles.chartEmpty}><Icon name="chart" size={32} /><strong>{amountMissing ? "Some paid order amounts are unavailable" : refreshing ? "Loading your sales activity" : "Sales activity is unavailable"}</strong><span>Your sales trend appears when confirmed payment amounts are available.</span></div> : paidOrders.length ? <div className={styles.chart} role="img" aria-label={`Paid sales over the last ${range} days: ${money(amountMissing ? null : paidValue)}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 15, right: 12, left: -14, bottom: 0 }}><defs><linearGradient id="sellerSalesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4475ff" stopOpacity={0.17} /><stop offset="100%" stopColor="#4475ff" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" strokeDasharray="3 4" /><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={45} tick={{ fill: "#99a4b9", fontSize: 10 }} dy={12} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#99a4b9", fontSize: 10 }} tickFormatter={value => value >= 1000000 ? `₦${value / 1000000}m` : value >= 1000 ? `₦${value / 1000}k` : `₦${value}`} /><Tooltip formatter={value => [money(Number(value)), "Paid sales"]} contentStyle={{ border: "1px solid #e5eaf3", borderRadius: 8, fontSize: 12 }} /><Area type="monotone" dataKey="sales" stroke="#4475ff" strokeWidth={2.5} fill="url(#sellerSalesFill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <div className={styles.chartEmpty}><span className={styles.emptyIcon}><Icon name="chart" size={25} /></span><strong>Your next chapter starts with a sale.</strong><span>No paid orders in this period. Keep your listings fresh and ready.</span><Link to="/vendor/products/create">Add a product <Icon name="chevron" size={13} /></Link></div>}
        <div className={styles.chartFooter}><span>NGN · Paid order value, before fees or refunds</span><span>Not a withdrawable balance</span></div>
      </section>
      <aside className={styles.attentionPanel}><div className={styles.panelHeader}><div><span className={styles.attentionEyebrow}>MAKE YOUR NEXT MOVE</span><h2>Needs your attention</h2></div><Icon name="overview" size={19} /></div>
        <Link to="/vendor/orders" className={styles.attentionRow}><span className={`${styles.attentionIcon} ${styles.blue}`}><Icon name="orders" size={19} /></span><span><strong>Keep orders moving</strong><small>{current.orders === null ? "Check your latest orders" : `${fulfillment.length} paid orders waiting for fulfillment`}</small></span><Icon name="chevron" size={15} /></Link>
        <Link to="/vendor/products/stock" className={styles.attentionRow}><span className={`${styles.attentionIcon} ${styles.amber}`}><Icon name="catalog" size={19} /></span><span><strong>Give your shelves a refill</strong><small>{current.products === null ? "Review your stock levels" : `${stockAlerts.length} listings need a stock check`}</small></span><Icon name="chevron" size={15} /></Link>
        <Link to="/vendor/products/draft" className={styles.attentionRow}><span className={`${styles.attentionIcon} ${styles.violet}`}><Icon name="orders" size={19} /></span><span><strong>Bring your drafts to life</strong><small>{current.products === null ? "Finish your next listing" : `${drafts.length} unfinished product listings`}</small></span><Icon name="chevron" size={15} /></Link>
        <div className={styles.storeTip}><span>SELLER NOTE</span><p>Great photos. Clear details.<br />A little care goes a long way.</p><Link to="/vendor/products/create">Create your next listing <Icon name="chevron" size={13} /></Link></div>
      </aside>
    </div>
    <section className={styles.panel} id="orders"><div className={styles.panelHeader}><div><h2>Recent orders</h2><p>Your customers’ next great experience starts here.</p></div><Link className={styles.textLink} to="/vendor/orders">View all orders <Icon name="chevron" size={13} /></Link></div><div className={styles.tabs} role="group" aria-label="Filter recent orders">{[{ key: "all", label: "All orders" }, { key: "action", label: "To fulfill" }, { key: "delivered", label: "Delivered" }].map(tab => <button aria-pressed={orderTab === tab.key} className={orderTab === tab.key ? styles.tabActive : ""} key={tab.key} onClick={() => setOrderTab(tab.key)}>{tab.label}{tab.key === "action" && current.orders !== null ? <span>{fulfillment.length}</span> : null}</button>)}</div>
      {recentOrders.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Fulfillment</th><th className={styles.alignRight}>Amount</th><th><span className={styles.srOnly}>Details</span></th></tr></thead><tbody>{recentOrders.map(order => <tr key={order.id}><td><Link className={styles.orderId} to={`/vendor/orders/${encodeURIComponent(order.id)}`}>#{order.id.slice(-8).toUpperCase()}</Link></td><td><span className={styles.customer}><i>{order.customer[0]?.toUpperCase()}</i>{order.customer}</span></td><td>{order.createdAt && Number.isFinite(Date.parse(order.createdAt)) ? new Date(order.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : "—"}</td><td><span className={`${styles.pill} ${styles[orderTone(order.paymentStatus)]}`}>{humanize(order.paymentStatus)}</span></td><td><span className={`${styles.pill} ${styles[orderTone(order.status)]}`}>{humanize(order.status)}</span></td><td className={styles.alignRight}><strong>{money(order.amount)}</strong></td><td><Link className={styles.rowArrow} to={`/vendor/orders/${encodeURIComponent(order.id)}`} aria-label={`View order ${order.id}`}><Icon name="chevron" size={15} /></Link></td></tr>)}</tbody></table></div> : <div className={styles.tableEmpty}><Icon name="orders" size={26} /><strong>{current.orders === null ? refreshing ? "Loading your orders..." : "Orders are unavailable" : orderTab === "action" ? "You’re all caught up." : "No orders to show yet."}</strong><p>{orderTab === "action" ? "Paid orders waiting for fulfillment will appear here." : "New orders will appear here as customers shop your store."}</p></div>}
    </section>
    <div className={styles.bottomGrid}>
      <section className={styles.panel} id="products"><div className={styles.panelHeader}><div><h2>Your products</h2><p>A little upkeep. A better storefront.</p></div><Link className={styles.textLink} to="/vendor/products">Manage products <Icon name="chevron" size={13} /></Link></div><div className={styles.productFilters}><label><Icon name="search" size={15} /><input value={query} onChange={event => searchProducts(event.target.value)} aria-label="Filter dashboard products" placeholder="Find a product..." /></label><select aria-label="Product view" value={productFilter} onChange={event => setProductFilter(event.target.value)}><option value="all">All products</option><option value="low">Stock alerts</option><option value="draft">Drafts</option></select></div>
        {filteredProducts.length ? <div className={styles.productList}>{filteredProducts.map(product => <Link to={`/vendor/products/${encodeURIComponent(product.id)}`} key={product.id} className={styles.productRow}><span className={styles.productThumb}>{product.image ? <img src={product.image} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : <Icon name="catalog" size={22} />}</span><span className={styles.productName}><strong>{product.name}</strong><small>{product.category}</small></span><span className={styles.productStock}>{product.stock === null ? "Stock unreported" : `${product.stock} in stock`}</span><span className={`${styles.pill} ${styles[orderTone(product.status)]}`}>{statusLabel(product.status)}</span><Icon name="chevron" size={14} /></Link>)}</div> : <div className={styles.tableEmpty}><Icon name="catalog" size={27} /><strong>{query || productFilter !== "all" ? "No matching products" : current.products === null ? refreshing ? "Loading your products..." : "Products are unavailable" : "Give your store something to show."}</strong><p>{query || productFilter !== "all" ? "Try a different search or product view." : "Add your first product and make your store your own."}</p><Link className={styles.textLink} to="/vendor/products/create"><Icon name="plus" size={14} />Add product</Link></div>}
      </section>
      <div className={styles.sideStack}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Inventory health</h2><p>Keep your best sellers in stock.</p></div><Icon name="catalog" size={19} /></div><div className={styles.stockHeadline}><strong>{current.products === null ? "—" : inventoryKnown.length}</strong><span>listings with stock reported</span></div><div className={styles.stockBar} aria-hidden="true">{stockGroups.map(group => <span key={group.tone} className={styles[group.tone]} style={{ width: `${inventoryKnown.length ? group.count / inventoryKnown.length * 100 : 0}%` }} />)}</div><div className={styles.stockLegend}>{stockGroups.map(group => <div key={group.tone}><span><i className={styles[group.tone]} />{group.label}</span><strong>{current.products === null ? "—" : group.count}</strong></div>)}</div><Link to="/vendor/products/stock" className={styles.stockLink}>Manage your inventory <Icon name="chevron" size={14} /></Link></section>
      <section className={styles.escrowCard} id="payments"><span className={styles.escrowMark}><svg width="21" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z" /><path d="m8 12 3 3 5-6" /></svg></span><div><span className={styles.escrowEyebrow}>PAYMENTS & ESCROW</span><h2>Paid isn’t the same as released.</h2><p>Customer payment and the release of funds are separate steps. Review each order’s payment and delivery status.</p><Link to="/vendor/orders">Review your orders <Icon name="chevron" size={13} /></Link><Link to="/vendor/payments">Manage payouts <Icon name="chevron" size={13} /></Link><small>Available funds and withdrawal history are in Payments &amp; payouts.</small></div></section></div>
    </div>
    <p className={styles.dataNote}>Overview uses up to 200 recent orders and 200 product records. Sales dates follow your device’s local time. Unknown payment or stock values are not counted as confirmed sales or stock alerts.</p>
  </div>;
}
