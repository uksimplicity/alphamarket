"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "@/app/page.module.css";

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

type Product = {
  title: string;
  price: string;
  oldPrice?: string;
  badge?: string;
  image: string;
  rating: string;
  reviews: string;
};

const populars: Product[] = [
  {
    title: "Wireless Noise Cancelling Headphones",
    price: "â‚¦299.00",
    oldPrice: "â‚¦349.00",
    badge: "-15%",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    rating: "4.9",
    reviews: "120",
  },
  {
    title: "Smart Fitness Watch Series 7",
    price: "â‚¦399.00",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    rating: "4.8",
    reviews: "85",
  },
  {
    title: "Urban Runner Sneakers",
    price: "â‚¦129.50",
    oldPrice: "â‚¦150",
    badge: "Sale",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    rating: "4.7",
    reviews: "210",
  },
  {
    title: "Advanced Hydrating Serum",
    price: "â‚¦45.00",
    image:
      "https://images.unsplash.com/photo-1585238342028-4bbc7c0f0cb5?auto=format&fit=crop&w=900&q=80",
    rating: "4.9",
    reviews: "58",
  },
  {
    title: "Everyday Tech Backpack",
    price: "â‚¦89.99",
    oldPrice: "â‚¦110",
    badge: "-20%",
    image:
      "https://images.unsplash.com/photo-1509769375558-7c1fefe0f0de?auto=format&fit=crop&w=900&q=80",
    rating: "4.6",
    reviews: "90",
  },
];

const newArrivals: Product[] = [
  {
    title: "Everyday Tech Backpack",
    price: "â‚¦89.99",
    oldPrice: "â‚¦110",
    badge: "-20%",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    rating: "4.8",
    reviews: "110",
  },
  {
    title: "Advanced Hydrating Serum",
    price: "â‚¦45.00",
    image:
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80",
    rating: "4.9",
    reviews: "210",
  },
  {
    title: "Urban Runner Sneakers",
    price: "â‚¦129.50",
    oldPrice: "â‚¦150",
    badge: "Sale",
    image:
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
    rating: "4.7",
    reviews: "140",
  },
  {
    title: "Smart Fitness Watch Series 7",
    price: "â‚¦399.00",
    image:
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=80",
    rating: "4.8",
    reviews: "65",
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
};

type HeaderProps = {
  onOpenSearch: () => void;
};

function Header({ onOpenSearch }: HeaderProps) {
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
            <button className={styles.iconBtn} aria-label="Orders">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            Orders
          </div>
          <div className={styles.iconLabel}>
            <button className={styles.iconBtn} aria-label="Login">
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
            </button>
            Login
          </div>
          <div className={styles.iconLabel}>
            <button className={styles.iconBtn} aria-label="Cart">
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
              <span className={styles.cartBadge}>2</span>
            </button>
            Cart
          </div>
          <Link className={styles.signupButton} to="/signup">
            Sign Up
          </Link>
        </div>

        <button className={styles.mobileCartButton} aria-label="Cart">
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
          <span className={styles.cartBadge}>2</span>
        </button>
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
        <button className={styles.accountItem}>Login</button>
        <button className={styles.accountItem}>Sign Up</button>
        <button className={styles.accountItem}>Alerts</button>
      </div>
    </nav>
  );
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div className={styles.productCard}>
      <div className={styles.productImageWrap}>
        {product.badge ? (
          <span className={styles.discountBadge}>{product.badge}</span>
        ) : null}
        <img src={product.image} alt={product.title} />
      </div>
      <div className={styles.productTitle}>{product.title}</div>
      <div className={styles.rating}>
        <span className={styles.stars}>*****</span>
        <span className={styles.reviews}>({product.reviews})</span>
      </div>
      <div className={styles.price}>
        {product.price}
        {product.oldPrice ? <span>{product.oldPrice}</span> : null}
      </div>
    </div>
  );
}

type HomeViewProps = {
  mode?: "default" | "background";
};

export default function HomeView({ mode = "default" }: HomeViewProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isBackground = mode === "background";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header onOpenSearch={() => setMobileSearchOpen(true)} />

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
            {populars.map((product) => (
              <ProductCard key={product.title} product={product} />
            ))}
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <h2>New Arrivals</h2>
            <a href="#">View All</a>
          </div>
          <div className={styles.productsGrid}>
            {newArrivals.map((product) => (
              <ProductCard key={product.title} product={product} />
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
            {populars.concat(populars).map((product, index) => (
              <ProductCard
                key={`${product.title}-${index}`}
                product={product}
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
            <div>
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
                <div className={styles.qrCode}>QR</div>
                <span>Scan to download</span>
              </div>
            </div>
          </div>
          <div className={styles.footerDivider} />
          <div className={styles.footerCopyright}>
            Â© 2026 Alpha Marketplace, Inc. All rights reserved.
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
    </div>
  );
}
