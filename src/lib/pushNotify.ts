// Sends a push notification to a phone that registered with /api/push-token: through
// Expo's push service for the Android app, or Web Push for the installed web app (PWA).
// Both kinds are kept in Employee.pushToken: an Expo token is a plain string, a web
// subscription is stored as its JSON text.

import webpush from "web-push";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TIMEOUT_MS = 10_000;

export type PushResult =
  | { ok: true }
  /** Expo says the token is dead (app uninstalled / signed out); drop it. */
  | { ok: false; reason: "unregistered" }
  | { ok: false; reason: "failed"; message: string };

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(value);
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** A browser push subscription as sent by PushSubscription.toJSON(). Must be https. */
export function isWebPushSubscription(value: unknown): value is WebPushSubscription {
  const v = value as WebPushSubscription | null;
  return (
    typeof v?.endpoint === "string" &&
    v.endpoint.startsWith("https://") &&
    v.endpoint.length < 1000 &&
    typeof v.keys?.p256dh === "string" &&
    typeof v.keys?.auth === "string"
  );
}

function parseWebSubscription(token: string): WebPushSubscription | null {
  if (!token.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(token);
    return isWebPushSubscription(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function sendWebPush(
  subscription: WebPushSubscription,
  message: { title: string; body: string; data?: Record<string, unknown> }
): Promise<PushResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return { ok: false, reason: "failed", message: "Web push isn't configured (VAPID keys missing)." };
  }
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: message.title, body: message.body, data: message.data }),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || process.env.APP_URL || "mailto:admin@example.com",
          publicKey,
          privateKey,
        },
        urgency: "high",
        TTL: 60 * 60,
        timeout: TIMEOUT_MS,
      }
    );
    return { ok: true };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // 404/410: the browser dropped the subscription (app removed / permission revoked).
    if (status === 404 || status === 410) return { ok: false, reason: "unregistered" };
    return { ok: false, reason: "failed", message: "Couldn't reach the push service." };
  }
}

export async function sendPush(
  token: string,
  message: { title: string; body: string; channelId: string; data?: Record<string, unknown> }
): Promise<PushResult> {
  const web = parseWebSubscription(token);
  if (web) return sendWebPush(web, message);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, sound: "default", priority: "high", ...message }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    const ticket = json?.data;
    if (res.ok && ticket?.status === "ok") return { ok: true };
    if (ticket?.details?.error === "DeviceNotRegistered") return { ok: false, reason: "unregistered" };
    return {
      ok: false,
      reason: "failed",
      message: ticket?.message ?? json?.errors?.[0]?.message ?? `Push service error (${res.status}).`,
    };
  } catch {
    return { ok: false, reason: "failed", message: "Couldn't reach the push service." };
  } finally {
    clearTimeout(timer);
  }
}
