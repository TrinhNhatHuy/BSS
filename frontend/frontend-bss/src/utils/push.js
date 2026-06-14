/**
 * Web Push helpers — service-worker registration, permission, and subscription.
 *
 * Flow: registerServiceWorker() once at startup → when the user opts in,
 * ensurePushSubscription(vapidKey) requests permission, subscribes via the Push
 * API, and returns a plain { endpoint, p256dh, auth } object for the backend.
 */

export function isPushSupported() {
    return (
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/** Register the service worker (idempotent). Safe to call when unsupported. */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        return await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
        console.warn('Service worker registration failed:', err);
        return null;
    }
}

export function notificationPermission() {
    return isPushSupported() ? Notification.permission : 'denied';
}

/** Request notification permission; resolves true if granted. */
export async function requestNotificationPermission() {
    if (!isPushSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

/** VAPID public key (base64url) → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
}

/**
 * Ensure the current device has a push subscription, requesting permission and
 * subscribing if needed. Returns { endpoint, p256dh, auth } or null if the user
 * declined / push is unsupported.
 */
export async function ensurePushSubscription(vapidPublicKey) {
    if (!isPushSupported() || !vapidPublicKey) return null;

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
        sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return null;
    return { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** This device's current push subscription endpoint, or null if not subscribed. */
export async function getCurrentPushEndpoint() {
    if (!isPushSupported()) return null;
    try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        return sub ? sub.endpoint : null;
    } catch {
        return null;
    }
}

/**
 * Unsubscribe this device from Web Push locally (browser-side). Returns the
 * endpoint that was removed (so the caller can also drop it server-side via
 * unsubscribePush), or null if there was nothing to remove.
 */
export async function unsubscribeCurrentDevice() {
    if (!isPushSupported()) return null;
    try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (!sub) return null;
        const { endpoint } = sub;
        await sub.unsubscribe();
        return endpoint;
    } catch {
        return null;
    }
}
