import type { CSSProperties } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  catalog: "M12 3 3 7.5 12 12l9-4.5L12 3ZM3 7.5v9L12 21l9-4.5v-9M12 12v9",
  accounts: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  orders: "M8 4H5v17h14V4h-3M9 3h6v4H9zM8 12h8M8 16h5",
  chart: "M3 3v18h18M8 16v-5M13 16V7M18 16v-9",
  wallet: "M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6M20 12h-5v5h5M16 14.5h.01",
  delivery: "M3 5h11v12H3zM14 9h4l3 4v4h-7M7 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM21 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m9 5 7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  panel: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM9 3v18",
  close: "m6 6 12 12M6 18 18 6",
  external: "M15 3h6v6M10 14 21 3M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  plus: "M12 5v14M5 12h14",
  alert: "M12 8v5M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
} satisfies Record<string, string>;

export type AdminIconName = keyof typeof paths;

export default function AdminIcon({ name, size = 20, className, style }: {
  name: AdminIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      <path d={paths[name]} />
    </svg>
  );
}

