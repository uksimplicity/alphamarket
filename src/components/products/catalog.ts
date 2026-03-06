export type Product = {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  badge?: string;
  image: string;
  rating: string;
  reviews: string;
  description: string;
  seller: { name: string; slug: string };
};

const baseProducts: Record<string, Product> = {
  "wireless-noise-cancelling-headphones": {
    id: "wireless-noise-cancelling-headphones",
    title: "Wireless Noise Cancelling Headphones",
    price: "â‚¦299.00",
    oldPrice: "â‚¦349.00",
    badge: "-15%",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    rating: "4.9",
    reviews: "120",
    description:
      "Premium wireless headphones with active noise cancellation, soft ear cushions, and up to 30 hours of playback.",
    seller: { name: "Tony Okechukwu", slug: "tony-okechukwu" },
  },
  "smart-fitness-watch-series-7": {
    id: "smart-fitness-watch-series-7",
    title: "Smart Fitness Watch Series 7",
    price: "â‚¦399.00",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    rating: "4.8",
    reviews: "85",
    description:
      "Track workouts, sleep, heart rate, and notifications with a vibrant always-on display.",
    seller: { name: "Amaka Nwosu", slug: "amaka-nwosu" },
  },
  "urban-runner-sneakers": {
    id: "urban-runner-sneakers",
    title: "Urban Runner Sneakers",
    price: "â‚¦129.50",
    oldPrice: "â‚¦150",
    badge: "Sale",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    rating: "4.7",
    reviews: "210",
    description:
      "Lightweight everyday sneakers built with breathable mesh and responsive cushioning.",
    seller: { name: "Kelechi Okoro", slug: "kelechi-okoro" },
  },
  "advanced-hydrating-serum": {
    id: "advanced-hydrating-serum",
    title: "Advanced Hydrating Serum",
    price: "â‚¦45.00",
    image:
      "https://images.unsplash.com/photo-1585238342028-4bbc7c0f0cb5?auto=format&fit=crop&w=900&q=80",
    rating: "4.9",
    reviews: "58",
    description:
      "Deep hydration with a lightweight feel. Brightens and smooths for a healthy glow.",
    seller: { name: "Ify Eze", slug: "ify-eze" },
  },
  "everyday-tech-backpack": {
    id: "everyday-tech-backpack",
    title: "Everyday Tech Backpack",
    price: "â‚¦89.99",
    oldPrice: "â‚¦110",
    badge: "-20%",
    image:
      "https://images.unsplash.com/photo-1509769375558-7c1fefe0f0de?auto=format&fit=crop&w=900&q=80",
    rating: "4.6",
    reviews: "90",
    description:
      "Organized compartments for laptops and accessories with durable water-resistant fabric.",
    seller: { name: "Samuel Ade", slug: "samuel-ade" },
  },
};

export const popularProducts: Product[] = [
  baseProducts["wireless-noise-cancelling-headphones"],
  baseProducts["smart-fitness-watch-series-7"],
  baseProducts["urban-runner-sneakers"],
  baseProducts["advanced-hydrating-serum"],
  baseProducts["everyday-tech-backpack"],
];

export const newArrivalProducts: Product[] = [
  baseProducts["everyday-tech-backpack"],
  baseProducts["advanced-hydrating-serum"],
  baseProducts["urban-runner-sneakers"],
  baseProducts["smart-fitness-watch-series-7"],
];

export const catalogProducts: Product[] = Array.from(
  new Map(
    [...popularProducts, ...newArrivalProducts].map((product) => [
      product.id,
      product,
    ])
  ).values()
);

const fillerProducts: Product[] = [
  {
    id: "portable-audio-mixer",
    title: "Portable Audio Mixer",
    price: "₦75,000.00",
    image:
      "https://images.unsplash.com/photo-1512446733611-9099a758e5f2?auto=format&fit=crop&w=900&q=80",
    rating: "4.5",
    reviews: "61",
    description:
      "Compact mixer with balanced inputs, EQ controls, and clean headphone monitoring.",
    seller: { name: "Nneka Chukwu", slug: "nneka-chukwu" },
  },
  {
    id: "studio-monitor-speakers",
    title: "Studio Monitor Speakers",
    price: "₦215,000.00",
    image:
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=80",
    rating: "4.7",
    reviews: "84",
    description:
      "Accurate reference speakers with balanced mids and crisp high frequencies.",
    seller: { name: "Emeka Obi", slug: "emeka-obi" },
  },
  {
    id: "digital-audio-recorder",
    title: "Digital Audio Recorder",
    price: "₦98,500.00",
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    rating: "4.6",
    reviews: "42",
    description:
      "Handheld recorder with stereo microphones and long battery life.",
    seller: { name: "Halima Yusuf", slug: "halima-yusuf" },
  },
  {
    id: "wireless-lapel-microphone",
    title: "Wireless Lapel Microphone",
    price: "₦32,000.00",
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
    rating: "4.4",
    reviews: "128",
    description:
      "Clear voice pickup with stable wireless transmission for interviews.",
    seller: { name: "Ibrahim Musa", slug: "ibrahim-musa" },
  },
  {
    id: "usb-audio-interface",
    title: "USB Audio Interface",
    price: "₦120,000.00",
    image:
      "https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=900&q=80",
    rating: "4.8",
    reviews: "93",
    description:
      "Low-latency recording with high-quality preamps and phantom power.",
    seller: { name: "Grace Adebayo", slug: "grace-adebayo" },
  },
  {
    id: "noise-isolation-headset",
    title: "Noise Isolation Headset",
    price: "₦54,000.00",
    image:
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=80",
    rating: "4.3",
    reviews: "57",
    description:
      "Comfortable headset with passive isolation and rich sound profile.",
    seller: { name: "Tunde Balogun", slug: "tunde-balogun" },
  },
  {
    id: "network-audio-controller",
    title: "Network Audio Controller",
    price: "₦410,000.00",
    image:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80",
    rating: "4.6",
    reviews: "33",
    description:
      "Multi-zone controller with web management and scheduled playback.",
    seller: { name: "Zainab Sule", slug: "zainab-sule" },
  },
  {
    id: "compact-pa-system",
    title: "Compact PA System",
    price: "₦285,000.00",
    image:
      "https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=900&q=80",
    rating: "4.5",
    reviews: "41",
    description:
      "Portable PA with powerful amplification and Bluetooth streaming.",
    seller: { name: "Chinedu Ibe", slug: "chinedu-ibe" },
  },
];

export const extendedCatalog: Product[] = Array.from(
  new Map(
    [...catalogProducts, ...fillerProducts].map((product) => [
      product.id,
      product,
    ])
  ).values()
);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const productMap = new Map<string, Product>();
for (const product of extendedCatalog) {
  productMap.set(product.id.toLowerCase(), product);
  productMap.set(slugify(product.title), product);
}

export function getProductById(id: string) {
  const normalized = decodeURIComponent(id)
    .toLowerCase()
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const cleaned = normalized.replace(/[^a-z0-9-]/g, "");
  return (
    productMap.get(normalized) ||
    productMap.get(cleaned) ||
    extendedCatalog.find(
      (product) =>
        normalized.includes(product.id.toLowerCase()) ||
        normalized.includes(slugify(product.title))
    )
  );
}
