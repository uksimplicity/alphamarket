"use client";

import { useState, type ReactNode } from "react";
import { addToCart, formatCurrency, parsePrice, useCartCount } from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";
import { extendedCatalog, type Product } from "@/components/products/catalog";
import styles from "@/app/page.module.css";
import CartAddedModal from "@/components/commerce/CartAddedModal";

export default function ProductDetail({
  product,
  backLink,
}: {
  product: Product;
  backLink?: ReactNode;
}) {
  const [showPhone, setShowPhone] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalName, setCartModalName] = useState("");
  const cartCount = useCartCount();
  const relatedProducts = extendedCatalog
    .filter((entry) => entry.id !== product.id)
    .slice(0, 12);

  const handleAddToCart = () => {
    setCartModalName(product.title);
    setCartModalOpen(true);
  };

  return (
    <div className={`space-y-10 ${styles.detailPage}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 ${styles.detailMeta}`}
      >
        <div className="flex items-center gap-3">
          <span className={styles.detailChip}>Images</span>
          <span className={styles.detailChip}>View on map</span>
        </div>
        <div className="flex items-center gap-3">
          <span>30 views</span>
          <span>Share on</span>
          <span className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-[10px] font-semibold text-slate-500 ${styles.detailShareIcon}`}
              aria-label="Share on Facebook"
            >
              fb
            </span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-[10px] font-semibold text-slate-500 ${styles.detailShareIcon}`}
              aria-label="Share on X"
            >
              x
            </span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-[10px] font-semibold text-slate-500 ${styles.detailShareIcon}`}
              aria-label="Share on WhatsApp"
            >
              wa
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr_0.55fr]">
        <div className={styles.detailCard}>
          <Card>
            <div className={`grid gap-4 lg:grid-cols-[100px_1fr] ${styles.detailGallery}`}>
              <div className="flex gap-3 lg:flex-col">
                {[product.image, product.image, product.image].map((image, index) => (
                  <button
                    key={`${product.id}-thumb-${index}`}
                    className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${styles.detailThumb}`}
                    type="button"
                  >
                    <img src={image} alt={product.title} className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-2xl bg-slate-50">
                <img
                  src={product.image}
                  alt={product.title}
                  className={`h-full w-full object-cover ${styles.detailHeroImage}`}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className={styles.detailCard}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className={styles.detailTitle}>{product.title}</h1>
                  <div className="mt-2 text-sm text-slate-500">
                    Rated {product.rating} - {product.reviews} reviews
                  </div>
                </div>
                {backLink ? <div className="text-sm">{backLink}</div> : null}
              </div>
              <div className={`mt-4 font-semibold ${styles.detailPrice}`}>
                {formatCurrency(parsePrice(product.price))}
              </div>
              <div className="text-sm text-emerald-600">Negotiable</div>
              {product.oldPrice ? (
                <div className="text-sm text-slate-400 line-through">{formatCurrency(parsePrice(product.oldPrice))}</div>
              ) : null}
              <div className={`mt-5 sm:grid-cols-2 ${styles.detailCta}`}>
                <Button variant="ghost" onClick={() => setOfferOpen(true)}>Make offer</Button>
                <Button
                  onClick={() => {
                    addToCart({
                      id: product.id,
                      name: product.title,
                      price: parsePrice(product.price),
                      image: product.image,
                    });
                    handleAddToCart();
                  }}
                >
                  Add to cart
                </Button>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                For safe and secure transaction, transact with Alpha Marketplace escrow.
                <span className="ml-1 text-brand">Learn more</span>
              </div>
            </Card>
          </div>

          <div className={styles.detailCard}>
            <Card>
              <SectionTitle title="About the product" />
              <p className="mt-3 text-sm text-slate-600">{product.description}</p>
              <div className="mt-4 text-sm text-slate-600">
                Industrial touch panel, advanced network structure, and high reliability.
                USB and SD card plug-and-play music support included.
              </div>
            </Card>
          </div>

          <div className={styles.detailCard}>
            <Card>
              <SectionTitle title="Specifications" />
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span>Condition</span>
                  <span className="font-semibold text-slate-800">New</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span>Type</span>
                  <span className="font-semibold text-slate-800">Audio Encoder & Decoder</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <div className={styles.detailCard}>
            <Card>
              <div className="text-xs font-semibold uppercase text-slate-400">Seller</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-200" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{product.seller.name}</div>
                  <div className="text-xs text-slate-400">*****</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Button variant="ghost" onClick={() => setIsFollowing((value) => !value)}>
                  {isFollowing ? "Following" : "Follow me"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = `/store/${product.seller.slug}`;
                    }
                  }}
                >
                  Visit store
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span>{showPhone ? "08071234567" : "0807XXXXXXX"}</span>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand"
                  onClick={() => setShowPhone((value) => !value)}
                >
                  {showPhone ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-3 text-center text-xs text-slate-400">OR SEND THE SELLER A MESSAGE</div>
              <Button
                variant="primary"
                className="mt-3 w-full"
                onClick={() => setChatOpen(true)}
              >
                Send message
              </Button>
            </Card>
          </div>

          <div className={styles.detailCard}>
            <Card>
              <div className="text-sm font-semibold text-slate-900">
                Boost your Product's Reach!
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Get your product in front of more buyers and maximize sales with
                Alpha Marketplace Boost.
              </p>
              <Button variant="ghost" className="mt-4 w-full">
                Learn More
              </Button>
            </Card>
          </div>

          <div className={styles.detailCard}>
            <Card>
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
                Safety tips: Meet face to face, never send payment for items you haven't
                seen.
              </div>
            </Card>
          </div>
        </div>
      </div>


      {offerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Make an Offer</div>
                <div className="text-xs text-slate-500">Offer for {product.title}</div>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500"
                onClick={() => setOfferOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="text-xs font-semibold text-slate-500">Your offer (?)</label>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Enter your offer"
                value={offerAmount}
                onChange={(event) => setOfferAmount(event.target.value)}
              />
              <Button
                onClick={() => {
                  setOfferAmount("");
                  setOfferOpen(false);
                }}
              >
                Submit offer
              </Button>
            </div>
          </div>
        </div>
      ) : null}




      {chatOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Chat with seller</div>
                <div className="text-xs text-slate-500">{product.seller.name}</div>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500"
                onClick={() => setChatOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="h-60 space-y-3 overflow-y-auto px-4 py-3 text-sm text-slate-500">
              <div className="rounded-xl bg-slate-100 px-3 py-2">
                Hi! Is this item still available?
              </div>
              <div className="ml-auto max-w-[80%] rounded-xl bg-blue-600 px-3 py-2 text-white">
                Yes, it is available. How can I help?
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
              <input
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Write a message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <Button
                onClick={() => {
                  setMessage("");
                  setChatOpen(false);
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <CartAddedModal
        open={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        productName={cartModalName}
        cartCount={cartCount}
      />

      <div className="space-y-4">
        <SectionTitle title="You may also like..." />
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${styles.detailRelatedGrid}`}>
          {relatedProducts.map((item) => (
            <a key={item.id} href={`/products/${item.id}`} className={styles.detailCard}>
              <Card>
                <div className="overflow-hidden rounded-xl bg-slate-50">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-32 w-full object-cover"
                  />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  {item.title}
                </div>
                <div className="text-sm text-slate-500">
                  {formatCurrency(parsePrice(item.price))}
                </div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
