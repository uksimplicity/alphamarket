import { readAccountData, writeAccountData } from "./localAccountData";

export type DeliveryPoint = { latitude: number; longitude: number };
export type AddressInput = DeliveryPoint & { label: string; address: string; contact: string };
export type SavedAddress = AddressInput & { id: string };
export type AddressBook = { addresses: SavedAddress[]; defaultId: string | null };
export function deliveryPoint(latitude: string, longitude: string): DeliveryPoint | null {
  const lat = Number(latitude), lng = Number(longitude);
  return latitude.trim() && longitude.trim() && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : null;
}
function valid(value: unknown): value is AddressBook {
  if (!value || typeof value !== "object") return false;
  const book = value as AddressBook;
  return Array.isArray(book.addresses) && book.addresses.every(a => a && typeof a.id === "string" && !!a.id && typeof a.label === "string" && !!a.label.trim() && typeof a.address === "string" && !!a.address.trim() && typeof a.contact === "string" && typeof a.latitude === "number" && typeof a.longitude === "number" && !!deliveryPoint(String(a.latitude), String(a.longitude)))
    && new Set(book.addresses.map(a => a.id)).size === book.addresses.length
    && (book.defaultId === null || typeof book.defaultId === "string" && book.addresses.some(a => a.id === book.defaultId));
}
export const readAddresses = () => readAccountData("addresses", () => ({ addresses: [], defaultId: null } as AddressBook), valid);
export function saveAddress(input: AddressInput, makeDefault: boolean, id?: string) {
  const book = readAddresses();
  if (!input.label.trim() || !input.address.trim() || !deliveryPoint(String(input.latitude), String(input.longitude))) throw new Error("Enter an address name, full address and choose a delivery location.");
  if (id && !book.addresses.some(a => a.id === id)) throw new Error("This saved address no longer exists.");
  const row: SavedAddress = { ...input, id: id || crypto.randomUUID(), label: input.label.trim(), address: input.address.trim(), contact: input.contact.trim() };
  const next = { addresses: id ? book.addresses.map(a => a.id === id ? row : a) : [...book.addresses, row], defaultId: makeDefault ? row.id : book.defaultId === row.id ? null : book.defaultId };
  writeAccountData("addresses", next);
  return row;
}
export function deleteAddress(id: string) {
  const book = readAddresses();
  writeAccountData("addresses", { addresses: book.addresses.filter(a => a.id !== id), defaultId: book.defaultId === id ? null : book.defaultId });
}
export function resetAddresses() { writeAccountData("addresses", { addresses: [], defaultId: null }); }
