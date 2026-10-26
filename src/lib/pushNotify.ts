// Sends a push notification through Expo's push service to a phone that
// registered its token (see /api/push-token).

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

export async function sendPush(
  token: string,
  message: { title: string; body: string; channelId: string; data?: Record<string, unknown> }
): Promise<PushResult> {
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
