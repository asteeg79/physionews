'use client';

/**
 * PWA-Status — Browser/Plattform-Feature-Detection für die Push- und
 * Install-Flows. Alle Funktionen laufen client-seitig (window, navigator)
 * und sind SSR-safe (Frühe Rückgabe bei window===undefined).
 *
 * Genutzt von:
 *  - PushPermissionBanner (Banner-Sichtbarkeit)
 *  - InstallPrompt (iOS-Sonderbehandlung)
 *  - InstallStatus (Status-Anzeige in Settings)
 *  - PushSettings (Mehrstufige State-Detection)
 *  - ServiceWorkerRegistrar (SW-Registration nur wenn supported)
 */

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari: navigator.standalone, andere Browser: matchMedia
  type IOSNavigator = Navigator & { standalone?: boolean };
  const nav = window.navigator as IOSNavigator;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  // iPad ab iPadOS 13: meldet sich als macOS, hat aber TouchEvents
  const isMac = /macintosh/.test(ua);
  const hasTouch = navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(ua) || (isMac && hasTouch);
}

export function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
}

/**
 * Push wird auf iOS erst ab 16.4 für installierte PWAs unterstützt.
 * Vorher: Berechtigungsdialog erscheint gar nicht.
 */
export function supportsPush(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
