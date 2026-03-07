"use client";

import styles from "@/app/page.module.css";

type CartAddedModalProps = {
  open: boolean;
  onClose: () => void;
  productName: string;
  cartCount: number;
};

export default function CartAddedModal({
  open,
  onClose,
  productName,
  cartCount,
}: CartAddedModalProps) {
  if (!open) return null;

  return (
    <div
      className={styles.cartModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Added to cart"
      onClick={onClose}
    >
      <div className={styles.cartModal} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.cartModalClose}
          aria-label="Close"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6l-12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className={styles.cartModalIcon}>
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#2f7a3d" strokeWidth="6" />
            <path
              d="M20 33l8 8 16-18"
              fill="none"
              stroke="#2f7a3d"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className={styles.cartModalText}>
          <strong>{productName}</strong> has been added to your Shopping Cart. You
          have {cartCount} {cartCount === 1 ? "item" : "items"} in your Shopping
          Cart.
        </p>

        <a className={styles.cartModalButton} href="/dashboard/cart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12l4 4 10-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          View Shopping Cart
        </a>
      </div>
    </div>
  );
}
