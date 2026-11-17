"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import styles from "./productDetail.module.css";

export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const zoom = useRef<HTMLDialogElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const multiple = images.length > 1;
  function move(direction: number) { setActive(previous => (previous + direction + images.length) % images.length); }
  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    swiped.current = false;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function finish(event: PointerEvent<HTMLElement>) {
    const initial = gesture.current;
    gesture.current = null;
    if (!initial || initial.id !== event.pointerId) return;
    const dx = event.clientX - initial.x, dy = event.clientY - initial.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped.current = true;
      if (multiple) move(dx < 0 ? 1 : -1);
    }
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
  }
  const swipe = { onPointerDown: start, onPointerUp: finish, onPointerCancel: () => { gesture.current = null; } };
  const controls = multiple ? <><button type="button" className={`${styles.galleryArrow} ${styles.previousImage}`} aria-label="Previous product image" onClick={() => move(-1)}><ShopperIcon name="arrow" size={20} /></button><button type="button" className={`${styles.galleryArrow} ${styles.nextImage}`} aria-label="Next product image" onClick={() => move(1)}><ShopperIcon name="arrow" size={20} /></button><span className={styles.imageCount} aria-live="polite">{active + 1} / {images.length}</span></> : null;
  return <section className={styles.gallery} aria-label="Product images" aria-roledescription="carousel" onKeyDown={keyboard}>
    <div className={styles.galleryStage}>
      <button type="button" className={styles.mainImage} {...swipe} onClick={() => { if (swiped.current) { swiped.current = false; return; } zoom.current?.showModal(); }} aria-label={`Enlarge image of ${title}`}>
        <span className={styles.imageTrack} style={{ transform: `translateX(-${active * 100}%)` }}>{images.map((image, index) => <img key={image} src={image} alt={index === active ? title : ""} aria-hidden={index !== active} width={850} height={850} draggable={false} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" />)}</span>
        <span><ShopperIcon name="search" size={16} />Take a closer look</span>
      </button>
      {controls}
    </div>
    {multiple ? <><p className={styles.swipeHint}>Swipe or use the arrows to explore photos</p><div className={styles.thumbnails}>{images.map((image, index) => <button type="button" key={image} aria-label={`View product image ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}><img src={image} alt="" width={75} height={75} loading="lazy" /></button>)}</div></> : null}
    <div className={styles.galleryNote}><ShopperIcon name="shield" size={18} /><span>Keep your purchase and payment together on Alpha Marketplace.</span></div>
    <dialog className={`${styles.zoomDialog} ${styles.galleryZoom}`} ref={zoom} aria-label={`Enlarged image of ${title}`} onClick={event => { if (event.currentTarget === event.target) zoom.current?.close(); }}>
      <button type="button" className={styles.closeZoom} aria-label="Close enlarged image" onClick={() => zoom.current?.close()}><ShopperIcon name="close" size={22} /></button>
      <div className={styles.zoomStage}><img src={images[active]} alt={title} draggable={false} {...swipe} />{controls}</div>
    </dialog>
  </section>;
}
