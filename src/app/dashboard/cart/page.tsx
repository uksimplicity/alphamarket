"use client";

import Link from "next/link";
import {
  cartSubtotal,
  formatCurrency,
  removeFromCart,
  updateCartQty,
  useCart,
} from "@/components/commerce/store";
import { Button, Card } from "@/components/dashboard/ui";
import { popularProducts } from "@/components/products/catalog";
import styles from "./page.module.css";

export default function CartPage() {
  const cart = useCart();
  const subtotal = formatCurrency(cartSubtotal(cart));
  const cartCount = cart.items.reduce((count, item) => count + item.qty, 0);
  const savedItems = popularProducts.slice(0, 2);

  return (
    <div className={styles.cartPage}>
      <div className={styles.cartHeader}>
        <div>
          <h1>Shopping Carts ({cartCount})</h1>
          <p>Review items, adjust quantities, and proceed to checkout.</p>
        </div>
        <Link href="/dashboard/home" className={styles.cartHeaderLink}>
          Continue Shopping
        </Link>
      </div>

      <div className={styles.cartLayout}>
        <Card>
          <div className={styles.cartListCard}>
            {cart.items.length === 0 ? (
              <div className={styles.cartEmpty}>
                Your cart is empty. Browse products to get started.
              </div>
            ) : (
              <div className={styles.cartList}>
                <div className={styles.cartStoreHeader}>
                  <div>
                    <div className={styles.cartStoreName}>Esteem Media Pro</div>
                    <div className={styles.cartStoreLocation}>Lagos</div>
                  </div>
                  <label className={styles.cartStoreCheckbox}>
                    <input type="checkbox" />
                    <span>Pay delivery fee for all</span>
                  </label>
                </div>
                {cart.items.map((item) => (
                  <div key={item.id} className={styles.cartItem}>
                    <div className={styles.cartItemMedia}>
                      <img src={item.image || "/placeholder.png"} alt={item.name} />
                    </div>
                    <div className={styles.cartItemInfo}>
                      <div className={styles.cartItemTitle}>{item.name}</div>
                      <div className={styles.cartItemMeta}>
                        <span className={styles.cartItemPrice}>
                          {formatCurrency(item.price)}
                        </span>
                        <span className={styles.cartItemDivider}>•</span>
                        <span>Delivery: Pickup at office</span>
                      </div>
                      <div className={styles.cartItemActions}>
                        <div className={styles.qtyControl}>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.qty - 1)}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span>{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.qty + 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button className={styles.storeButton} type="button">
                          Visit store
                        </button>
                      </div>
                    </div>
                    <div className={styles.cartItemTotal}>
                      {formatCurrency(item.price * item.qty)}
                    </div>
                    <button
                      className={styles.cartItemRemove}
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M4 7h16M9 7V5h6v2m-7 4v7m4-7v7m4-7v7M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>Cart Summary</div>
            <div className={styles.summaryRow}>
              <span>Sub total</span>
              <span>{subtotal}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Delivery fee</span>
              <span>₦0.00</span>
            </div>
            <div className={styles.summaryDivider} />
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{subtotal}</span>
            </div>
            <Link
              href={cart.items.length === 0 ? "/dashboard/home" : "/dashboard/checkout"}
              className={styles.checkoutButton}
            >
              Checkout
            </Link>
          </div>
        </Card>
      </div>

      <div className={styles.savedSection}>
        <div className={styles.savedHeader}>
          <h2>Saved Products ({savedItems.length})</h2>
          <button className={styles.savedLink} type="button">
            View All
          </button>
        </div>
        <div className={styles.savedGrid}>
          {savedItems.map((item) => (
            <div key={item.id} className={styles.savedCard}>
              <div className={styles.savedImage}>
                <img src={item.image} alt={item.title} />
                {item.badge ? <span className={styles.savedBadge}>{item.badge}</span> : null}
              </div>
              <div className={styles.savedBody}>
                <div className={styles.savedTitle}>{item.title}</div>
                <div className={styles.savedPrice}>{item.price}</div>
                <div className={styles.savedMeta}>In stock</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
