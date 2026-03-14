"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import "@/components/products/CreateProduct.css";

export default function VendorProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any | null>(null);
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

  const loadProduct = async () => {
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
      setProduct(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const summary = useMemo(() => {
    if (!product) return null;
    return {
      id:
        product?.id ||
        product?.productId ||
        product?.product_id ||
        product?._id ||
        product?.uuid ||
        product?.slug ||
        productId ||
        "",
      name: product?.name || product?.title || "Product",
      category:
        product?.category?.name ||
        product?.categoryName ||
        product?.category ||
        product?.category_id ||
        product?.categoryId ||
        "Category",
      status:
        product?.status ||
        (product?.isPublished ? "publish" : product?.active === false ? "draft" : "publish"),
      vendor:
        product?.vendor?.name ||
        product?.vendorName ||
        product?.seller?.name ||
        product?.sellerName ||
        "Vendor",
      brand:
        product?.brand?.name || product?.brandName || product?.brand || product?.brandId || "-",
      productType:
        product?.productType?.name ||
        product?.productTypeName ||
        product?.productTypeId ||
        product?.type ||
        "-",
      slug: product?.slug || "-",
      sellerId: product?.sellerId || product?.seller_id || product?.seller?.id || "-",
      stock: product?.stock ?? product?.quantity ?? "-",
      price:
        product?.basePrice ??
        product?.base_price ??
        product?.price ??
        product?.amount ??
        product?.unitPrice ??
        "-",
      tags: Array.isArray(product?.tags)
        ? product.tags.filter(Boolean).join(", ")
        : product?.tags || "-",
      description:
        product?.shortDescription ||
        product?.short_description ||
        product?.description ||
        "-",
      media: product?.media || {
        cover: product?.cover || product?.coverImage || "",
        images: product?.images || [],
      },
      variants: product?.variants || product?.attributes || product?.variantRows || [],
    };
  }, [product, productId]);

  const variantRows = useMemo(() => {
    if (!summary?.variants || !Array.isArray(summary.variants)) return [];
    return summary.variants.map((row: any, index: number) => ({
      skuId: row?.skuId || row?.sku_id || row?.sku || `SKU-${index + 1}`,
      variantId: row?.variantId || row?.variant_id || row?.id || `VAR-${index + 1}`,
      color: row?.color || row?.colour || row?.attribute_value || row?.value || "-",
      size: row?.size || row?.size_name || "-",
      visible: row?.visible || row?.quantity || row?.stock || "-",
      status: row?.status || (row?.active ? "Active" : "Inactive"),
    }));
  }, [summary]);

  const mediaUrls = useMemo(() => {
    if (!summary?.media) return [];
    const cover = summary.media?.cover || summary.media?.coverUrl;
    const images = Array.isArray(summary.media?.images) ? summary.media.images : [];
    return [cover, ...images].filter(Boolean);
  }, [summary]);

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
            <div className="details-card"><div className="details-icon">DT</div><div><div className="details-title">Discount Title</div><div className="details-value">{product?.discounts?.[0]?.title || "-"}</div></div></div>
            <div className="details-card"><div className="details-icon">DP</div><div><div className="details-title">Discount Price</div><div className="details-value">{formatPrice(product?.discounts?.[0]?.price ?? "-")}</div></div></div>
            <div className="details-card"><div className="details-icon">DD</div><div><div className="details-title">Discount Duration</div><div className="details-value">{product?.discounts?.[0]?.startDate || "-"}</div></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}
