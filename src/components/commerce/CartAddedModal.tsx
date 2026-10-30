"use client";
import { useEffect, useRef } from "react";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import styles from "./cartAdded.module.css";
type Props = { open: boolean; onClose: () => void; productName: string; cartCount: number };
export default function CartAddedModal({ open, onClose, productName, cartCount }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="cart-added-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><button type="button" className={styles.close} aria-label="Close added-to-cart dialog" onClick={onClose}><ShopperIcon name="close" size={20} /></button><span className={styles.mark}><ShopperIcon name="cart" size={30} /></span><span className={styles.eyebrow}>A GOOD FIND, IN THE BAG</span><h2 id="cart-added-title">Added to your bag.</h2><p><strong>{productName}</strong> is ready when you are.</p><span className={styles.count}>{cartCount} {cartCount === 1 ? "item" : "items"} in your shopping bag</span><a href="/dashboard/cart" className={styles.primary}>View Shopping Cart<ShopperIcon name="arrow" size={17} /></a><button type="button" className={styles.continue} onClick={onClose}>Keep exploring</button></dialog>;
}
