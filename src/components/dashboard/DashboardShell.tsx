"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchCurrentUserProfile, updateUserFcmToken } from "@/components/auth/profileClient";
import { clearAuth, getDisplayName } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { useCartCount } from "@/components/commerce/store";
import MarketplaceHeaderNext from "@/components/marketplace/MarketplaceHeaderNext";
import ShopperIcon, { type ShopperIconName } from "@/components/marketplace/ShopperIcon";
import styles from "./customer.module.css";

const links: { href: string; label: string; icon: ShopperIconName }[] = [
  { href: "/dashboard/home", label: "Overview", icon: "home" },
  { href: "/dashboard/orders", label: "My orders", icon: "orders" },
  { href: "/dashboard/wishlist", label: "Saved items", icon: "heart" },
  { href: "/dashboard/cart", label: "Shopping cart", icon: "cart" },
  { href: "/dashboard/profile", label: "My profile", icon: "user" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/support", label: "Help & support", icon: "help" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authUser = useAuthUser();
  const { data: profile } = useQuery({ queryKey: ["dashboard-profile", authUser?.id], queryFn: fetchCurrentUserProfile, enabled: !!authUser?.id });
  const [failedAvatar, setFailedAvatar] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cartCount = useCartCount();
  const name = profile?.name?.trim() || getDisplayName(authUser) || "My account";
  const avatar = profile?.profilePicture?.trim() || "";
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const active = (href: string) => pathname === href || (href === "/dashboard/orders" && pathname.startsWith(`${href}/`));
  const current = links.find(item => active(item.href));
  const home = pathname === "/dashboard/home";

  useEffect(() => {
    const keys = ["alpha.fcmToken", "alpha.fcm_token", "fcmToken", "fcm_token"];
    const token = keys.map(key => { try { return localStorage.getItem(key) || ""; } catch { return ""; } }).find(Boolean);
    if (token) void updateUserFcmToken(token).catch(() => {});
  }, []);

  useEffect(() => {
    if (signingOut) dialog.current?.showModal();
    else dialog.current?.close();
  }, [signingOut]);

  return (
    <div className={`buyer-theme ${styles.root}`}>
      <>
        <MarketplaceHeaderNext />
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Your account">
            <Link href="/dashboard/profile" className={styles.profile}>
              <span className={styles.avatar}>{avatar && failedAvatar !== avatar ? <img src={avatar} alt="" onError={() => setFailedAvatar(avatar)} /> : initials}</span>
              <div><strong>{name}</strong><span>Your shopping space</span></div>
            </Link>
            <span className={styles.navCaption}>YOUR MARKETPLACE</span><nav className={styles.nav} aria-label="Account navigation">{links.map(item => <Link key={item.href} href={item.href} className={active(item.href) ? styles.active : undefined} aria-current={active(item.href) ? "page" : undefined}><ShopperIcon name={item.icon} size={19} /><span>{item.label}</span>{item.icon === "cart" && cartCount > 0 && <span className={styles.count}>{cartCount}</span>}</Link>)}</nav>
            <div className={styles.shoppingNote}><span><ShopperIcon name="shield" size={22} /></span><strong>A little peace of mind.</strong><p>Keep payments on Alpha and follow your orders in one place.</p><Link href="/dashboard/support">Get a little help<ShopperIcon name="arrow" size={14} /></Link></div>
            <button type="button" className={styles.signout} onClick={() => setSigningOut(true)}><ShopperIcon name="logout" size={18} />Sign out</button>
          </aside>
          <main className={styles.main}>
            {!home ? <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/dashboard/home">Overview</Link><span>/</span><span>My account</span><span>/</span><strong>{current?.label || "Account"}</strong></nav> : null}
            {children}
          </main>
        </div>
      </>
      <nav className={styles.mobileNav} aria-label="Main navigation">{links.filter(item => ["home", "orders", "heart", "user"].includes(item.icon)).map(item => <Link key={item.href} href={item.href} className={active(item.href) ? styles.active : undefined} aria-current={active(item.href) ? "page" : undefined}><ShopperIcon name={item.icon} size={21} /><span>{item.icon === "home" ? "Home" : item.icon === "orders" ? "Orders" : item.icon === "heart" ? "Saved" : "Account"}</span></Link>)}</nav>
      <dialog ref={dialog} className={styles.dialog} onCancel={() => setSigningOut(false)} onClick={event => { if (event.target === event.currentTarget) setSigningOut(false); }} aria-labelledby="customer-signout-heading">
        <ShopperIcon name="logout" size={24} /><h2 id="customer-signout-heading">Sign out of your account?</h2><p>Your saved items and orders will be here when you return.</p><div className={styles.dialogActions}><button type="button" onClick={() => setSigningOut(false)}>Stay signed in</button><button type="button" className={styles.primary} onClick={() => { clearAuth(); window.location.assign("/login"); }}>Sign out</button></div>
      </dialog>
    </div>
  );
}
