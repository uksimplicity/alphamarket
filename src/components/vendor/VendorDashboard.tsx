"use client";

import { Link } from "react-router-dom";
import styles from "./vendor.module.css";

const stats = [
  { label: "Total Sales", value: "$4,876", delta: "+0.1%" },
  { label: "Total Orders", value: "1M", delta: "-0.1%" },
  { label: "Total Customers", value: "50,000", delta: "+0.1%" },
  { label: "Shipping Delays", value: "500", delta: "-0.1%" },
  { label: "Refund Requests", value: "4,876", delta: "+0.1%" },
  { label: "Stock Products", value: "4,876", delta: "-0.1%" },
  { label: "Abandoned Carts", value: "4,876", delta: "+0.1%" },
  { label: "Payment Failures", value: "4,876", delta: "-0.1%" },
];

const countries = [
  { name: "Canada", value: "2400k" },
  { name: "Korean", value: "200k" },
  { name: "France", value: "300k" },
  { name: "German", value: "48000k" },
];

const orders = new Array(5).fill(null).map((_, index) => ({
  id: `#25483${index}`,
  customer: `#5739${index}`,
  date: "01 Jul, 2022",
  items: "2",
  price: "$40",
  status: "Processing",
}));

const products = new Array(4).fill(null).map((_, index) => ({
  name: "Product Name",
  id: `ID: #2345${index}`,
  category: "Cloth",
  stock: "10",
  vendor: "G-Shop",
}));

export default function VendorDashboard() {
  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Alpha Marketplace" />
        </div>
        <div className={styles.navGroup}>
          <div className={`${styles.navItem} ${styles.navItemActive}`}>
            Dashboard
          </div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Product Management</div>
          <div className={styles.navItem}>Manage Product</div>
          <div className={styles.navItem}>Categories & Attributes</div>
          <div className={styles.navItem}>Manage Inventory</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Order Management</div>
          <div className={styles.navItem}>Orders</div>
          <div className={styles.navItem}>Transactions</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>User Management</div>
          <div className={styles.navItem}>Staff User</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Reports & Analytics</div>
          <div className={styles.navItem}>Sales reports</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Finance Management</div>
          <div className={styles.navItem}>Earning</div>
          <div className={styles.navItem}>Withdraws</div>
          <div className={styles.navItem}>Refunds</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Promotional Deals</div>
          <div className={styles.navItem}>Coupon</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Help & Support</div>
          <div className={styles.navItem}>Inbox</div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topLeft}>
            <button className={styles.collapseBtn} aria-label="Collapse sidebar">
              <span>‹</span>
            </button>
            <div className={styles.search}>
              <span>🔍</span>
              <input aria-label="Search" placeholder="Search..." />
            </div>
          </div>
          <div className={styles.topActions}>
            <span>🇬🇧</span>
            <div className={styles.actionIcon}>
              🔔
              <span className={styles.badge}>5</span>
            </div>
            <div className={styles.actionIcon}>
              ✉️
              <span className={styles.badge}>8</span>
            </div>
            <div className={`${styles.profile} ${styles.profileMenu}`}>
              <div className={styles.avatar} />
              <div className={styles.profileMeta}>
                <span className={styles.profileName}>Jacob</span>
                <span className={styles.profileRole}>Vendor</span>
              </div>
              <span className={styles.caret}>▾</span>
              <div className={styles.profileDropdown}>
                <button className={styles.profileItem}>Profile</button>
                <Link className={styles.profileItem} to="/login">
                  Logout
                </Link>
              </div>
            </div>
          </div>
        </div>

        <section className={styles.gridStats}>
          {stats.map((item) => (
            <div key={item.label} className={styles.statCard}>
              <div className={styles.statLabel}>{item.label}</div>
              <div className={styles.statValue}>{item.value}</div>
              <div className={styles.statDelta}>{item.delta}</div>
            </div>
          ))}
        </section>

        <section className={styles.gridWide}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Accommodation Revenue</div>
            <div className={styles.cardSubtitle}>(+43%) than last year</div>
            <div className={styles.bars}>
              {new Array(12).fill(null).map((_, index) => (
                <div
                  key={index}
                  className={styles.bar}
                  style={{ height: `${30 + ((index * 7) % 60)}%` }}
                />
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Top Countries By sales</div>
            <div className={styles.cardSubtitle}>Total Sale 300M</div>
            <div className={styles.countryList}>
              {countries.map((country) => (
                <div key={country.name} className={styles.countryRow}>
                  <span>{country.name}</span>
                  <div className={styles.spark} />
                  <strong>{country.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.statusWrap}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Order Status</div>
            <div className={styles.cardSubtitle}>Summary by shipment</div>
            <div className={styles.pie} />
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#3366ff" }} />
                New Shipment
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#4a77ff" }} />
                Processing
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#5d87ff" }} />
                Delivered
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#6f97ff" }} />
                Cancelled
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#81a7ff" }} />
                Pending shipments
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: "#93b7ff" }} />
                Returned
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Order Fulfillment Status</div>
            <div className={styles.progressList}>
              {[
                { label: "Shipped orders", value: "30 (30%)", width: "30%" },
                { label: "Delivered", value: "40 (56%)", width: "56%" },
                { label: "Pending shipments", value: "20 (56%)", width: "20%" },
                { label: "Stuck orders", value: "10 (10%)", width: "10%" },
                { label: "Back Product", value: "2 (02%)", width: "2%" },
              ].map((row) => (
                <div key={row.label}>
                  <div className={styles.progressRow}>
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: row.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Recent Orders</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer ID</th>
                  <th>Order Date</th>
                  <th>Items</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td>{order.items}</td>
                    <td>{order.price}</td>
                    <td>
                      <span className={styles.pill}>{order.status}</span>
                    </td>
                    <td>
                      <button className={styles.actionBtn}>Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Order Status</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={`${product.id}-${index}`}>
                    <td>
                      <strong>{product.name}</strong>
                      <div>{product.id}</div>
                    </td>
                    <td>{product.category}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span className={styles.actionBtn}>Low Stock</span>
                    </td>
                    <td>{product.vendor}</td>
                    <td>
                      <button className={styles.pill}>Order Now</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <nav className={styles.mobileNav} aria-label="Vendor mobile navigation">
        <Link className={`${styles.mobileNavItem} ${styles.mobileNavItemActive}`} to="/vendor">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Home
        </Link>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Orders
        </button>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16v10H4V7zm3-3h10v3H7V4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Products
        </button>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16v12H4V6zm0 0l8 6 8-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Inbox
        </button>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M4 20c1.8-4 13.2-4 16 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Account
        </button>
      </nav>
    </div>
  );
}
