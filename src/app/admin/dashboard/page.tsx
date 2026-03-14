"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminFetcher, asArray, asRecord, pickNumber, pickString } from "@/components/admin/api";
import { ErrorState, Skeleton } from "@/components/dashboard/ui";

type AdminDashboardData = {
  statCards: Array<{ label: string; value: string; delta: string; trend: "up" | "down" }>;
  subCards: Array<{ label: string; value: string; delta: string; trend: "up" | "down" }>;
  revenueBars: Array<{ month: string; value: number }>;
  fulfillment: Array<{ label: string; value: number; color: string }>;
  orderStatus: Array<{ label: string; value: number; color: string }>;
  topCountries: Array<{ country: string; sales: string; trend: "up" | "down" }>;
  recentOrders: Array<{
    id: string;
    customer: string;
    date: string;
    items: string;
    price: string;
    status: string;
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    category: string;
    stock: string;
    vendor: string;
  }>;
};

const chartColors = ["#16a34a", "#0f766e", "#f97316", "#2563eb"];

function pickMetricCount(
  record: Record<string, unknown> | null,
  keys: string[],
  fallback = 0
): number {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (Array.isArray(value)) return value.length;

    const nested = asRecord(value);
    if (!nested) continue;

    const nestedCount = pickNumber(
      nested,
      ["total", "count", "length", "users_count", "total_users"],
      -1
    );
    if (nestedCount >= 0) return nestedCount;

    const nestedList = asArray(nested);
    if (nestedList.length > 0) return nestedList.length;
  }

  return fallback;
}

function resolveUsersCount(payload: unknown): number {
  return asArray(payload).length;
}

function normalizeDashboardData(
  payload: unknown,
  overrides?: { totalUsers?: number }
): AdminDashboardData {
  const record = asRecord(payload);

  const totalUsers =
    typeof overrides?.totalUsers === "number"
      ? overrides.totalUsers
      : pickMetricCount(record, ["total_users", "users_count", "users"], 0);
  const totalProducts = pickMetricCount(record, ["total_products", "products_count", "products"], 0);
  const totalOrders = pickMetricCount(record, ["total_orders", "orders_count", "orders"], 0);
  const totalRevenue = pickNumber(record, ["total_revenue", "revenue"], 0);
  const totalDeliveries = pickNumber(record, ["total_deliveries", "deliveries"], 0);
  const marketplaceCommission = pickNumber(
    record,
    ["marketplace_commission", "commission"],
    0
  );
  const riderCommission = pickNumber(record, ["rider_commission"], 0);

  const statusSource = asRecord(record?.order_status ?? record?.status_breakdown ?? null);
  const orderStatus = Object.entries(statusSource ?? {}).map(([label, value], index) => ({
    label,
    value: typeof value === "number" ? value : Number(value) || 0,
    color: chartColors[index % chartColors.length],
  }));

  const topLocationSource =
    (Array.isArray(record?.top_countries) ? record?.top_countries : null) ??
    (Array.isArray(record?.top_locations) ? record?.top_locations : null) ??
    [];
  const topCountries = topLocationSource.map((row) => {
    const item = asRecord(row);
    return {
      country: pickString(item, ["country", "name", "location"], "Unknown"),
      sales: String(pickNumber(item, ["sales", "value", "count"], 0)),
      trend: "up" as const,
    };
  });

  return {
    statCards: [
      { label: "Total Users", value: String(totalUsers), delta: "", trend: "up" },
      { label: "Total Products", value: String(totalProducts), delta: "", trend: "up" },
      { label: "Total Orders", value: String(totalOrders), delta: "", trend: "up" },
      { label: "Revenue", value: String(totalRevenue), delta: "", trend: "up" },
    ],
    subCards: [
      { label: "Deliveries", value: String(totalDeliveries), delta: "", trend: "up" },
      {
        label: "Marketplace Commission",
        value: String(marketplaceCommission),
        delta: "",
        trend: "up",
      },
      { label: "Rider Commission", value: String(riderCommission), delta: "", trend: "up" },
      { label: "Active Statuses", value: String(orderStatus.length), delta: "", trend: "up" },
    ],
    revenueBars: [{ month: "Current", value: totalRevenue }],
    fulfillment: [
      {
        label: "Orders vs Deliveries",
        value: totalOrders > 0 ? Math.min(100, Math.round((totalDeliveries / totalOrders) * 100)) : 0,
        color: "#16a34a",
      },
      {
        label: "Commission Coverage",
        value:
          totalRevenue > 0
            ? Math.min(
                100,
                Math.round(((marketplaceCommission + riderCommission) / totalRevenue) * 100)
              )
            : 0,
        color: "#2563eb",
      },
    ],
    orderStatus,
    topCountries,
    recentOrders: [],
    lowStock: [],
  };
}

export default function AdminDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [dashboardPayload, usersPayload] = await Promise.all([
        adminFetcher<unknown>("/dashboard"),
        adminFetcher<unknown>("/users?limit=1000"),
      ]);
      const usersCount = resolveUsersCount(usersPayload);
      return normalizeDashboardData(dashboardPayload, { totalUsers: usersCount });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load dashboard."}
        onRetry={refetch}
      />
    );
  }

  const viewData = data;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {viewData.statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              {card.value}
            </div>
            {card.delta ? (
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  card.trend === "up"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {card.delta}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {viewData.subCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              {card.value}
            </div>
            {card.delta ? (
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  card.trend === "up"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {card.delta}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-slate-800">
            Revenue Overview
          </div>
          <div className="text-xs text-slate-400">Monthly trend from admin dashboard stats.</div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={viewData.revenueBars}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-slate-800">
            Order Fulfillment Status
          </div>
          <div className="mt-4 space-y-4 text-xs text-slate-500">
            {viewData.fulfillment.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span>{row.value}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${row.value}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-slate-800">Order Status</div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={viewData.orderStatus} dataKey="value" outerRadius={90}>
                    {viewData.orderStatus.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2 text-xs text-slate-500">
              {viewData.orderStatus.map((entry) => (
                <div key={entry.label} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: entry.color }}
                  />
                  <span className="text-slate-700">{entry.label}</span>
                  <span className="text-slate-400">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-slate-800">
            Top Regions By Sales
          </div>
          <div className="text-xs text-slate-400">Location breakdown from dashboard data.</div>
          <div className="mt-4 space-y-4 text-sm">
            {viewData.topCountries.map((row) => (
              <div key={row.country} className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  {row.country}
                </div>
                <div className="flex items-center gap-3">
                  <svg width="40" height="14" viewBox="0 0 40 14">
                    <path
                      d="M1 10L9 6L16 9L24 4L32 6L39 2"
                      stroke={row.trend === "up" ? "#16a34a" : "#f97316"}
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  <div className="text-xs text-slate-500">{row.sales}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-sm font-semibold text-slate-800">Recent Orders</div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3">Order ID</th>
                <th className="pb-3">Customer ID</th>
                <th className="pb-3">Order Date</th>
                <th className="pb-3">Items</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              {viewData.recentOrders.map((row, index) => (
                <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                  <td className="py-3">{row.id}</td>
                  <td className="py-3">{row.customer}</td>
                  <td className="py-3">{row.date}</td>
                  <td className="py-3">{row.items}</td>
                  <td className="py-3">{row.price}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-500">
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-sm font-semibold text-slate-800">Low Stock Products</div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3">Product Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Current Stock</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Vendor</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              {viewData.lowStock.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-3">{row.name}</td>
                  <td className="py-3">{row.category}</td>
                  <td className="py-3">{row.stock}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-500">
                      Low Stock
                    </span>
                  </td>
                  <td className="py-3">{row.vendor}</td>
                  <td className="py-3">
                    <button className="rounded-full bg-brand px-3 py-1 text-[10px] font-semibold text-white">
                      Order Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

