/* eslint-disable @next/next/no-html-link-for-pages, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styles from "@/app/page.module.css";
import { addToCart, parsePrice, useCartCount, formatCurrency } from "@/components/commerce/store";
import CartAddedModal from "@/components/commerce/CartAddedModal";
import { clearAuth, getAuth, getDisplayName } from "@/components/auth/authStorage";
import {
  Product,
  popularProducts,
  newArrivalProducts,
} from "@/components/products/catalog";
import { useAdminCategoryNames } from "@/components/marketplace/useAdminCategoryNames";

const weeklyPromotions = [
  {
    tag: "Limited Time",
    title: "Tech Week Sale",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80",
  },
  {
    tag: "New Arrival",
    title: "Summer Collection",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  },
  {
    tag: "Best Seller",
    title: "Home Refresh",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80",
  },
];

const acrossBorders = [
  {
    label: "Products from South Korea",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Products from Berlin",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Products from Paris",
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
  },
  {
    label: "Products from Dubai",
    image:
      "https://images.unsplash.com/photo-1526495124232-a04e1849168c?auto=format&fit=crop&w=900&q=80",
  },
];

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
};

type LiveProductRecord = Record<string, unknown>;
type DiscoverableProduct = Product & {
  category?: string;
  location?: string;
  createdAt?: number;
  popularity?: number;
};

const LOCAL_PRODUCTS_UPDATED_EVENT = "alpha-products-updated";
const PAGE_SIZE = 12;
const FALLBACK_BASE_CREATED_AT = 1735689600000;
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_ROOT_BASE = RAW_API_BASE
  ? RAW_API_BASE.replace(/\/+$/, "").replace(/\/api\/v1$/i, "")
  : "";

function resolveMediaUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const normalized = encodeURI(raw.replace(/\\/g, "/"));
  if (!API_ROOT_BASE) return normalized;
  if (normalized.startsWith("/")) return `${API_ROOT_BASE}${normalized}`;
  return `${API_ROOT_BASE}/${normalized}`;
}

function pickMediaValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const candidates = [
    record.url,
    record.file_url,
    record.fileUrl,
    record.path,
    record.src,
    record.location,
    record.value,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" || typeof candidate === "number") {
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return "";
}

function inferLocation(seed: string) {
  const options = ["Lagos", "Abuja", "Port Harcourt", "Kano", "Enugu", "Ibadan"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 100000;
  }
  return options[hash % options.length];
}

function toTimestamp(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function inferCategory(title: string) {
  const text = title.toLowerCase();
  if (text.includes("shoe") || text.includes("fashion") || text.includes("sneaker")) {
    return "Fashion";
  }
  if (text.includes("serum") || text.includes("beauty")) {
    return "Beauty";
  }
  if (text.includes("watch") || text.includes("headphone") || text.includes("tech")) {
    return "Electronics";
  }
  return "General";
}

function normalizeLiveProduct(input: LiveProductRecord, index: number): DiscoverableProduct {
  const id = String(input.id ?? input.product_id ?? input.uuid ?? `live-${index}`);
  const title = String(input.name ?? input.title ?? "New Product");
  const numericPrice = Number(input.basePrice ?? input.base_price ?? input.price ?? 0);
  const price = `₦${Number.isFinite(numericPrice) ? numericPrice.toLocaleString() : "0"}`;
  const stock = Number(input.stock ?? input.quantity ?? 0);
  const status = String(input.status ?? "");
  const isDraft = status.toLowerCase().includes("draft");

  const media =
    input.media && typeof input.media === "object"
      ? (input.media as Record<string, unknown>)
      : null;
  const images = Array.isArray(media?.images) ? media.images : [];
  const firstImage = images.find((item) => pickMediaValue(item));
  const imageRaw =
    pickMediaValue(media?.cover) ||
    pickMediaValue(media?.coverUrl) ||
    pickMediaValue(firstImage) ||
    pickMediaValue(input.cover) ||
    pickMediaValue(input.image) ||
    "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80";
  const image =
    resolveMediaUrl(imageRaw) ||
    "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80";

  return {
    id,
    title,
    price,
    oldPrice: undefined,
    badge: isDraft ? "Draft" : stock <= 0 ? "Out of Stock" : undefined,
    image,
    rating: "4.5",
    reviews: "0",
    description: String(input.shortDescription ?? input.description ?? "No description available."),
    category: String(input.category ?? input.categoryName ?? inferCategory(title)),
    location: String(input.location ?? input.address ?? inferLocation(id)),
    createdAt: toTimestamp(
      input.createdAt ?? input.created_at ?? input.updatedAt ?? input.updated_at,
      FALLBACK_BASE_CREATED_AT + index * 60000
    ),
    popularity: Number(input.views ?? input.popularity ?? input.orders ?? 0),
    seller: {
      name: "Marketplace Seller",
      slug: "marketplace-seller",
    },
  };
}

type HeaderProps = {
  cartCount: number;
};

function Header({ cartCount }: HeaderProps) {
  const [userName, setUserName] = useState(() => getDisplayName(getAuth()?.user));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const adminCategoryNames = useAdminCategoryNames();

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "alpha.auth") {
        const nextAuth = getAuth();
        setUserName(getDisplayName(nextAuth?.user));
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <Link className={styles.logo} to="/">
          <img
            className={styles.logoImage}
            src="/logo.png"
            alt="Alpha Marketplace"
          />
        </Link>

        <div className={styles.search}>
          <input placeholder="Search products, brands, and categories" />
          <button>Search</button>
        </div>

        <div className={styles.actions}>
          <div className={styles.iconLabel}>
            <button className={styles.iconBtn} aria-label="Alerts">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M9.5 19a2.5 2.5 0 005 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            Alerts
          </div>
          <div className={styles.iconLabel}>
            <a className={styles.iconBtn} aria-label="Orders" href="/dashboard/orders">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </a>
            Orders
          </div>
          <div className={styles.iconLabel}>
            <a className={styles.iconBtn} aria-label="Cart" href="/dashboard/cart">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6h15l-2 9H7L5 3H2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="17" cy="20" r="1.5" />
              </svg>
              {cartCount > 0 ? (
                <span className={styles.cartBadge}>{cartCount}</span>
              ) : null}
            </a>
            Cart
          </div>
          {userName ? (
            <div className={styles.iconLabel}>
              <button
                type="button"
                className={styles.userMenuTrigger}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
              >
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userCaret}>˅</span>
              </button>
              <div
                className={`${styles.userDropdown} ${
                  userMenuOpen ? styles.userDropdownOpen : ""
                }`}
              >
                <a href="/dashboard/home">
                  <span className={styles.dropdownIcon}>•</span>
                  Dashboard
                </a>
                <a href="/dashboard/profile">
                  <span className={styles.dropdownIcon}>•</span>
                  Profile
                </a>
                <button
                  type="button"
                  className={styles.accountItem}
                  onClick={() => {
                    clearAuth();
                    setUserName("");
                    setUserMenuOpen(false);
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.iconLabel}>
              <Link className={styles.iconBtn} aria-label="Login" to="/login">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="8"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M4 20c1.8-4 13.2-4 16 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
              <Link to="/login">Login</Link>
            </div>
          )}
          {userName ? null : (
            <Link className={styles.signupButton} to="/signup">
              Sign Up
            </Link>
          )}
        </div>

        <a className={styles.mobileCartButton} aria-label="Cart" href="/dashboard/cart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6h15l-2 9H7L5 3H2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="17" cy="20" r="1.5" />
          </svg>
          {cartCount > 0 ? (
            <span className={styles.cartBadge}>{cartCount}</span>
          ) : null}
        </a>
      </div>

      <nav className={styles.categories}>
        <a href="#">All Categories</a>
        {adminCategoryNames.map((name) => (
          <a key={name} href="#">
            {name}
          </a>
        ))}
      </nav>

      <div className={styles.mobileSearchTrigger} aria-hidden="true" />
    </header>
  );
}

type BottomNavProps = {
  onOpenSearch: () => void;
};

function BottomNav({ onOpenSearch }: BottomNavProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [userName, setUserName] = useState(() => getDisplayName(getAuth()?.user));

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "alpha.auth") {
        const nextAuth = getAuth();
        setUserName(getDisplayName(nextAuth?.user));
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      <button className={`${styles.navItem} ${styles.navActive}`}>
        <span className={styles.navIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.navLabel}>Home</span>
      </button>
      <button className={styles.navItem}>
        <span className={styles.navIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 6h16M4 12h10M4 18h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className={styles.navLabel}>Categories</span>
      </button>
      <button className={styles.navItem} onClick={onOpenSearch}>
        <span className={styles.navIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M16.5 16.5L21 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className={styles.navLabel}>Search</span>
      </button>
      <button className={styles.navItem}>
        <span className={styles.navIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.navBadge}>2</span>
        </span>
        <span className={styles.navLabel}>Orders</span>
      </button>
      <button
        className={styles.navItem}
        onClick={() => setAccountOpen((prev) => !prev)}
        aria-expanded={accountOpen}
        aria-controls="account-menu"
      >
        <span className={styles.navIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="12"
              cy="8"
              r="4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M4 20c1.8-4 13.2-4 16 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className={styles.navLabel}>Account</span>
      </button>
      <div
        id="account-menu"
        className={`${styles.accountMenu} ${
          accountOpen ? styles.accountMenuOpen : ""
        }`}
      >
        {userName ? (
          <>
            <button className={styles.accountItem}>{userName}</button>
            <a className={styles.accountItem} href="/dashboard/home">
              Dashboard
            </a>
            <button
              className={styles.accountItem}
              onClick={() => {
                clearAuth();
                setUserName("");
                setAccountOpen(false);
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className={styles.accountItem} to="/login">
              Login
            </Link>
            <Link className={styles.accountItem} to="/signup">
              Sign Up
            </Link>
            <button className={styles.accountItem}>Alerts</button>
          </>
        )}
      </div>
    </nav>
  );
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div className={styles.productCard}>
      <div className={styles.productImageWrap}>
        {product.badge ? (
          <span className={styles.discountBadge}>{product.badge}</span>
        ) : null}
        <div className={styles.productActions}>
          <button className={styles.actionIcon} aria-label="Add to wishlist">
            ♡
          </button>
          <button
            className={`${styles.actionIcon} ${styles.actionIconPrimary}`}
            aria-label="Add to cart"
            onClick={() => {
              addToCart({
                id: product.title,
                name: product.title,
                price: parsePrice(product.price),
                image: product.image,
              });
              onAddToCart(product);
            }}
          >
            🛒
          </button>
        </div>
        <Link to={`/products/${product.id}`}><img src={product.image} alt={product.title} /></Link>
      </div>
      <Link to={`/products/${product.id}`} className={styles.productTitle}>{product.title}</Link>
      <div className={styles.rating}>
        <span className={styles.stars}>*****</span>
        <span className={styles.reviews}>({product.reviews})</span>
      </div>
      <div className={styles.price}>
        {formatCurrency(parsePrice(product.price))}
        {product.oldPrice ? <span>{formatCurrency(parsePrice(product.oldPrice))}</span> : null}
      </div>
    </div>
  );
}

type HomeViewProps = {
  mode?: "default" | "background";
};

export default function HomeView({ mode = "default" }: HomeViewProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalName, setCartModalName] = useState("");
  const [liveProducts, setLiveProducts] = useState<DiscoverableProduct[]>([]);
  const [localProducts, setLocalProducts] = useState<DiscoverableProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("popularity");
  const [page, setPage] = useState(1);
  const cartCount = useCartCount();
  const isBackground = mode === "background";

  useEffect(() => {
    let mounted = true;

    async function loadLiveProducts() {
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch("/api/seller/products?limit=50&offset=0", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.products)
              ? payload.products
              : [];
        if (!mounted || !Array.isArray(rows)) return;
        const mapped = rows
          .filter((row) => row && typeof row === "object")
          .map((row, index) => normalizeLiveProduct(row as LiveProductRecord, index));
        setLiveProducts(mapped);
      } catch {
        // keep static catalog if live load fails
      }
    }

    void loadLiveProducts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function loadLocalProducts() {
      try {
        const raw = localStorage.getItem("alpha.createdProducts");
        if (!raw) {
          setLocalProducts([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          setLocalProducts([]);
          return;
        }
        const mapped = parsed
          .filter((row) => row && typeof row === "object")
          .map((row, index) => normalizeLiveProduct(row as LiveProductRecord, index));
        setLocalProducts(mapped);
      } catch {
        setLocalProducts([]);
      }
    }

    function onProductsUpdated(event: Event) {
      const deletedId = String(
        ((event as CustomEvent<{ deletedId?: string }>)?.detail?.deletedId ?? "")
      );
      if (deletedId) {
        setLocalProducts((prev) => prev.filter((item) => item.id !== deletedId));
        setLiveProducts((prev) => prev.filter((item) => item.id !== deletedId));
      }
      loadLocalProducts();
    }

    loadLocalProducts();
    window.addEventListener(LOCAL_PRODUCTS_UPDATED_EVENT, onProductsUpdated);
    window.addEventListener("storage", loadLocalProducts);
    return () => {
      window.removeEventListener(LOCAL_PRODUCTS_UPDATED_EVENT, onProductsUpdated);
      window.removeEventListener("storage", loadLocalProducts);
    };
  }, []);

  const mergedPopularProducts = [...localProducts, ...liveProducts, ...popularProducts].filter(
    (product, index, arr) => arr.findIndex((item) => item.id === product.id) === index
  );
  const mergedNewArrivals = [...localProducts, ...liveProducts, ...newArrivalProducts].filter(
    (product, index, arr) => arr.findIndex((item) => item.id === product.id) === index
  );
  const mergedAllListings = [...mergedPopularProducts, ...mergedNewArrivals].filter(
    (product, index, arr) => arr.findIndex((item) => item.id === product.id) === index
  );
  const discoverableProducts: DiscoverableProduct[] = mergedAllListings.map(
    (product, index) => ({
      ...product,
      category: (product as DiscoverableProduct).category ?? inferCategory(product.title),
      location:
        (product as DiscoverableProduct).location ?? inferLocation(product.id || product.title),
      createdAt:
        (product as DiscoverableProduct).createdAt ?? FALLBACK_BASE_CREATED_AT + index * 60000,
      popularity:
        (product as DiscoverableProduct).popularity ??
        (Number(product.reviews) || 0),
    })
  );
  const categoryOptions = Array.from(
    new Set(discoverableProducts.map((item) => item.category || "General"))
  );
  const locationOptions = Array.from(
    new Set(discoverableProducts.map((item) => item.location || "Lagos"))
  );
  const filteredProducts = discoverableProducts
    .filter((item) => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    })
    .filter((item) =>
      categoryFilter === "all" ? true : (item.category || "").toLowerCase() === categoryFilter
    )
    .filter((item) =>
      locationFilter === "all" ? true : (item.location || "").toLowerCase() === locationFilter
    )
    .filter((item) => {
      const price = parsePrice(item.price);
      const min = minPrice ? Number(minPrice) : null;
      const max = maxPrice ? Number(maxPrice) : null;
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
      return true;
    });
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "price-asc") return parsePrice(a.price) - parsePrice(b.price);
    if (sortBy === "price-desc") return parsePrice(b.price) - parsePrice(a.price);
    if (sortBy === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortBy === "popularity") return (b.popularity || 0) - (a.popularity || 0);
    return 0;
  });
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = sortedProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddToCart = (product: Product) => {
    setCartModalName(product.title);
    setCartModalOpen(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header cartCount={cartCount} />

        <section
          className={styles.hero}
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1800&q=80')",
          }}
        >
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>Prices you'll love, daily</h1>
            <p className={styles.heroText}>
              Up to 50% off on top electronic brands this week.
            </p>
            <button className={styles.heroButton}>Shop Deals</button>
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>Weekly Promotions</h2>
            <button className={styles.sectionAction}>View Design System</button>
          </div>
          <div className={styles.promoGrid}>
            {weeklyPromotions.map((promo) => (
              <div
                key={promo.title}
                className={styles.promoCard}
                style={{ backgroundImage: `url('${promo.image}')` }}
              >
                <span className={styles.promoTag}>{promo.tag}</span>
                <strong>{promo.title}</strong>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>Browse All Listings</h2>
            <a href="#">All Products</a>
          </div>
          <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-6">
            <input
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand md:col-span-2"
              placeholder="Search by keyword"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option.toLowerCase()}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="all">All Locations</option>
              {locationOptions.map((option) => (
                <option key={option} value={option.toLowerCase()}>
                  {option}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              placeholder="Min price"
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              placeholder="Max price"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
            <select
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Sort: Price Low-High</option>
              <option value="price-desc">Sort: Price High-Low</option>
            </select>
          </div>
          <div className={styles.productsGrid}>
            {pagedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
          {pagedProducts.length === 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              No products found for your current search/filter.
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <span>
              Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>New Arrivals</h2>
            <a href="#">View All</a>
          </div>
          <div className={styles.productsGrid}>
            {mergedNewArrivals.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>Across Borders</h2>
            <a href="#">View All Regions</a>
          </div>
          <div className={styles.borderGrid}>
            {acrossBorders.map((entry) => (
              <div
                key={entry.label}
                className={styles.borderCard}
                style={{ backgroundImage: `url('${entry.image}')` }}
              >
                <span className={styles.pill}>{entry.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>Top Picks for You</h2>
            <a href="#">View All</a>
          </div>
          <div className={styles.productsGrid}>
            {popularProducts.concat(popularProducts).map((product, index) => (
              <ProductCard
                key={`${product.title}-${index}`}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
          <button className={styles.loadMore}>Load More Products</button>
        </section>
      </div>

      {!isBackground ? (
        <footer className={styles.footer}>
          <div className={styles.footerGrid}>
            <div className={styles.footerLogo}>
              <div className={styles.logo}>
                <div className={styles.logoMark}>A</div>
                <div className={styles.logoText}>
                  Alpha
                  <span>Marketplace</span>
                </div>
              </div>
              <p>
                The world's most trusted marketplace for high-quality goods,
                connecting buyers and sellers with secure transactions.
              </p>
              <div className={styles.socials}>
                <span>fb</span>
                <span>in</span>
                <span>tw</span>
              </div>
            </div>
          <div className={styles.companyColumn}>
            <div className={styles.footerTitle}>Company</div>
            <div>About Us</div>
            <div>Careers</div>
            <div>Press</div>
            <div>Blog</div>
          </div>
            <div>
              <div className={styles.footerTitle}>Help & Support</div>
              <div>Shipping Info</div>
              <div>Returns</div>
              <div>Order Status</div>
              <div>Payment Methods</div>
            </div>
            <div>
              <div className={styles.footerTitle}>Get the App</div>
              <div className={styles.qrBlock}>
                <img
                  className={styles.qrCode}
                  src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Falphamarket-weld.vercel.app%2F"
                  alt="QR code for Alpha Market Place"
                  loading="lazy"
                />
                <span>Scan to download</span>
              </div>
            </div>
          </div>
          <div className={styles.footerDivider} />
          <div className={styles.footerCopyright}>
            Alpha Market Place © 2026. All rights reserved.
          </div>
        </footer>
      ) : null}

      {!isBackground ? (
        <div
          className={`${styles.mobileSearch} ${
            mobileSearchOpen ? styles.mobileSearchOpen : ""
          }`}
        >
          <div className={styles.mobileSearchBar}>
            <input
              placeholder="Search products, brands, and categories"
              autoFocus
            />
            <button
              className={styles.mobileSearchClose}
              aria-label="Close search"
              onClick={() => setMobileSearchOpen(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6l-12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {!isBackground ? (
        <BottomNav onOpenSearch={() => setMobileSearchOpen(true)} />
      ) : null}

      {!isBackground ? (
        <CartAddedModal
          open={cartModalOpen}
          onClose={() => setCartModalOpen(false)}
          productName={cartModalName}
          cartCount={cartCount}
        />
      ) : null}
    </div>
  );
}

