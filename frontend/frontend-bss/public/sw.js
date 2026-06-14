/*
 * BSS service worker — Web Push for program reminders.
 *
 * Receives push messages from the backend (signed with our VAPID key) and shows
 * a notification even when the app/tab is closed. Clicking it focuses an open
 * BSS tab or opens the program's page.
 */

self.addEventListener('install', () => {
    // Activate this worker immediately rather than waiting for old tabs to close.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'BSS Reminder', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'BSS Reminder';
    const options = {
        body: data.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data.tag || 'bss-reminder',
        renotify: true,
        data: { url: data.url || '/user/home' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/user/home';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(target).catch(() => {});
                    return client.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(target);
            return undefined;
        })
    );
});