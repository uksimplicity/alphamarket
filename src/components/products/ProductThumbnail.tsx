"use client";

import { useState } from "react";
import { marketplaceImage } from "./productMedia";

export default function ProductThumbnail({ image }: { image: string }) {
  const src = marketplaceImage(image);
  const [failedImage, setFailedImage] = useState("");
  return <span className="product-thumb" aria-hidden="true">{src && failedImage !== src ? <img key={src} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedImage(src)} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : null}</span>;
}