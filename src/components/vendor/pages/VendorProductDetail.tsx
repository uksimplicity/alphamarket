"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import { productImage } from "@/components/products/productMedia";
import "@/components/products/CreateProduct.css";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const display = (...values: unknown[]) => { const value = values.find(value => typeof value === "string" && value.trim() || typeof value === "number" && Number.isFinite(value)); return value === undefined ? "-" : String(value); };

export default function VendorProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPrice = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return `N${numeric.toLocaleString()}`;
    }
    return String(value);
  };

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch(`/api/seller/products/${encodeURIComponent(productId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? data.error
            : `Failed to load product (${response.status}).`;
        throw new Error(String(message));
      }
      const payload =
        data?.data || data?.product || data?.item || data?.product_data || data || null;
      setProduct(record(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const summary = useMemo(() => {
    if (!product) return null;
    return {
      id: display(product.id, product.productId, product.product_id, product._id, product.uuid, product.slug, productId),
      name: display(product.name, product.title, "Product"),
      category: display(record(product.category).name, product.categoryName, product.category, product.category_id, product.categoryId),
      status: display(product.status, product.isPublished === true ? "publish" : product.active === false ? "draft" : "Unknown"),
      vendor: display(record(product.vendor).name, product.vendorName, record(product.seller).name, product.sellerName),
      brand: display(record(product.brand).name, product.brandName, product.brand, product.brandId),
      productType: display(record(product.productType).name, product.productTypeName, product.productTypeId, product.type),
      slug: display(product.slug),
      sellerId: display(product.sellerId, product.seller_id, record(product.seller).id),
      stock: display(product.stock, product.quantity),
      price: product.basePrice ?? product.base_price ?? product.price ?? product.amount ?? product.unitPrice,
      tags: Array.isArray(product.tags) ? product.tags.filter(tag => typeof tag === "string").join(", ") : display(product.tags),
      description: display(product.shortDescription, product.short_description, product.description),
      media: product.media ? record(product.media) : { cover: product.cover ?? product.coverImage, images: product.images },
      variants: product.variants ?? product.attributes ?? product.variantRows,
    };
  }, [product, productId]);

  const variantRows = useMemo(() => {
    if (!summary?.variants || !Array.isArray(summary.variants)) return [];
    return summary.variants.map((input: unknown) => { const row = record(input); return ({
      skuId: display(row.skuId, row.sku_id, row.sku),
      variantId: display(row.variantId, row.variant_id, row.id),
      color: display(row.color, row.colour, row.attribute_value, row.value),
      size: display(row.size, row.size_name),
      visible: display(row.visible, row.quantity, row.stock),
      status: display(row.status, row.active === true ? "Active" : row.active === false ? "Inactive" : "Unknown"),
    }); });
  }, [summary]);

  const mediaUrls = useMemo(() => {
    if (!summary?.media) return [];
    const cover = summary.media?.cover || summary.media?.coverUrl;
    const images = Array.isArray(summary.media?.images) ? summary.media.images : [];
    return [...new Set([cover, ...images].map(image => productImage({ image }, "")).filter(Boolean))];
  }, [summary]);

  const discount = record(Array.isArray(product?.discounts) ? product.discounts[0] : null);

  if (loading) {
    return (
      <div className="create-card">
        <div className="section-title">Loading product...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="create-card">
        <div className="section-title">Unable to load product</div>
        <div className="details-text">{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="create-card">
        <div className="section-title">Product not found</div>
      </div>
    );
  }

  const coverStyle =
    mediaUrls.length > 0
      ? {
          backgroundImage: `url(${mediaUrls[0]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="create-header">
          <div className="create-title">
            <button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
              <span aria-hidden="true">{"\u2190"}</span>
            </button>
            <h1>Product Details</h1>
          </div>
          <button type="button" className="status-btn" onClick={() => navigate(`/vendor/products/${summary.id}/edit`)}>
            Edit
          </button>
        </div>

        <section className="form-section">
          <div className="section-title">Basic Information</div>
          <div className="details-header">
            <div className="details-image" style={coverStyle} />
            <div className="details-info">
              <div className="details-name">{summary.name}</div>
              <div className="details-meta">
                <span>Category</span>
                <span>{summary.category}</span>
              </div>
            </div>
            <span className="badge-blue">{summary.status}</span>
          </div>
          <div className="details-section">
            <div className="details-label">Short Description</div>
            <div className="details-text">{summary.description}</div>
          </div>
          <div className="details-grid">
            <div className="details-card"><div className="details-icon">BR</div><div><div className="details-title">Brand</div><div className="details-value">{summary.brand}</div></div></div>
            <div className="details-card"><div className="details-icon">PR</div><div><div className="details-title">Price</div><div className="details-value">{formatPrice(summary.price)}</div></div></div>
            <div className="details-card"><div className="details-icon">ST</div><div><div className="details-title">Stock</div><div className="details-value">{summary.stock}</div></div></div>
            <div className="details-card"><div className="details-icon">TY</div><div><div className="details-title">Product Type</div><div className="details-value">{summary.productType}</div></div></div>
            <div className="details-card"><div className="details-icon">SL</div><div><div className="details-title">Slug</div><div className="details-value">{summary.slug}</div></div></div>
            <div className="details-card"><div className="details-icon">VN</div><div><div className="details-title">Vendor</div><div className="details-value">{summary.vendor}</div></div></div>
            <div className="details-card"><div className="details-icon">ID</div><div><div className="details-title">Seller ID</div><div className="details-value">{summary.sellerId}</div></div></div>
            <div className="details-card"><div className="details-icon">TG</div><div><div className="details-title">Tags</div><div className="details-value">{summary.tags}</div></div></div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Media</div>
          <div className="media-thumbs">
            {mediaUrls.length > 0
              ? mediaUrls.map((url, index) => (
                  <div
                    className="media-thumb"
                    key={`media-${index}`}
                    style={{
                      backgroundImage: `url(${url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ))
              : new Array(4).fill(null).map((_, index) => <div className="media-thumb" key={`media-${index}`} />)}
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Variant</div>
          <div className="variant-table-wrap">
            <table className="variant-table">
              <thead>
                <tr>
                  <th>SKU ID</th>
                  <th>Variant ID</th>
                  <th>Image</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Visible</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {variantRows.length > 0 ? (
                  variantRows.map((row, index) => (
                    <tr key={`variant-${index}`}>
                      <td>{row.skuId}</td>
                      <td>{row.variantId}</td>
                      <td><span className="thumb-sm" /></td>
                      <td>{row.color}</td>
                      <td>{row.size}</td>
                      <td>{row.visible}</td>
                      <td><span className="badge-blue">{row.status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>No variants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Discount</div>
          <div className="details-grid">
            <div className="details-card"><div className="details-icon">DT</div><div><div className="details-title">Discount Title</div><div className="details-value">{display(discount.title)}</div></div></div>
            <div className="details-card"><div className="details-icon">DP</div><div><div className="details-title">Discount Price</div><div className="details-value">{formatPrice(discount.price)}</div></div></div>
            <div className="details-card"><div className="details-icon">DD</div><div><div className="details-title">Discount Duration</div><div className="details-value">{display(discount.startDate)}</div></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}
