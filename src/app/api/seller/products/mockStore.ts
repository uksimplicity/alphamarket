type MockProduct = {
  id: string;
  name: string;
  category?: string;
  categoryId?: string;
  stock?: number;
  price?: number;
  basePrice?: number;
  status?: string;
  [key: string]: unknown;
};

const globalStore = globalThis as typeof globalThis & {
  __sellerMockProducts?: MockProduct[];
};

if (!globalStore.__sellerMockProducts) {
  globalStore.__sellerMockProducts = [];
}

function getStore() {
  return globalStore.__sellerMockProducts ?? [];
}

export function listMockProducts(limit = 20, offset = 0) {
  const items = getStore();
  const start = Math.max(0, offset);
  const end = start + Math.max(0, limit);
  return items.slice(start, end);
}

export function createMockProduct(input: Record<string, unknown>) {
  const incomingStatus =
    typeof input.status === "string" && input.status.trim()
      ? String(input.status).trim().toLowerCase()
      : "";
  const isPublishedFlag = input.isPublished === true || input.is_published === true;
  const derivedStatus = incomingStatus || (isPublishedFlag ? "publish" : "publish");

  const product: MockProduct = {
    ...input,
    id: String(input.id ?? crypto.randomUUID()),
    name: String(input.name ?? "Product"),
    status: derivedStatus,
    stock: Number(input.stock ?? 0),
    basePrice: Number(input.basePrice ?? 0),
    category:
      typeof input.category === "string"
        ? input.category
        : typeof input.categoryId === "string"
          ? input.categoryId
          : "Uncategorized",
  };
  getStore().unshift(product);
  return product;
}

export function getMockProduct(productId: string) {
  return getStore().find((item) => String(item.id) === String(productId)) ?? null;
}

export function updateMockProduct(productId: string, patch: Record<string, unknown>) {
  const items = getStore();
  const index = items.findIndex((item) => String(item.id) === String(productId));
  if (index < 0) return null;
  const updated: MockProduct = {
    ...items[index],
    ...patch,
    id: String(items[index].id),
  };
  items[index] = updated;
  return updated;
}

export function deleteMockProduct(productId: string) {
  const items = getStore();
  const index = items.findIndex((item) => String(item.id) === String(productId));
  if (index < 0) return false;
  items.splice(index, 1);
  return true;
}
