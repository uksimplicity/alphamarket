"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/page.module.css";
import { addToCart, parsePrice, useCartCount, formatCurrency } from "@/components/commerce/store";
import CartAddedModal from "@/components/commerce/CartAddedModal";
import { getAuth } from "@/components/auth/authStorage";
import {
  Product,
  popularProducts,
  newArrivalProducts,
} from "@/components/products/catalog";

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

function normalizeLiveProduct(input: LiveProductRecord, index: number): Product {
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
  const images = Array.isArray(media?.images) ? media?.images : [];
  const image = String(
    media?.cover ??
      media?.coverUrl ??
      images[0] ??
      input.cover ??
      input.image ??
      "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80"
  );

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
    seller: {
      name: "Marketplace Seller",
      slug: "marketplace-seller",
    },
  };
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
        <Link href={`/products/${product.id}`}><img src={product.image} alt={product.title} /></Link>
      </div>
      <Link href={`/products/${product.id}`} className={styles.productTitle}>{product.title}</Link>
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

export default function HomeScreen({ userName }: { userName: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalName, setCartModalName] = useState("");
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const cartCount = useCartCount();

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
    try {
      const raw = localStorage.getItem("alpha.createdProducts");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const mapped = parsed
        .filter((row) => row && typeof row === "object")
        .map((row, index) => normalizeLiveProduct(row as LiveProductRecord, index));
      setLocalProducts(mapped);
    } catch {
      // ignore local parse issues
    }
  }, []);

  const mergedPopularProducts = [...localProducts, ...liveProducts, ...popularProducts].filter(
    (product, index, arr) => arr.findIndex((item) => item.id === product.id) === index
  );
  const mergedNewArrivals = [...localProducts, ...liveProducts, ...newArrivalProducts].filter(
    (product, index, arr) => arr.findIndex((item) => item.id === product.id) === index
  );

  const handleAddToCart = (product: Product) => {
    setCartModalName(product.title);
    setCartModalOpen(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <Link className={styles.logo} href="/">
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
                <Link
                  className={styles.iconBtn}
                  aria-label="Orders"
                  href="/dashboard/orders"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 6h16M4 12h16M4 18h10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
                Orders
              </div>
              <div className={styles.iconLabel}>
                <button
                  className={styles.userMenuTrigger}
                  onClick={() => setMenuOpen((prev) => !prev)}
                  type="button"
                >
                  <span className={styles.iconBtn} aria-label="Account">
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
                  </span>
                  <span className={styles.userName}>
                    {userName}
                    <span className={styles.userCaret}>▾</span>
                  </span>
                </button>
                <div
                  className={`${styles.userDropdown} ${
                    menuOpen ? styles.userDropdownOpen : ""
                  }`}
                >
                  <Link href="/dashboard/profile">
                    <span className={styles.dropdownIcon}>👤</span>
                    My Account
                  </Link>
                  <Link href="/dashboard/orders">
                    <span className={styles.dropdownIcon}>🧾</span>
                    My Orders
                  </Link>
                  <Link href="/login">
                    <span className={styles.dropdownIcon}>⏏</span>
                    Logout
                  </Link>
                </div>
              </div>
              <div className={styles.iconLabel}>
                <Link
                  className={styles.iconBtn}
                  aria-label="Cart"
                  href="/dashboard/cart"
                >
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
                </Link>
                Cart
              </div>
            </div>

            <Link className={styles.mobileCartButton} aria-label="Cart" href="/dashboard/cart">
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
            </Link>
          </div>

          <nav className={styles.categories}>
            <a href="#">All Categories</a>
            <a href="#">Electronics</a>
            <a href="#">Fashion</a>
            <a href="#">Home & Living</a>
            <a href="#">Beauty</a>
            <a href="#">Sports</a>
            <a href="#">Toys</a>
            <a href="#">Automotive</a>
            <a href="#">Books</a>
            <a href="#">Phones & Tablets</a>
            <a href="#">Computing</a>
            <a href="#">Appliances</a>
            <a href="#">Groceries</a>
            <a href="#">Health</a>
            <a href="#">Gaming</a>
            <a href="#">Baby Products</a>
            <a href="#">Office Supplies</a>
            <a href="#">Jewelry</a>
            <a href="#">Pets</a>
          </nav>

          <div className={styles.mobileSearchTrigger} aria-hidden="true" />
        </header>

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
            <h2>The Populars</h2>
            <a href="#">View All</a>
          </div>
          <div className={styles.productsGrid}>
            {mergedPopularProducts.map((product) => (
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

      <CartAddedModal
        open={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        productName={cartModalName}
        cartCount={cartCount}
      />
    </div>
  );
}

