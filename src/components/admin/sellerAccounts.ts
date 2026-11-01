import { asRecord, pickString } from "./api";

export type SellerAccount = {
  id: string;
  name: string;
  email: string;
  status: string;
  store: string;
};

export function sellerAccounts(rows: Record<string, unknown>[]): SellerAccount[] {
  return rows.filter((record) => {
    const role = pickString(record, ["role", "userRole", "account_role", "user_type", "type"]).trim().toLowerCase();
    return ["seller", "vendor"].includes(role);
  }).map((record) => {
    const storeRecords = [record, ...["store", "store_profile", "storeProfile", "seller_profile", "sellerProfile", "business"]
      .map((key) => asRecord(record[key])).filter((item): item is Record<string, unknown> => item !== null)];
    let store = "";
    for (const [index, item] of storeRecords.entries()) {
      store = pickString(item, ["store_name", "storeName", "business_name", "businessName", "shop_name", "shopName", ...(index > 0 ? ["name"] : ["store"])]).trim();
      if (store) break;
      const nestedStore = asRecord(item.store);
      store = pickString(nestedStore, ["name", "store_name", "storeName"]).trim();
      if (store) break;
    }
    return {
      id: pickString(record, ["id", "user_id", "uuid"]),
      email: pickString(record, ["email"]).trim(),
      name: pickString(record, ["name", "full_name", "fullName"]).trim() ||
        `${pickString(record, ["first_name", "firstName"])} ${pickString(record, ["last_name", "lastName"])}`.trim() ||
        pickString(record, ["email"], "Unknown seller"),
      status: pickString(record, ["status"], "unknown").trim().toLowerCase(),
      store,
    };
  }).filter((seller) => seller.id);
}
