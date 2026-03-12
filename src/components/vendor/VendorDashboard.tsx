"use client";

import styles from "./vendor.module.css";

const stats = [
  { label: "Total Sales", value: "₦4,876,000", delta: "+0.1%" },
  { label: "Total Orders", value: "1M", delta: "-0.1%" },
  { label: "Total Customers", value: "50,000", delta: "+0.1%" },
  // { label: "Shipping Delays", value: "500", delta: "-0.1%" },
  { label: "Refund Requests", value: "4,876", delta: "+0.1%" },
  { label: "Stock Products", value: "4,876", delta: "-0.1%" },
  { label: "Amount in Escrow", value: "₦1,240,000", delta: "+0.1%" },
  // { label: "Payment Failures", value: "4,876", delta: "+0.1%" },
];

const cities = [
  { name: "Lagos", value: "₦2.4m" },
  { name: "Abuja", value: "₦2.0m" },
  { name: "Port Harcourt", value: "₦1.3m" },
  { name: "Kano", value: "₦800k" },
];

const orders = new Array(5).fill(null).map((_, index) => ({
  id: `#25483${index}`,
  customer: `#5739${index}`,
  date: "01 Jul, 2022",
  items: "2",
  price: "₦40,000",
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
    <>
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
          <div className={styles.cardTitle}>Revenue by Month</div>
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
          <div className={styles.cardTitle}>Top Cities By Sales</div>
          <div className={styles.cardSubtitle}>Total Sale ₦300m</div>
          <div className={styles.countryList}>
            {cities.map((city) => (
              <div key={city.name} className={styles.countryRow}>
                <span>{city.name}</span>
                <div className={styles.spark} />
                <strong>{city.value}</strong>
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
    </>
  );
}
