"use client";

import Link from "next/link";
import {
  cartSubtotal,
  formatCurrency,
  removeFromCart,
  updateCartQty,
  useCart,
} from "@/components/commerce/store";
import { Card } from "@/components/dashboard/ui";
import styles from "./page.module.css";

export default function CartPage() {
  const cart = useCart();
  const subtotal = formatCurrency(cartSubtotal(cart));
  const cartCount = cart.items.reduce((count, item) => count + item.qty, 0);

  return (
    <div className={styles.cartPage}>
      <div className={styles.cartHeader}>
        <div>
          <h1>Your cart ({cartCount})</h1>
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
                  <div><div className={styles.cartStoreName}>Your items</div><div className={styles.cartStoreLocation}>Review delivery and the final total at checkout</div></div>
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
                        <span>Delivery calculated at checkout</span>
                      </div>
                      <div className={styles.cartItemActions}>
                        <div className={styles.qtyControl}>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.qty - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            -
                          </button>
                          <span>{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.qty + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <Link className={styles.storeButton} href={`/products/${encodeURIComponent(item.id)}`}>View product</Link>
                      </div>
                    </div>
                    <div className={styles.cartItemTotal}>
                      {formatCurrency(item.price * item.qty)}
                    </div>
                    <button
                      className={`${styles.cartItemRemove} action-icon-delete`}
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
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
              <span>Calculated at checkout</span>
            </div>
            <div className={styles.summaryDivider} />
            <div className={styles.summaryTotal}>
              <span>Items subtotal</span>
              <span>{subtotal}</span>
            </div>
            <Link
              href={cart.items.length === 0 ? "/dashboard/home" : "/dashboard/checkout?cart=1"}
              className={styles.checkoutButton}
            >
              {cart.items.length === 0 ? "Browse products" : "Continue to checkout"}
            </Link>
          </div>
        </Card>
      </div>

      <div className={styles.savedSection}><div className={styles.savedHeader}><h2>Saved items</h2><Link href="/dashboard/wishlist" className={styles.savedLink}>View saved items</Link></div></div>
    </div>
  );
}
