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
import { fetcher } from "@/components/dashboard/api";

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

export default function AdminDashboardPage() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetcher<AdminDashboardData>("/admin/dashboard"),
  });

  const mockData: AdminDashboardData = {
    statCards: [
      { label: "Total Sales", value: "N4,765,876", delta: "+0.1%", trend: "up" },
      { label: "Total Orders", value: "1M", delta: "-0.1%", trend: "down" },
      { label: "Total Customers", value: "50,000", delta: "+0.1%", trend: "up" },
      { label: "Shipping Delays", value: "500", delta: "-0.1%", trend: "down" },
    ],
    subCards: [
      { label: "Refund Requests", value: "4,876", delta: "+0.1%", trend: "up" },
      { label: "Stock Products", value: "4,876", delta: "-0.1%", trend: "down" },
      { label: "Abandoned Carts", value: "4,876", delta: "+0.1%", trend: "up" },
      { label: "Payment Failures", value: "4,876", delta: "-0.1%", trend: "down" },
    ],
    revenueBars: [
      { month: "Jan", value: 60 },
      { month: "Feb", value: 78 },
      { month: "Mar", value: 52 },
      { month: "Apr", value: 74 },
      { month: "May", value: 50 },
      { month: "Jun", value: 80 },
      { month: "Jul", value: 90 },
      { month: "Aug", value: 66 },
      { month: "Sep", value: 54 },
      { month: "Oct", value: 62 },
      { month: "Nov", value: 49 },
      { month: "Dec", value: 55 },
    ],
    fulfillment: [
      { label: "Shipped orders", value: 30, color: "#2563eb" },
      { label: "Delivered", value: 56, color: "#22c55e" },
      { label: "Pending shipments", value: 20, color: "#f59e0b" },
      { label: "Stuck orders", value: 10, color: "#111827" },
      { label: "Back Product", value: 2, color: "#ef4444" },
    ],
    orderStatus: [
      { label: "New Shipment", value: 9548, color: "#22c55e" },
      { label: "Processing", value: 9423, color: "#3b82f6" },
      { label: "Delivered", value: 24592, color: "#10b981" },
      { label: "Cancelled", value: 300, color: "#ef4444" },
      { label: "Failed Delivery", value: 232, color: "#f97316" },
      { label: "Pending shipments", value: 403, color: "#f59e0b" },
      { label: "Returned", value: 594, color: "#a855f7" },
      { label: "Refunded", value: 3934, color: "#e879f9" },
      { label: "Stuck orders", value: 400, color: "#0ea5e9" },
    ],
    topCountries: [
      { country: "Canada", sales: "2400k", trend: "up" },
      { country: "Korean", sales: "200k", trend: "down" },
      { country: "France", sales: "300k", trend: "down" },
      { country: "German", sales: "48000k", trend: "up" },
    ],
    recentOrders: [
      {
        id: "#254834",
        customer: "#57392",
        date: "01 Jul, 2026",
        items: "2",
        price: "N4,000",
        status: "Processing",
      },
      {
        id: "#254834",
        customer: "#57392",
        date: "01 Jul, 2026",
        items: "2",
        price: "N76,000",
        status: "Processing",
      },
      {
        id: "#254834",
        customer: "#57392",
        date: "01 Jul, 2026",
        items: "2",
        price: "N12,670",
        status: "Processing",
      },
      {
        id: "#254834",
        customer: "#57392",
        date: "01 Jul, 2026",
        items: "2",
        price: "N512,000",
        status: "Processing",
      },
      {
        id: "#254834",
        customer: "#57392",
        date: "01 Jul, 2026",
        items: "2",
        price: "N2,000",
        status: "Processing",
      },
    ],
    lowStock: [
      { id: "1", name: "Product Name", category: "Cloth", stock: "10", vendor: "G-Shop" },
      { id: "2", name: "Product Name", category: "Cloth", stock: "10", vendor: "G-Shop" },
      { id: "3", name: "Product Name", category: "Cloth", stock: "10", vendor: "G-Shop" },
      { id: "4", name: "Product Name", category: "Cloth", stock: "10", vendor: "G-Shop" },
    ],
  };

  const viewData = data ?? mockData;

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
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                card.trend === "up"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-600"
              }`}
            >
              {card.delta}
            </span>
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
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                card.trend === "up"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-600"
              }`}
            >
              {card.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-slate-800">
            Accommodation Revenue
          </div>
          <div className="text-xs text-slate-400">(+43%) than last year</div>
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
            Top Countries By sales
          </div>
          <div className="text-xs text-slate-400">Total Sale 300M</div>
          <div className="mt-4 space-y-4 text-sm">
            {viewData.topCountries.map((row) => (
              <div key={row.country} className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <span className="text-base">🏳️</span>
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
        <div className="text-sm font-semibold text-slate-800">Order Status</div>
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
