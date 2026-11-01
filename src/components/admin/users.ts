import { adminFetcher, asRecord } from "./api";

const userCountKeys = ["total_users", "users_count", "totalUsers", "usersCount"];

export function reportedUserCount(payload: unknown, userMetricOnly = false): number | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;
  for (const key of [...userCountKeys, ...(userMetricOnly ? [] : ["total_count", "totalCount", "total"])]) {
    const value = record[key];
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) continue;
    const count = Number(value);
    if (Number.isSafeInteger(count) && count >= 0) return count;
  }
  for (const key of ["data", "stats", "summary", "pagination", "meta", "users"]) {
    const count = reportedUserCount(record[key], key === "users" ? false : userMetricOnly);
    if (count !== undefined) return count;
  }
  return undefined;
}

export function userRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row) => asRecord(row)) as Record<string, unknown>[];
  const record = asRecord(payload);
  if (record) {
    for (const key of ["data", "users", "items", "results", "rows"]) {
      if (Array.isArray(record[key]) || asRecord(record[key])) return userRows(record[key]);
    }
  }
  throw new Error("The server did not return a user list. Please refresh.");
}

export async function fetchAdminUsers(): Promise<Record<string, unknown>[]> {
  const users: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const limit = 100;
  for (let page = 0; page < 1000; page++) {
    const payload = await adminFetcher<unknown>(`/users?limit=${limit}&offset=${users.length}`);
    const rows = userRows(payload);
    const signature = JSON.stringify(rows);
    if (rows.length && seen.has(signature)) throw new Error("The server repeated a user page. Please refresh.");
    seen.add(signature);
    users.push(...rows);
    const total = reportedUserCount(payload);
    if (!rows.length && total !== undefined && users.length < total) {
      throw new Error("The server returned an incomplete user list. Please refresh.");
    }
    if (!rows.length || (total !== undefined ? users.length >= total : rows.length < limit)) return users;
  }
  throw new Error("Unable to load the complete user list. Please refresh.");
}

export async function fetchAdminUserCount(): Promise<number> {
  return (await fetchAdminUsers()).length;
}

function checkMutationResult(payload: unknown) {
  const record = asRecord(payload);
  if (record?.success === false) {
    throw new Error(typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : "The account could not be updated.");
  }
}

export async function setAdminUserStatus(id: string, status: "active" | "suspended") {
  if (!id.trim()) throw new Error("This account has no user ID.");
  const result = await adminFetcher(`/users/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  checkMutationResult(result);
}

export async function deleteAdminUser(email: string) {
  if (!email.trim()) throw new Error("This account has no email address.");
  const result = await adminFetcher(`/user?email=${encodeURIComponent(email.trim())}`, { method: "DELETE" });
  checkMutationResult(result);
}

export const adminAccountQueryKeys = ["admin-users", "admin-vendors", "admin-dashboard", "admin-settings"];
