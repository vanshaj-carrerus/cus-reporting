import nodemailer, { type Transporter } from "nodemailer";

export const MAIL_NOT_CONFIGURED =
  "Email isn't configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS (or EMAIL_USER and EMAIL_PASS for Gmail) in .env and restart the server.";

type MailConfig = { transporter: Transporter; from: string };

// Reused between requests (and dev hot reloads) so each email doesn't open a
// fresh connection.
const globalForMail = globalThis as unknown as { mailConfig?: MailConfig };

function loadConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = (process.env.SMTP_USER ?? process.env.EMAIL_USER)?.trim();
  const pass = process.env.SMTP_PASS ?? process.env.EMAIL_PASS;
  if (!user || !pass) return null;

  const from = process.env.MAIL_FROM?.trim() || user;

  if (host) {
    const port = Number(process.env.SMTP_PORT) || 587;
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS. SMTP_SECURE overrides.
    const secure = process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465;
    return {
      transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
      from,
    };
  }

  // Just EMAIL_USER / EMAIL_PASS: assume Gmail with an app password.
  return {
    transporter: nodemailer.createTransport({ service: "gmail", auth: { user, pass } }),
    from,
  };
}

export function isMailConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_USER ?? process.env.EMAIL_USER)?.trim() &&
      (process.env.SMTP_PASS ?? process.env.EMAIL_PASS)
  );
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Emails `to` their verification code. Throws if mail isn't configured or sending fails. */
export async function sendVerificationEmail(to: string, name: string, code: string) {
  const config = (globalForMail.mailConfig ??= loadConfig() ?? undefined);
  if (!config) throw new Error(MAIL_NOT_CONFIGURED);

  const minutes = 10;
  await config.transporter.sendMail({
    from: config.from,
    to,
    subject: `Your CUS Shift verification code: ${code}`,
    text:
      `Hi ${name},\n\nYour CUS Shift verification code is ${code}.\n` +
      `It expires in ${minutes} minutes. Enter it in the app to set your password.\n\n` +
      `If you didn't ask for this, you can ignore this email — your password hasn't changed.`,
    html: `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#333">
  <table role="presentation" align="center" width="100%" style="max-width:480px;background:#fff;border-radius:8px;overflow:hidden">
    <tr><td style="background:#2563eb;color:#fff;padding:18px 24px;font-size:18px;font-weight:600">CUS Shift</td></tr>
    <tr><td style="padding:24px;text-align:center">
      <p style="margin:0 0 12px;text-align:left">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;text-align:left">Use this code to verify your email and set your password:</p>
      <div style="display:inline-block;padding:12px 20px;background:#eff6ff;border-radius:6px;font-size:30px;font-weight:700;letter-spacing:6px;color:#2563eb">${code}</div>
      <p style="margin:16px 0 0;font-size:13px;color:#666">It expires in ${minutes} minutes.</p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f9fafb;font-size:12px;color:#666">
      If you didn't ask for this, ignore this email — your password hasn't changed.
    </td></tr>
  </table>
</body></html>`,
  });
}
