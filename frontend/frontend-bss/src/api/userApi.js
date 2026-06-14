import axiosClient from './axiosClient';

/**
 * Self-service account APIs (the logged-in user's own account).
 * All operate on the caller's row — the backend reads the id from the JWT.
 */

/** GET /api/user/profile → { id, username, email, displayName, role, status, createTime, updateTime } */
export const getProfile = () =>
    axiosClient.get('/api/user/profile').then((res) => res.data);

/** PUT /api/user/profile — data = { displayName, email } */
export const updateProfile = (data) =>
    axiosClient.put('/api/user/profile', data).then((res) => res.data);

/** PUT /api/user/profile/password — data = { currentPassword, newPassword } */
export const changePassword = (data) =>
    axiosClient.put('/api/user/profile/password', data).then((res) => res.data);


// ─── Home / recommendations (USER home page) ────────────────────────────────

/** Current favourite categories → { categories: [...] } (empty = new user). */
export const getPreferences = () =>
    axiosClient.get('/api/user/preferences').then((res) => res.data);

/** Replace favourites with 1–2 categories. */
export const setPreferences = (categories) =>
    axiosClient.put('/api/user/preferences', { categories }).then((res) => res.data);

/** The 7 category enum values. */
export const getCategories = () =>
    axiosClient.get('/api/user/categories').then((res) => res.data);

/**
 * A day's personalized home: { date, preferences, personalized, rails, upNext }.
 * `rails` is an ordered list of shelves ({ key, title, reason, personalized,
 * programs }); `upNext` is the soonest upcoming programs.
 */
export const getHome = (date) =>
    axiosClient
        .get('/api/user/home', { params: date ? { date } : {} })
        .then((res) => res.data);

/**
 * Recommendation-ranked program list for the home filter bar. `filter` may carry
 * { date, q, category, channelId, bookmarked, reminded, timeStart, timeEnd };
 * empty/blank values are dropped. Returns a list of HomeProgramResponse.
 */
export const getFilteredHome = (filter = {}) => {
    const params = {};
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/user/home/filter', { params }).then((res) => res.data);
};


// ─── Behavior tracking (feeds the recommender) ──────────────────────────────

/**
 * Record an implicit interaction. type = VIEW | CLICK | WATCH | SEARCH.
 * Fire-and-forget: failures are swallowed so tracking never disrupts the UI.
 */
export const logEvent = (type, programId) =>
    axiosClient.post('/api/user/events', { type, programId }).catch(() => {});

/** Record a search keyword (debounced by the caller). */
export const logSearch = (keyword) => {
    const k = (keyword || '').trim();
    if (!k) return Promise.resolve();
    return axiosClient.post('/api/user/events', { type: 'SEARCH', keyword: k }).catch(() => {});
};

/** Bookmarked programs, newest first. */
export const getBookmarks = () =>
    axiosClient.get('/api/user/bookmarks').then((res) => res.data);

export const addBookmark = (programId) =>
    axiosClient.post(`/api/user/bookmarks/${programId}`).then((res) => res.data);

export const removeBookmark = (programId) =>
    axiosClient.delete(`/api/user/bookmarks/${programId}`).then((res) => res.data);


// ─── Channel browsing (USER, read-only) ─────────────────────────────────────

/**
 * Paginated channel list for browsing. filter = { search? } where `search`
 * matches the channel name OR id (case-insensitive). Returns a Spring Page
 * ({ content, totalPages, totalElements, ... }).
 */
export const getUserChannels = (filter = {}, page = 0, size = 24) => {
    const params = { page, size };
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/user/channels', { params }).then((res) => res.data);
};

/** A single channel's detail (read-only): id, name, channelGroupName, sources, … */
export const getUserChannel = (id) =>
    axiosClient.get(`/api/user/channels/${id}`).then((res) => res.data);

/**
 * One channel's live schedule for a date — labeled rows (HomeProgramResponse)
 * carrying the caller's bookmark state. `date` is ISO yyyy-MM-dd (defaults to
 * today on the server if omitted).
 */
export const getUserChannelPrograms = (id, date) =>
    axiosClient
        .get(`/api/user/channels/${id}/programs`, { params: date ? { date } : {} })
        .then((res) => res.data);

/**
 * Where to watch a program on tv360 → { available, url, kind }. `available` is
 * false when the channel has no tv360 mapping. Resolved server-side (the pid for
 * a specific program comes from tv360's schedule API, which the browser can't
 * call directly).
 */
export const getWatchLink = (channelId, programId) =>
    axiosClient
        .get(`/api/user/channels/${channelId}/programs/${programId}/watch-link`)
        .then((res) => res.data);


// ─── Reminders ──────────────────────────────────────────────────────────────

/** All of the caller's reminders (newest schedule time first on the server). */
export const getReminders = () =>
    axiosClient.get('/api/user/reminders').then((res) => res.data);

/** One program's reminder, or null if none set (server returns 204). */
export const getReminder = (programId) =>
    axiosClient.get(`/api/user/reminders/${programId}`).then((res) => res.data || null);

/** Create/update a reminder. data = { programId, minutesBefore, channel }. */
export const setReminder = (data) =>
    axiosClient.post('/api/user/reminders', data).then((res) => res.data);

export const deleteReminder = (programId) =>
    axiosClient.delete(`/api/user/reminders/${programId}`).then((res) => res.data);


// ─── Web Push subscription ──────────────────────────────────────────────────

/** { enabled, publicKey } — the VAPID key the browser needs to subscribe. */
export const getPushPublicKey = () =>
    axiosClient.get('/api/user/push/public-key').then((res) => res.data);

/** Register this device's push subscription. sub = { endpoint, p256dh, auth }. */
export const subscribePush = (sub) =>
    axiosClient.post('/api/user/push/subscribe', sub).then((res) => res.data);

export const unsubscribePush = (endpoint) =>
    axiosClient.delete('/api/user/push/subscribe', { params: { endpoint } }).then((res) => res.data);


// ─── Telegram linking ───────────────────────────────────────────────────────

/** { available, connected, botUsername, code, deepLink } for the current user. */
export const getTelegramStatus = () =>
    axiosClient.get('/api/user/telegram/status').then((res) => res.data);

export const disconnectTelegram = () =>
    axiosClient.post('/api/user/telegram/disconnect').then((res) => res.data);