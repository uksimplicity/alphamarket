"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/app/page.module.css";
import { addToCart, parsePrice, useCartCount, formatCurrency } from "@/components/commerce/store";
import CartAddedModal from "@/components/commerce/CartAddedModal";
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
  const cartCount = useCartCount();

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
            {popularProducts.map((product) => (
              <ProductCard
                key={product.title}
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
            {newArrivalProducts.map((product) => (
              <ProductCard
                key={product.title}
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

