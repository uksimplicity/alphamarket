import type { DeliveryPoint } from "./addresses";
type Location = { lat(): number; lng(): number };
type Listener = { remove(): void };
export type GoogleMapApi = {
  Geocoder?: new () => { geocode(request: { address: string; region: string }, callback: (results: { partial_match?: boolean; types: string[]; geometry: { location: Location; location_type: string } }[] | null, status: string) => void): void };
  Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; streetViewControl: boolean; mapTypeControl: boolean }) => { setCenter(point: { lat: number; lng: number }): void; addListener(event: string, callback: (e: { latLng?: Location }) => void): Listener };
  Marker: new (options: { map: unknown; draggable: boolean; position: { lat: number; lng: number }; visible: boolean }) => { setPosition(point: { lat: number; lng: number }): void; setVisible(value: boolean): void; setMap(map: null): void; addListener(event: string, callback: (e: { latLng?: Location }) => void): Listener };
};
let pending: Promise<GoogleMapApi> | undefined;
export const mapsAuthFailureEvent = "alpha-maps-auth-failure";
let authFailed = false;
let authHookInstalled = false;
export function loadGoogleMaps(key: string): Promise<GoogleMapApi> {
  if (!key.trim()) return Promise.reject(new Error("The map is unavailable. Use your current location or try again."));
  if (authFailed) return Promise.reject(new Error("The map is unavailable. Use your current location or try again."));
  const google = () => (window as unknown as { google?: { maps?: GoogleMapApi } }).google?.maps;
  if (google()?.Map) return Promise.resolve(google()!);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const callbacks = window as unknown as Record<string, unknown>;
    if (!authHookInstalled) {
      const previous = callbacks.gm_authFailure;
      callbacks.gm_authFailure = () => {
        authFailed = true;
        window.dispatchEvent(new Event(mapsAuthFailureEvent));
        if (typeof previous === "function") previous();
      };
      authHookInstalled = true;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__alphaMapsReady`;
    script.async = true;
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener(mapsAuthFailureEvent, fail);
      delete callbacks.__alphaMapsReady;
    };
    const fail = () => {
      cleanup(); script.remove(); pending = undefined;
      reject(new Error("The map could not be loaded. Use your current location or try again."));
    };
    const timeout = setTimeout(fail, 15000);
    window.addEventListener(mapsAuthFailureEvent, fail);
    callbacks.__alphaMapsReady = () => {
      if (!google()?.Map || !google()?.Marker) { fail(); return; }
      cleanup(); resolve(google()!);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
export const mapPoint = (point: DeliveryPoint) => ({ lat: point.latitude, lng: point.longitude });
