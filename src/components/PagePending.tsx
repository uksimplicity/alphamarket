import styles from "./pagePending.module.css";

export default function PagePending() {
  return <div className={styles.pending} role="status" aria-label="Loading page"><div /><div /><div /></div>;
}