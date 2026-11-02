// Only accept a telephone number, never a URL or another seller field.
export function sellerPhone(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const phone = value.trim();
    if (/^\+?[\d\s().-]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, ""))) return phone;
  }
  return "";
}

export function sellerPhoneHref(phone: string): string {
  const valid = sellerPhone(phone);
  return valid ? `tel:${valid.replace(/[^\d+]/g, "")}` : "";
}
