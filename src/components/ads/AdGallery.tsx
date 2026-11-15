"use client";
import { useRef, useState } from "react";
import { productImage } from "@/components/products/productMedia";
import { record, text, type AdRecord } from "./data";
import styles from "./ads.module.css";

export default function AdGallery({ item }: { item: AdRecord }) {
  const media = record(item.media);
  const gallery = Array.isArray(media.images) ? media.images : Array.isArray(item.images) ? item.images : [];
  const images = [...new Set([productImage(item, ""), ...gallery.map(image => productImage({ image }, ""))].filter(Boolean))];
  const [selected, setSelected] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const zoom = useRef<HTMLDialogElement>(null);
  const current = images.includes(selected) ? selected : images[0];
  const available = current && !failed.includes(current);
  const title = text(item.name, "Ad");
  return <figure className={styles.adGallery}>
    <button type="button" className={styles.galleryMain} disabled={!available} aria-label={`Enlarge photo of ${title}`} onClick={() => zoom.current?.showModal()}>
      {available ? <img src={current} alt={title} onError={() => setFailed(previous => [...previous, current])} /> : <span>{current ? "Photo unavailable" : "No photos provided"}</span>}
    </button>
    {images.length ? <figcaption className={styles.galleryCaption}>Photo {images.indexOf(current) + 1} of {images.length}{available ? " · Click to enlarge" : ""}</figcaption> : null}
    {images.length > 1 ? <div className={styles.galleryThumbnails} aria-label="Ad photos">{images.map((image, index) => <button type="button" key={image} aria-label={`View photo ${index + 1}`} aria-pressed={image === current} onClick={() => setSelected(image)}>{failed.includes(image) ? <span>Photo {index + 1}</span> : <img src={image} alt="" loading="lazy" onError={() => setFailed(previous => [...previous, image])} />}</button>)}</div> : null}
    <dialog ref={zoom} className={styles.imageDialog} aria-label={`Photo of ${title}`} onClick={event => { if (event.target === event.currentTarget) zoom.current?.close(); }}>
      <button type="button" className={styles.closeImage} onClick={() => zoom.current?.close()}>Close photo</button>
      {available ? <img src={current} alt={title} /> : null}
    </dialog>
  </figure>;
}
