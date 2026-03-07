"use client";

import { useState } from "react";
import {
  cartSubtotal,
  formatCurrency,
  useCart,
} from "@/components/commerce/store";
import { Button, Card } from "@/components/dashboard/ui";
import styles from "./page.module.css";

export default function CheckoutPage() {
  const cart = useCart();
  const subtotal = formatCurrency(cartSubtotal(cart));
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.breadcrumbs}>
        <span className={styles.breadcrumbIcon}>🏬</span>
        <span>Shopping cart</span>
        <span className={styles.breadcrumbDivider}>/</span>
        <span>Checkout</span>
      </div>

      <div className={styles.checkoutLayout}>
        <div className={styles.checkoutLeft}>
          <Card className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <h2>Delivery Address</h2>
              <button
                type="button"
                className={styles.cardAction}
                onClick={() => setAddressOpen((prev) => !prev)}
              >
                Change
              </button>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.mutedText}>No address yet</p>
            </div>
            {addressOpen ? (
              <div className={styles.addressActions}>
                <button type="button" className={styles.addressGhost}>
                  Add New Address
                </button>
                <button type="button" className={styles.addressPrimary}>
                  Confirm Address
                </button>
              </div>
            ) : null}
          </Card>

          <Card className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <h2>Payment Method</h2>
              <button
                type="button"
                className={styles.cardActionPrimary}
                onClick={() => setPaymentOpen((prev) => !prev)}
              >
                Change
              </button>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.methodTitle}>Alpha Marketplace Wallet</p>
              <p className={styles.mutedText}>
                Use your Alpha Marketplace wallet to complete your purchase.
              </p>
            </div>
            {paymentOpen ? (
              <div className={styles.paymentPanel}>
                <div className={styles.paymentOption}>
                  <div className={styles.paymentRadio}>
                    <span className={styles.radioDot} />
                  </div>
                  <div className={styles.paymentInfo}>
                    <div className={styles.paymentTitle}>Alpha Marketplace Wallet</div>
                    <div className={styles.paymentDesc}>
                      Use your Alpha Marketplace wallet to complete your purchase.
                    </div>
                    <div className={styles.walletCard}>
                      <div>
                        <div className={styles.walletLabel}>Wallet Balance</div>
                        <div className={styles.walletAmount}>₦ 0.00</div>
                      </div>
                      <button className={styles.walletButton} type="button">
                        Fund Wallet
                      </button>
                    </div>
                    <span className={styles.defaultPill}>Default</span>
                  </div>
                  <div className={styles.paymentIcon}>💳</div>
                </div>

                <div className={styles.paymentDivider} />

                <div className={styles.paymentOption}>
                  <div className={styles.paymentRadioInactive} />
                  <div className={styles.paymentInfo}>
                    <div className={styles.paymentTitle}>Pay with Card or Bank</div>
                    <div className={styles.paymentDesc}>
                      Effortlessly complete transactions using your bank account.
                    </div>
                  </div>
                  <div className={styles.paymentIcon}>🏦</div>
                </div>

                <div className={styles.paymentActions}>
                  <button type="button" className={styles.paymentConfirm}>
                    Confirm Payment Method
                  </button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <h2>All Payment are Escrowed On Alpha Marketplace (Required)</h2>
              <span className={styles.shield}>🛡️</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoBox}>
                To ensure a secure transaction, your payment will be held in escrow
                until both parties have completed the transaction to their
                satisfaction. <span>See more</span>
              </div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" />
                <span>
                  I agree to the terms and condition of the Alpha Marketplace
                  Escrow system.
                </span>
              </label>
            </div>
          </Card>
        </div>

        <Card className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <h3>Cart Summary</h3>
            <button className={styles.summaryEdit} type="button">
              ✎
            </button>
          </div>
          <div className={styles.summaryList}>
            {cart.items.length === 0 ? (
              <div className={styles.emptySummary}>
                No items yet. Add products to your cart.
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.summaryThumb}>
                    <img src={item.image || "/placeholder.png"} alt={item.name} />
                  </div>
                  <div className={styles.summaryInfo}>
                    <div className={styles.summaryTitle}>{item.name}</div>
                    <div className={styles.summaryMeta}>
                      Qty {item.qty}{" "}
                      <span>{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={styles.summaryTotals}>
            <div>
              <span>Sub total</span>
              <span>{subtotal}</span>
            </div>
            <div>
              <span>Delivery fee</span>
              <span>₦0.00</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span>Total</span>
              <span>{subtotal}</span>
            </div>
          </div>
          <Button className={styles.payButton}>Pay Now</Button>
        </Card>
      </div>
    </div>
  );
}
