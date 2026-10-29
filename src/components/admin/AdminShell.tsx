"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clearAuth, getAuth, getDisplayName, getProfilePath } from "@/components/auth/authStorage";
import AdminIcon, { type AdminIconName } from "./AdminIcon";
import styles from "./admin.module.css";

type NavigationItem = { href: string; label: string };
type NavigationGroup = { label: string; icon: AdminIconName; items: NavigationItem[] };
const navigation: NavigationGroup[] = [
  { label: "Catalog", icon: "catalog", items: [
    { href: "/admin/products", label: "All products" },
    { href: "/admin/products/create", label: "Create product" },
    { href: "/admin/products#product-types", label: "Product types" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/attributes", label: "Attributes" },
    { href: "/admin/tags", label: "Tags" },
    { href: "/admin/brands", label: "Brands" },
    { href: "/admin/promotions", label: "Promotions" },
  ] },
  { label: "Orders & escrow", icon: "orders", items: [
    { href: "/admin/orders", label: "Orders & pending escrows" },
    { href: "/admin/orders#timed-out", label: "Timed-out escrows" },
    { href: "/admin/orders#release-escrow", label: "Release escrow" },
    { href: "/admin/orders#reverse-escrow", label: "Reverse escrow" },
  ] },
  { label: "Accounts", icon: "accounts", items: [
    { href: "/admin/users", label: "All users" },
    { href: "/admin/vendors", label: "Sellers" },
    { href: "/admin/notifications", label: "Riders & notifications" },
  ] },
  { label: "Reports", icon: "chart", items: [
    { href: "/admin/dashboard#revenue-trends", label: "Revenue trends" },
    { href: "/admin/dashboard#order-snapshot", label: "Order snapshot" },
    { href: "/admin/finance", label: "Revenue report" },
  ] },
  { label: "Finance", icon: "wallet", items: [
    { href: "/admin/commissions", label: "Commissions" },
    { href: "/admin/wallet", label: "Admin wallet" },
    { href: "/admin/finance#escrow-totals", label: "Escrow totals" },
    { href: "/admin/finance#pending-amounts", label: "Pending amounts" },
    { href: "/admin/finance#timed-out-amounts", label: "Timed-out amounts" },
  ] },
  { label: "Operations", icon: "delivery", items: [
    { href: "/admin/deliveries", label: "Deliveries" },
    { href: "/admin/notifications#expired-uploads", label: "Expired uploads" },
  ] },
  { label: "Settings", icon: "settings", items: [
    { href: "/admin/settings", label: "Admin accounts & access" },
    { href: "/admin/platform-settings", label: "Platform settings" },
  ] },
];
const overview = { href: "/admin/dashboard", label: "Overview" };
const allItems = [overview, ...navigation.flatMap(group => group.items)];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const [authUser] = useState(() => getAuth()?.user ?? null);
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showLogout, setShowLogout] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const logoutDialog = useRef<HTMLDialogElement>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const name = getDisplayName(authUser) || "Administrator";
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const role = (authUser?.role || "Admin").replace(/_/g, " ");
  const isActive = (href: string) => {
    const [path, hash = ""] = href.split("#");
    return pathname === path && currentHash === (hash ? `#${hash}` : "");
  };
  const activeItem = allItems.find(item => isActive(item.href)) ?? allItems.find(item => item.href.split("#")[0] === pathname);
  const activeGroup = navigation.find(group => group.items.some(item => item === activeItem));
  const title = activeItem?.label ?? "Administration";

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        if (accountMenu.current) accountMenu.current.open = false;
      }
    };
    const handleOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && accountMenu.current && !accountMenu.current.contains(event.target)) accountMenu.current.open = false;
    };
    window.addEventListener("keydown", handleKeys);
    window.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleKeys);
      window.removeEventListener("pointerdown", handleOutside);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []).filter(element => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", trapFocus);
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (showLogout) logoutDialog.current?.showModal();
    else logoutDialog.current?.close();
  }, [showLogout]);

  function navigateTo(href: string) {
    setMobileOpen(false);
    if (accountMenu.current) accountMenu.current.open = false;
    router.push(href);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchText.trim().toLowerCase();
    if (!term) { searchRef.current?.focus(); return; }
    const match = allItems.find(item => item.label.toLowerCase() === term)
      ?? allItems.find(item => `${item.label} ${item.href}`.toLowerCase().includes(term))
      ?? navigation.find(group => group.label.toLowerCase().includes(term))?.items[0];
    if (!match) { setSearchError("No matching section. Try products, sellers, or orders."); return; }
    setSearchError("");
    navigateTo(match.href);
  }

  return (
    <div className={`admin-theme ${styles.workspace} ${sidebarCollapsed ? styles.collapsed : ""}`}>
      <a href="#admin-content" className={styles.skipLink}>Skip to content</a>
      {mobileOpen && <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside ref={sidebarRef} id="admin-navigation" className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`} aria-label="Admin navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
        <div className={styles.brandRow}>
          <Link href="/admin/dashboard" className={styles.brand} onClick={() => setMobileOpen(false)} aria-label="Alpha Marketplace admin overview">
            <span className={styles.logo}><img src="/logo.png" alt="" width="46" height="30" /></span>
            <span className={styles.brandText}><strong>Alpha Marketplace</strong><span>Administration</span></span>
          </Link>
          <button type="button" className={`${styles.iconButton} ${styles.mobileClose}`} onClick={() => setMobileOpen(false)} aria-label="Close navigation"><AdminIcon name="close" /></button>
        </div>
        <nav className={styles.navigation} aria-label="Main">
          <span className={styles.navCaption}>WORKSPACE</span>
          <Link href={overview.href} className={`${styles.navLink} ${isActive(overview.href) ? styles.active : ""}`} title={sidebarCollapsed ? "Overview" : undefined} aria-current={isActive(overview.href) ? "page" : undefined} onClick={() => setMobileOpen(false)}><AdminIcon name="overview" /><span>Overview</span></Link>
          <span className={styles.navCaption}>MANAGE</span>
          {navigation.map(group => {
            const expanded = openGroups[group.label] ?? group.label === activeGroup?.label;
            return (
              <div key={group.label} className={styles.navGroup}>
                <button type="button" title={sidebarCollapsed ? group.label : undefined} className={`${styles.groupButton} ${activeGroup === group ? styles.groupCurrent : ""}`} aria-expanded={expanded && !sidebarCollapsed} aria-controls={`nav-${group.icon}`} onClick={() => {
                  if (sidebarCollapsed) { setSidebarCollapsed(false); setOpenGroups(previous => ({ ...previous, [group.label]: true })); }
                  else setOpenGroups(previous => ({ ...previous, [group.label]: !expanded }));
                }}><AdminIcon name={group.icon} /><span>{group.label}</span><AdminIcon name="chevron" size={14} className={expanded ? styles.chevronOpen : styles.chevron} /></button>
                {expanded && <div id={`nav-${group.icon}`} className={styles.subnav}>{group.items.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`${styles.subnavLink} ${isActive(item.href) ? styles.subnavActive : ""}`} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</Link>)}</div>}
              </div>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.navLink} title="View marketplace"><AdminIcon name="external" size={18} /><span>View marketplace</span></Link>
          <button type="button" className={styles.navLink} title="Sign out" onClick={() => { setShowLogout(true); setMobileOpen(false); }}><AdminIcon name="logout" size={18} /><span>Sign out</span></button>
          
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button ref={menuButtonRef} type="button" className={`${styles.iconButton} ${styles.mobileToggle}`} onClick={() => { setSidebarCollapsed(false); setMobileOpen(true); }} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="admin-navigation"><AdminIcon name="menu" /></button>
          <button type="button" className={`${styles.iconButton} ${styles.desktopToggle}`} onClick={() => setSidebarCollapsed(previous => !previous)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} aria-controls="admin-navigation"><AdminIcon name="panel" /></button>
          <div className={styles.breadcrumb}><span>Admin</span><AdminIcon name="chevron" size={12} /><strong>{title}</strong></div>
          <form className={styles.search} onSubmit={handleSearch} role="search">
            <AdminIcon name="search" size={17} />
            <input ref={searchRef} list="admin-search-options" placeholder="Search workspace…" aria-label="Search admin sections" aria-describedby={searchError ? "admin-search-error" : undefined} aria-invalid={Boolean(searchError)} value={searchText} onChange={event => { setSearchText(event.target.value); setSearchError(""); }} />
            <datalist id="admin-search-options">{allItems.map(item => <option key={item.href} value={item.label} />)}</datalist>
            <button type="submit" aria-label="Search"><AdminIcon name="chevron" size={14} /></button><kbd>Ctrl K</kbd>
            {searchError && <div id="admin-search-error" role="status" className={styles.searchError}>{searchError}</div>}
          </form>
          <Link href="/admin/notifications" className={`${styles.iconButton} ${styles.notificationButton}`} aria-label="Riders and notifications"><AdminIcon name="bell" size={19} /></Link>
          <details ref={accountMenu} className={styles.account}>
            <summary aria-label={`Account menu for ${name}`}><span className={styles.avatar}>{initials}</span><span className={styles.accountText}><strong>{name}</strong><span>{role}</span></span><AdminIcon name="chevron" size={13} className={styles.accountChevron} /></summary>
            <div className={styles.accountDropdown}><div><strong>{name}</strong><span>{role}</span></div><Link href={getProfilePath(authUser)} onClick={() => { if (accountMenu.current) accountMenu.current.open = false; }}>Your profile</Link><Link href="/admin/settings" onClick={() => { if (accountMenu.current) accountMenu.current.open = false; }}>Account settings</Link><button type="button" onClick={() => { if (accountMenu.current) accountMenu.current.open = false; setShowLogout(true); }}>Sign out</button></div>
          </details>
        </header>
        <main id="admin-content" tabIndex={-1} className={styles.content}>
          {pathname === "/admin/dashboard" ? <div className={styles.pageHeading}><h1>Overview</h1><Link href="/" className={styles.marketplaceLink}>View marketplace<AdminIcon name="external" size={15} /></Link></div> : <h1 className={styles.srOnly}>{title}</h1>}
          <div className={styles.pageContent}>{children}</div>

        </main>
      </div>
      <dialog ref={logoutDialog} className={styles.dialog} onCancel={() => setShowLogout(false)} onClick={event => { if (event.target === event.currentTarget) setShowLogout(false); }} aria-labelledby="logout-heading">
        <div className={styles.dialogIcon}><AdminIcon name="logout" size={24} /></div><h2 id="logout-heading">Sign out of your workspace?</h2><p>You can sign back in whenever you need to manage your marketplace.</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setShowLogout(false)}>Stay signed in</button><button type="button" className={styles.primaryButton} onClick={() => { clearAuth(); setShowLogout(false); router.push("/login"); }}>Sign out</button></div>
      </dialog>
    </div>
  );
}

