import axios from 'axios';

/**
 * URL of the n8n "AI Controller" webhook that runs the schedule-cleaning
 * pipeline (Gemini → cleaned programs written into a new draft_batch).
 *
 * Kept in an env var so deployments can repoint it without a code change. Set
 * VITE_AI_CONTROLLER_URL in the frontend .env. The default matches the current
 * n8n instance.
 *
 * NOTE: the webhook is plain HTTP. If the app is ever served over HTTPS, point
 * this at an HTTPS endpoint (or proxy it) to avoid mixed-content blocking.
 */
const AI_CONTROLLER_URL =
    import.meta.env.VITE_AI_CONTROLLER_URL ||
    'http://123.30.48.228:5679/webhook/ai-controller';

/**
 * Standalone axios instance for the webhook — no JWT header and no backend
 * baseURL (this call goes straight to n8n, not to our Spring API). The cleaning
 * run includes a Gemini call, so allow a generous timeout.
 */
const aiClient = axios.create({ timeout: 180_000 });

/**
 * Fire the AI cleaning workflow for one channel + date.
 *
 * The workflow runs synchronously and always answers HTTP 200; the *logical*
 * result lives in the body:
 *   { result: { channel_id, date }, responseCode: 200|400|401|404|500, message }
 * 200 = a COMPLETED draft was written; anything else is a failure whose `message`
 * is human-readable (e.g. "AI API run out of RPD!", "Content not found!").
 *
 * @param {string} channelId e.g. "DAKLAK"
 * @param {string} date      ISO yyyy-MM-dd, e.g. "2026-06-02"
 * @returns {Promise<{message: string}>} resolves on success; rejects with an
 *          Error whose .message is the failure text and .responseCode the code.
 */
export async function triggerAiClean(channelId, date) {
    const res = await aiClient.post(AI_CONTROLLER_URL, {
        channel_id: channelId,
        date,
    });

    const body = res.data || {};
    const code = body.responseCode ?? 200;

    if (code === 200) {
        return { message: body.message || 'AI cleaning completed.' };
    }

    const err = new Error(body.message || 'AI cleaning failed. Please try again.');
    err.responseCode = code;
    throw err;
}