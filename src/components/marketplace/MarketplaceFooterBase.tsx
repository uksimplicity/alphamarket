"use client";

import type { ReactElement, ReactNode } from "react";
import styles from "@/app/page.module.css";

type LinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export type LinkComponent = (props: LinkComponentProps) => ReactElement;

export default function MarketplaceFooterBase({
  LinkComponent,
}: {
  LinkComponent: LinkComponent;
}) {
  return (
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
        <div className={styles.companyColumn}>
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
            <img
              className={styles.qrCode}
              src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Falphamarket-weld.vercel.app%2F"
              alt="QR code for Alpha Market Place"
              loading="lazy"
            />
            <span>Scan to download</span>
          </div>
        </div>
      </div>
      <div className={styles.footerDivider} />
      <div className={styles.footerCopyright}>
        Alpha Market Place Â© 2026. All rights reserved.
      </div>
    </footer>
  );
}
