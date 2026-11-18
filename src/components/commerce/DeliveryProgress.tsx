import type { DeliveryTracking } from "./orderRiderTracking";
import styles from "./deliveryProgress.module.css";

export default function DeliveryProgress({ tracking }: { tracking: DeliveryTracking }) {
  const status = tracking.status.toLowerCase();
  const index = ({ requested: 0, pending: 0, assigned: 1, accepted: 1, picking_up: 1, heading_to_pickup: 1, at_pickup: 1, picked_up: 2, on_the_way: 2, in_transit: 2, delivered: 3, completed: 3 } as Record<string, number>)[status];
  const steps = ["Finding a rider", "Heading to pickup", "On the way", "Delivered"];
  if (index === undefined) return null;
  return <ol className={styles.steps} aria-label="Delivery progress">{steps.map((step, position) => <li key={step} className={styles.step} data-state={position < index || status === "completed" ? "done" : position === index ? "current" : "upcoming"} aria-current={position === index ? "step" : undefined}><span className={styles.marker} aria-hidden="true">{position < index || status === "completed" ? "✓" : position + 1}</span><span>{step}</span></li>)}</ol>;
}
