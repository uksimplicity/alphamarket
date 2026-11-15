import { paymentError } from "./payments";

export function orderCheckoutError(payload: unknown, fallback: string) {
  const message = paymentError(payload, fallback);
  const pickupProblem = /^pickup\s+(?:location|coordinates?)\b/i.test(message.trim())
    && /outside|invalid|missing|required|not\s+in\s+Nigeria/i.test(message);
  return pickupProblem ? {
    code: "SELLER_PICKUP_LOCATION_INVALID",
    message: "An item in your cart has a pickup location that needs updating. Please contact its seller or remove the affected item from your cart to continue.",
  } : { code: undefined, message };
}
