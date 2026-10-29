"use client";

import { useState, type FormEvent } from "react";
import styles from "@/app/page.module.css";
import ShopperIcon from "./ShopperIcon";

export default function MarketplaceSearch() {
  const [query, setQuery] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") || "");
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    window.location.assign(value ? `/?q=${encodeURIComponent(value)}#browse-listings` : "/#browse-listings");
  }
  return <form className={styles.search} role="search" onSubmit={search}><ShopperIcon name="search" size={19} /><input aria-label="Search marketplace products" placeholder="Search products, brands and more" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit">Search</button></form>;
}
