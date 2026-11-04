import { nigeriaLGAs, nigeriaStates } from "@/data/nigeriaLocations";

export type AddressDetails = { houseNumber: string; street: string; lga: string; state: string };
export const emptyAddressDetails: AddressDetails = { houseNumber: "", street: "", lga: "", state: "" };
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function readAddressDetails(address: string): AddressDetails {
  const parts = address.split(",").map(value => value.trim());
  if (normalized(parts.at(-1) || "") === "nigeria") parts.pop();
  if (parts.length !== 3) return emptyAddressDetails;
  const state = nigeriaStates.find(value => normalized(value) === normalized(parts[2]));
  const lga = state && nigeriaLGAs[state].find(value => normalized(value) === normalized(parts[1]));
  if (!state || !lga) return emptyAddressDetails;
  const house = parts[0].match(/^(\S*\d\S*)\s+(.+)$/);
  return { houseNumber: house?.[1] || "", street: house?.[2] || parts[0], lga, state };
}

export function fullAddress(details: AddressDetails): string {
  const street = [details.houseNumber.trim(), details.street.trim()].filter(Boolean).join(" ");
  const parts = [street, details.lga.trim(), details.state.trim()].filter(Boolean);
  return parts.length ? [...parts, "Nigeria"].join(", ") : "";
}
