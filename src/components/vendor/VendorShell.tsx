"use client";

import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { clearAuth, getDisplayName } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import Icon, { type AdminIconName } from "@/components/admin/AdminIcon";
import { getCurrentSellerStoreProfile } from "@/components/store/storeProfileClient";
import styles from "./sellerShell.module.css";

type Item = { label: string; href: string; icon: AdminIconName };
const catalog: Item[] = [
  { label: "All products", href: "/vendor/products", icon: "catalog" },
  { label: "Drafts", href: "/vendor/products/draft", icon: "orders" },
  { label: "Inventory", href: "/vendor/products/stock", icon: "catalog" },
  { label: "Review queue", href: "/vendor/products/review", icon: "alert" },
  { label: "Product types", href: "/vendor/products/types", icon: "settings" },
];
const mainLinks: Item[] = [
  { label: "Overview", href: "/vendor", icon: "overview" },
  { label: "Orders", href: "/vendor/orders", icon: "orders" },
  { label: "Performance", href: "/vendor#performance", icon: "chart" },
  { label: "Payments & payouts", href: "/vendor/payments", icon: "wallet" },
];

export default function VendorShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthUser();
  const name = getDisplayName(user) || "Seller";
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const [collapsed, setCollapsed] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [store, setStore] = useState<ReturnType<typeof getCurrentSellerStoreProfile>>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const logout = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const active = (href: string) => `${location.pathname.replace(/\/$/, "")}${location.hash}` === href;
  const productRoute = location.pathname.startsWith("/vendor/products");
  const title = [...mainLinks, ...catalog, { label: "Add product", href: "/vendor/products/create" }, { label: "Store settings", href: "/vendor/store" }, { label: "Your account", href: "/vendor/profile" }]
    .find(item => active(item.href))?.label ?? (location.pathname.includes("orders/") ? "Order details" : productRoute ? "Products" : "Seller workspace");

  useEffect(() => {
    const updateStore = () => setStore(getCurrentSellerStoreProfile());
    updateStore();
    window.addEventListener("alpha-vendor-store-updated", updateStore);
    window.addEventListener("storage", updateStore);
    return () => { window.removeEventListener("alpha-vendor-store-updated", updateStore); window.removeEventListener("storage", updateStore); };
  }, [user?.id]);

  useEffect(() => {
    drawer.current?.close();
    if (account.current) account.current.open = false;
    if (location.hash) {
      const timer = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.hash, location.search]);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get("search") ?? "");
  }, [location.search]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape" && account.current) account.current.open = false;
    };
    const outside = (event: PointerEvent) => { if (account.current && !account.current.contains(event.target as Node)) account.current.open = false; };
    window.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); };
  }, []);

  function findProducts(event: FormEvent) {
    event.preventDefault();
    navigate(`/vendor${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}#products`);
  }
  function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    clearAuth();
    window.location.replace("/login/vendor");
  }
  function navItem(item: Item) {
    return <Link key={item.href} to={item.href} title={item.label} aria-current={active(item.href) ? "page" : undefined}
      className={`${styles.navLink} ${active(item.href) ? styles.active : ""}`}>
      <Icon name={item.icon} size={19} /><span>{item.label}</span>
      {active(item.href) ? <i className={styles.activeDot} /> : null}
    </Link>;
  }
  function sidebarContent(mobile = false) {
    return <>
      <Link to="/vendor" className={styles.brand} aria-label="Alpha Marketplace seller overview">
        <img src="/logo.png" alt="" /><span><strong>Alpha Marketplace</strong><small>SELLER WORKSPACE</small></span>
      </Link>
      {mobile ? <button className={`${styles.iconButton} ${styles.drawerClose}`} aria-label="Close navigation" onClick={() => drawer.current?.close()}><Icon name="close" /></button> : null}
      <Link className={styles.storeCard} to="/vendor/store" title="Store settings"><span className={styles.storeAvatar}><Icon name="catalog" size={18} /></span><span><strong>{store?.name || "Your store"}</strong><small>Manage your storefront</small></span><Icon name="chevron" size={14} /></Link>
      <nav className={styles.navigation} aria-label={mobile ? "Seller menu" : "Seller navigation"}>
        <span className={styles.caption}>WORKSPACE</span>
        {mainLinks.map(navItem)}
        <span className={styles.caption}>BUSINESS</span>
        <button className={`${styles.navLink} ${styles.groupButton} ${productRoute ? styles.groupActive : ""}`} aria-expanded={catalogOpen && (!collapsed || mobile)} onClick={() => { if (collapsed && !mobile) { setCollapsed(false); setCatalogOpen(true); } else setCatalogOpen(value => !value); }} title="Products">
          <Icon name="catalog" size={19} /><span>Products</span><Icon name="chevron" size={14} className={catalogOpen ? styles.chevronOpen : ""} />
        </button>
        {catalogOpen ? <div className={styles.subnav}>{catalog.map(item => <Link key={item.href} to={item.href} aria-current={active(item.href) ? "page" : undefined} className={active(item.href) ? styles.subActive : ""}>{item.label}</Link>)}</div> : null}
        {navItem({ label: "Store settings", href: "/vendor/store", icon: "settings" })}
        {navItem({ label: "Your account", href: "/vendor/profile", icon: "accounts" })}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.supportCard}><span className={styles.supportIcon}>?</span><strong>A little help goes a long way.</strong><p>Get support for your store and orders.</p><a href="mailto:support@archintell.com">Contact seller support <Icon name="external" size={13} /></a></div>
        <a className={styles.marketplaceLink} href="/"><Icon name="external" size={17} /><span>Visit marketplace</span></a>
      </div>
    </>;
  }

  return <div className={`${styles.workspace} ${collapsed ? styles.collapsed : ""}`}>
    <a className={styles.skipLink} href="#seller-content">Skip to content</a>
    <aside className={styles.sidebar}>{sidebarContent()}</aside>
    <dialog ref={drawer} className={styles.mobileDrawer} aria-label="Seller navigation" onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}><div className={styles.drawerInner}>{sidebarContent(true)}</div></dialog>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <button className={`${styles.iconButton} ${styles.desktopToggle}`} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)}><Icon name="panel" /></button>
        <button className={`${styles.iconButton} ${styles.mobileToggle}`} aria-label="Open navigation" onClick={() => drawer.current?.showModal()}><Icon name="menu" /></button>
        <div className={styles.breadcrumb}><span>Workspace</span><Icon name="chevron" size={12} /><strong>{title}</strong></div>
        <form className={styles.search} onSubmit={findProducts} role="search"><Icon name="search" size={17} /><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} aria-label="Search your products" placeholder="Search your products..." /><kbd>Ctrl K</kbd><button type="submit" aria-label="Search products"><Icon name="chevron" size={15} /></button></form>
        <Link to="/vendor/products/create" className={styles.headerAdd}><Icon name="plus" size={17} /><span>Add product</span></Link>
        <details className={styles.account} ref={account}><summary aria-label="Account menu"><span className={styles.avatar}>{initials}</span><span className={styles.accountName}><strong>{name}</strong><small>Seller account</small></span><Icon name="chevron" size={13} /></summary>
          <div className={styles.accountDropdown}><div><strong>{name}</strong><span>{user?.email}</span></div><Link to="/vendor/profile"><Icon name="accounts" size={16} />Your profile</Link><Link to="/vendor/store"><Icon name="settings" size={16} />Store settings</Link>{store?.slug ? <a href={`/store/${encodeURIComponent(store.slug)}`}><Icon name="external" size={16} />View public store</a> : null}<button onClick={() => { if (account.current) account.current.open = false; logout.current?.showModal(); }}><Icon name="logout" size={16} />Sign out</button></div>
        </details>
      </header>
      <main id="seller-content" tabIndex={-1} className={styles.content}><Outlet /></main>
      <footer className={styles.footer}><span>Alpha Marketplace · Seller workspace</span><span>Built for your next chapter.</span></footer>
    </div>
    <nav className={styles.mobileNav} aria-label="Seller quick navigation">{[mainLinks[0], mainLinks[1], catalog[0], { label: "Account", href: "/vendor/profile", icon: "accounts" as const }].map(item => <Link key={item.href} to={item.href} aria-current={active(item.href) ? "page" : undefined} className={active(item.href) ? styles.mobileActive : ""}><Icon name={item.icon} size={20} /><span>{item.label === "All products" ? "Products" : item.label}</span></Link>)}</nav>
    <dialog ref={logout} className={styles.logoutDialog} aria-labelledby="seller-logout-title" onCancel={() => { if (signingOut) return; }}><Icon name="logout" size={27} /><h2 id="seller-logout-title">Sign out of your workspace?</h2><p>Your store and saved products will be here when you return.</p><div><button autoFocus className={styles.secondaryButton} disabled={signingOut} onClick={() => logout.current?.close()}>Stay signed in</button><button className={styles.primaryButton} disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out..." : "Sign out"}</button></div></dialog>
  </div>;
}
