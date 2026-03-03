import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "All Products", href: "/dashboard/products" },
  { label: "Draft Products", href: "/dashboard/products/draft" },
  { label: "Stock Products", href: "/dashboard/products/stock" },
  { label: "Product Review", href: "/dashboard/products/review" },
];

type ManageProductMenuProps = {
  label?: string;
  defaultOpen?: boolean;
  className?: string;
};

export default function ManageProductMenu({
  label = "Manage Product",
  defaultOpen = false,
  className = "",
}: ManageProductMenuProps) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(defaultOpen);

  const isActive = useMemo(
    () => items.some((item) => pathname === item.href),
    [pathname]
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
          (isActive
            ? "bg-slate-100 text-slate-900"
            : "text-slate-700 hover:bg-slate-100")
        }
        aria-expanded={open}
      >
        <span>{label}</span>
        <span
          className={
            "ml-2 inline-flex h-5 w-5 items-center justify-center transition-transform duration-200 " +
            (open ? "rotate-180" : "rotate-0")
          }
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
          </svg>
        </span>
      </button>

      <div
        className={
          "grid overflow-hidden pl-4 text-sm transition-[grid-template-rows,opacity] duration-200 " +
          (open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
        }
      >
        <div className="min-h-0">
          {items.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "mt-1 flex items-center rounded-md border-l-2 px-3 py-2 text-xs font-medium transition-colors " +
                  (active
                    ? "border-emerald-500 bg-slate-200 text-slate-900"
                    : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
