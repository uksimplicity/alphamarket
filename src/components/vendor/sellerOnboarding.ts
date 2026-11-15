export function sellerOnboarding(status: string | undefined, hasStore: boolean) {
  const normalized = status?.trim().toLowerCase();
  if (["suspended", "blocked", "banned", "rejected", "disabled"].includes(normalized || "")) {
    return { title: "Seller account needs attention", message: "Your seller account is not active. Contact support for help with verification and activation.", action: "Contact support", href: "mailto:support@archintell.com" };
  }
  if (normalized && normalized !== "active") {
    return { title: "Seller activation required", message: "An administrator must verify and activate your seller account before you can submit products. Contact seller support for assistance. Store setup is optional and does not activate your account.", action: "Contact support", href: "mailto:support@archintell.com" };
  }
  if (!hasStore) {
    return { title: "Personalize your storefront", message: "You can optionally add your store name and details. Store setup is separate from seller account activation.", action: "Set up store details", href: "/vendor/store" };
  }
  return null;
}
