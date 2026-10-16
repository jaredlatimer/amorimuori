import { Resend } from "resend";
import { createHmac } from "crypto";
import { formatBlastBody } from "./blast-format";
import { findPackage, shortEstimate } from "./event-packages";

const resend = new Resend(process.env.RESEND_API_KEY ?? "no-key");

const FROM = process.env.RESEND_FROM ?? "Amori Muori <orders@amorimuori.com>";

export function generateUnsubscribeSig(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET env var not set");
  return createHmac("sha256", secret)
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeSig(email: string, sig: string): boolean {
  try {
    return generateUnsubscribeSig(email) === sig;
  } catch {
    return false;
  }
}
const PICKUP_ADDRESS = "42852 Crossbow Ct, Ashburn, VA 20147";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPickup(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export interface ConfirmationEmailData {
  to: string;
  name: string;
  code: string;
  pickupAt: string;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  discountCents?: number;
  discountLabel?: string;
  referralCode?: string;
  items: { pizza_name: string; quantity: number; unit_price_cents: number }[];
  introCopy?: string;
  subject?: string;
}

export async function sendConfirmationEmail(data: ConfirmationEmailData) {
  const { to, name, code, pickupAt, subtotalCents, tipCents, totalCents, discountCents, discountLabel, referralCode, items, introCopy, subject } = data;

  const discountRow =
    discountCents && discountCents > 0
      ? `<tr>
          <td style="padding:4px 0;font-size:14px;color:#2F7D4F;font-weight:700;font-family:Arial,sans-serif;">${discountLabel ?? "Discount"}</td>
          <td style="padding:4px 0;font-size:14px;color:#2F7D4F;font-weight:700;text-align:right;font-family:Arial,sans-serif;">−${fmt(discountCents)}</td>
        </tr>`
      : "";

  const referralBlock = referralCode ? referralShareBlock(referralCode) : "";

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 0;font-size:15px;color:#484D52;">
          <strong>${item.quantity}×</strong> ${item.pizza_name}
        </td>
        <td style="padding:6px 0;font-size:15px;color:#484D52;text-align:right;font-weight:700;">
          ${fmt(item.unit_price_cents * item.quantity)}
        </td>
      </tr>`
    )
    .join("");

  const tipRow =
    tipCents > 0
      ? `<tr>
          <td style="padding:4px 0;font-size:14px;color:#484D5299;">Tip</td>
          <td style="padding:4px 0;font-size:14px;color:#484D5299;text-align:right;">${fmt(tipCents)}</td>
        </tr>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order ${code} confirmed</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">
                Amori Muori
              </p>
              <h1 style="margin:8px 0 0;font-size:36px;font-weight:900;color:#F8EAD5;line-height:1.1;">
                Thank you!
              </h1>
              ${introCopy ? `<p style="margin:14px 0 0;font-size:16px;color:#F8EAD5cc;font-family:Arial,sans-serif;line-height:1.6;">${introCopy}</p>` : `<p style="margin:8px 0 0;font-size:16px;color:#F8EAD5aa;font-family:Arial,sans-serif;">Your order is confirmed, ${name}.</p>`}
            </td>
          </tr>

          <!-- Order card -->
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:26px;">

              <!-- Code + pickup time -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#484D5266;font-family:Arial,sans-serif;">Order</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#484D52;letter-spacing:1px;">${code}</p>
                  </td>
                  <td style="text-align:right;">
                    <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#484D5266;font-family:Arial,sans-serif;">Pickup</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#2F7D4F;">${formatPickup(pickupAt)}</p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1.5px solid #484D5215;margin:0 0 16px;" />

              <!-- Items -->
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>

              <!-- Totals -->
              <hr style="border:none;border-top:1.5px solid #484D5215;margin:14px 0 12px;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#484D5299;font-family:Arial,sans-serif;">Subtotal</td>
                  <td style="padding:4px 0;font-size:14px;color:#484D5299;text-align:right;font-family:Arial,sans-serif;">${fmt(subtotalCents)}</td>
                </tr>
                ${discountRow}
                ${tipRow}
                <tr>
                  <td style="padding:10px 0 0;font-size:19px;font-weight:900;color:#484D52;border-top:1.5px solid #484D5215;">Total</td>
                  <td style="padding:10px 0 0;font-size:19px;font-weight:900;color:#484D52;text-align:right;border-top:1.5px solid #484D5215;">${fmt(totalCents)}</td>
                </tr>
              </table>

              <!-- Address -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#2F7D4F18;border:1px solid #2F7D4F33;border-radius:10px;padding:14px 16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2F7D4F;font-weight:700;font-family:Arial,sans-serif;">
                      📍 Pickup Address
                    </p>
                    <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:#484D52;font-family:Arial,sans-serif;">
                      ${PICKUP_ADDRESS}
                    </p>
                    <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;">
                      Ashburn Farm neighborhood. Look for the pizza oven.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          ${referralBlock}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#F8EAD555;font-family:Arial,sans-serif;">
                Questions? Reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: subject ?? `Order ${code} confirmed — see you tonight!`,
    html,
  });
}

// ── Referral BOGO ──────────────────────────────────────────────────────────────

// A table row (for the 520px email layout) inviting the customer to share their code
function referralShareBlock(referralCode: string): string {
  return `<tr>
            <td style="padding-top:18px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3E43;border-radius:16px;">
                <tr>
                  <td style="padding:22px 24px;text-align:center;">
                    <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#E8C24A;font-weight:700;font-family:Arial,sans-serif;">Give a friend a free pizza</p>
                    <p style="margin:10px 0 0;font-size:30px;font-weight:900;color:#F8EAD5;letter-spacing:2px;font-family:Arial,sans-serif;">${referralCode}</p>
                    <p style="margin:10px 0 0;font-size:14px;color:#F8EAD5cc;line-height:1.55;font-family:Arial,sans-serif;">
                      Share your code. On a friend's first order of two pizzas, the cheaper one is free.
                      When they pick up, you get the same deal on your next order.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export interface ReferralRewardEmailData {
  to: string;
  name: string;
  friendName: string;
  referralCode: string;
  expiresAt: string;
}

export async function sendReferralRewardEmail(data: ReferralRewardEmailData) {
  const { to, name, friendName, referralCode, expiresAt } = data;
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";
  const firstName = name.trim().split(" ")[0] || "friend";
  const friend = friendName || "Your friend";
  const useBy = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", timeZone: "America/New_York",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your next pizza is on us</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#E8C24A;font-family:Arial,sans-serif;">Reward unlocked</p>
              <h1 style="margin:10px 0 0;font-size:34px;font-weight:900;color:#F8EAD5;line-height:1.1;">Your next pizza is on us, ${firstName}.</h1>
              <p style="margin:14px 0 0;font-size:16px;color:#F8EAD5cc;font-family:Arial,sans-serif;line-height:1.6;">
                ${friend} just had their first Amori Muori order with your code. Thank you for sharing!
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:26px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:900;color:#484D52;">Buy one, get one</p>
              <p style="margin:10px 0 0;font-size:15px;color:#484D52;font-family:Arial,sans-serif;line-height:1.6;">
                Order two pizzas and the cheaper one is free. It's added at checkout automatically when you use this email.
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;">Use by ${useBy}. One reward per order.</p>
              <div style="margin-top:20px;">
                <a href="${SITE}/order" style="display:inline-block;background:#2F7D4F;color:#F8EAD5;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 38px;border-radius:100px;">Start your order →</a>
              </div>
            </td>
          </tr>
          ${referralShareBlock(referralCode)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${friend} used your code. Your next pizza is on us!`,
    html,
  });
}

// ── Admin order notification ───────────────────────────────────────────────────

export interface AdminOrderNotificationData {
  code: string;
  customerName: string;
  customerPhone: string;
  pickupAt: string;
  totalCents: number;
  items: { pizza_name: string; quantity: number }[];
}

export interface PaymentLinkEmailData {
  to: string;
  name: string;
  code: string;
  paymentUrl: string;
  pickupAt: string;
  totalCents: number;
}

export async function sendPaymentLinkEmail(data: PaymentLinkEmailData) {
  if (!data.to) return;
  const { to, name, code, paymentUrl, pickupAt, totalCents } = data;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Amori Muori order ${code} — complete payment`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#2F7D4F">Hi ${name}!</h2>
        <p>Your Amori Muori order <strong>${code}</strong> has been created for pickup at <strong>${formatPickup(pickupAt)}</strong>.</p>
        <p>Total: <strong>${fmt(totalCents)}</strong></p>
        <p>Complete your payment using the link below:</p>
        <a href="${paymentUrl}" style="display:inline-block;background:#2F7D4F;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;margin:16px 0">
          Pay Now →
        </a>
        <p style="color:#888;font-size:13px">This link expires at your pickup time. Once paid, you'll receive a confirmation with the pickup address.</p>
      </div>
    `,
  });
}

export interface PostPickupEmailData {
  to: string;
  name: string;
  code: string;
  introCopy: string;
  subject: string;
}

export async function sendPostPickupEmail(data: PostPickupEmailData) {
  const { to, name, introCopy, subject } = data;
  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;">
        <tr>
          <td style="background:#F8EAD5;border-radius:16px;padding:32px 28px;">
            <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#484D5266;font-family:Arial,sans-serif;">Amori Muori</p>
            <p style="margin:16px 0;font-size:16px;color:#484D52;line-height:1.7;font-family:Arial,sans-serif;">${introCopy}</p>
            <hr style="border:none;border-top:1px solid #484D5215;margin:20px 0;" />
            <p style="margin:0;font-size:15px;color:#484D52;line-height:1.7;font-family:Arial,sans-serif;">
              Thanks for coming out. If you enjoyed it, share a photo and tag us —<br />
              <strong>@amorimuori</strong> on Instagram.
            </p>
            <p style="margin:16px 0 0;font-size:15px;color:#484D52;font-family:Arial,sans-serif;">We'd love to see it.</p>
            <p style="margin:24px 0 0;font-size:15px;color:#484D5299;font-family:Arial,sans-serif;">— Amori Muori</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;">
              You received this because you placed an order with Amori Muori. Hi, ${name}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export interface CateringInquiryData {
  name: string;
  email: string;
  phone?: string;
  eventDate: string;
  location: string;
  guestCount: number;
  eventType: string;
  packageId?: string;
  dietaryNotes?: string;
  servingWindow?: string;
  notes?: string;
}

// Inquiry fields are typed by the public, so escape them before they go into HTML
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendCateringInquiryNotification(data: CateringInquiryData) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";

  const eventDateFormatted = new Date(data.eventDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const pkg = findPackage(data.packageId);
  const rows = [
    ["Name", data.name],
    ["Email", data.email],
    ["Phone", data.phone || "Not given"],
    ["Event date", eventDateFormatted],
    ["Location", data.location],
    ["Guests", String(data.guestCount)],
    ["Kind of event", data.eventType],
    ["Package", pkg ? pkg.name : "Not sure yet"],
    ...(pkg ? [["Estimate", shortEstimate(pkg, data.guestCount)]] : []),
    ["Allergies / dietary", data.dietaryNotes || "None given"],
    ...(data.servingWindow ? [["Serving window", data.servingWindow]] : []),
    ...(data.notes ? [["Notes", data.notes]] : []),
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:6px 0;font-size:14px;color:#484D52;font-family:Arial,sans-serif;font-weight:600;white-space:pre-wrap;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  const contact = data.phone
    ? `Reply directly to ${escapeHtml(data.email)} or call ${escapeHtml(data.phone)}.`
    : `Reply directly to ${escapeHtml(data.email)}.`;

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    replyTo: data.email,
    subject: `Event inquiry — ${data.name}, ${eventDateFormatted} (${data.guestCount} guests)`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#2F7D4F;margin:0 0 16px;">New event inquiry</h2>
        <table cellpadding="0" cellspacing="0">${rows}</table>
        <p style="margin:20px 0 0;font-size:13px;color:#888;">${contact}</p>
        <p style="margin:8px 0 0;font-size:13px;"><a href="${SITE}/admin/events" style="color:#2F7D4F;">Open the Events inbox</a> to mark it Proposal sent, Booked or Lost.</p>
      </div>
    `,
  });
}

export async function sendAdminOrderNotification(data: AdminOrderNotificationData) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const { code, customerName, customerPhone, pickupAt, totalCents, items } = data;

  const itemLines = items.map((i) => `${i.quantity}× ${i.pizza_name}`).join("<br />");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e0e0e0;">
    <tr>
      <td>
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#999;">New order</p>
        <h1 style="margin:0 0 20px;font-size:28px;font-weight:900;color:#484D52;">${code}</h1>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Customer</td>
          </tr>
          <tr>
            <td style="font-size:16px;font-weight:700;color:#484D52;">${customerName}</td>
          </tr>
          <tr>
            <td style="font-size:15px;color:#484D52;">${customerPhone}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Pickup</td>
          </tr>
          <tr>
            <td style="font-size:16px;font-weight:700;color:#2F7D4F;">${formatPickup(pickupAt)}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Order</td>
          </tr>
          <tr>
            <td style="font-size:15px;color:#484D52;line-height:1.6;">${itemLines}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #f0f0f0;padding-top:16px;">
          <tr>
            <td style="font-size:20px;font-weight:900;color:#484D52;">Total: ${fmt(totalCents)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `New order ${code} — ${items.map((i) => `${i.quantity}× ${i.pizza_name}`).join(", ")}`,
    html,
  });
}

// ── Reminder blast ─────────────────────────────────────────────────────────────

export async function sendReminderBlast(emails: string[], fridayDate?: string): Promise<number> {
  if (emails.length === 0) return 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";

  const dateStr = fridayDate
    ? new Date(fridayDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "this Friday";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ordering is now open</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">
                Amori Muori
              </p>
              <h1 style="margin:10px 0 0;font-size:38px;font-weight:900;color:#F8EAD5;line-height:1.1;">
                Ordering is open.
              </h1>
              <p style="margin:12px 0 0;font-size:17px;color:#F8EAD5cc;font-family:Arial,sans-serif;">
                Friday Night Take is taking orders for<br />
                <strong style="color:#F8EAD5;">${dateStr}</strong>
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:28px;text-align:center;">
              <p style="margin:0 0 10px;font-size:16px;color:#484D52;font-family:Arial,sans-serif;line-height:1.5;">
                Reserve your pickup window before slots sell out.<br />
                Fresh Neapolitan pizza, fired at 900° — ready in 60 seconds.
              </p>

              <!-- CTA -->
              <a href="${SITE}/order"
                style="display:inline-block;margin-top:18px;background:#2F7D4F;color:#F8EAD5;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 38px;border-radius:100px;">
                Order now →
              </a>

              <p style="margin:18px 0 0;font-size:13px;color:#484D5266;font-family:Arial,sans-serif;">
                Pickup at Ashburn Farm, VA
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;line-height:1.6;">
                You asked to be notified when ordering opens.<br />
                We only email when a new service night goes live.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Resend batch — max 100 per call; for a small operation this is fine
  const BATCH_SIZE = 100;
  let sent = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    await resend.batch.send(
      chunk.map((email) => ({
        from: FROM,
        to: email,
        subject: `Ordering is open — Friday Night Take, ${dateStr}`,
        html,
      }))
    );
    sent += chunk.length;
  }

  return sent;
}

// ── Afternoon reminder (automated 3:30 PM cron) ───────────────────────────────

export interface AfternoonReminderRecipient {
  customer_name: string;
  customer_email: string;
  code: string;
  pickup_at: string;
}

export async function sendAfternoonReminder(recipients: AfternoonReminderRecipient[]): Promise<number> {
  if (recipients.length === 0) return 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";
  const BATCH_SIZE = 50;
  let sent = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    await resend.batch.send(
      chunk.map((r) => {
        const sig = generateUnsubscribeSig(r.customer_email);
        const unsubUrl = `${SITE}/unsubscribe?email=${encodeURIComponent(r.customer_email)}&sig=${sig}`;
        const pickupTime = new Date(r.pickup_at).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>See you tonight!</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">Amori Muori</p>
              <h1 style="margin:10px 0 0;font-size:36px;font-weight:900;color:#F8EAD5;line-height:1.1;">See you tonight!</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:28px;">
              <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#484D52;font-family:Arial,sans-serif;">Hi ${r.customer_name},</p>
              <p style="margin:0 0 20px;font-size:16px;color:#484D52;font-family:Arial,sans-serif;line-height:1.6;">
                Just a reminder that your pizza is coming up tonight. Here's everything you need:
              </p>

              <!-- Pickup time -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                <tr>
                  <td style="background:#2F7D4F18;border:1px solid #2F7D4F44;border-radius:12px;padding:16px 18px;">
                    <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#2F7D4F;font-weight:700;font-family:Arial,sans-serif;">Your pickup time</p>
                    <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#2F7D4F;font-family:Arial,sans-serif;line-height:1;">${pickupTime}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;">Order ${r.code}</p>
                  </td>
                </tr>
              </table>

              <!-- Address -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#484D5208;border:1px solid #484D5220;border-radius:12px;padding:16px 18px;">
                    <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#484D52;font-weight:700;font-family:Arial,sans-serif;">📍 Pickup address</p>
                    <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:#484D52;font-family:Arial,sans-serif;">${PICKUP_ADDRESS}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;">Ashburn Farm neighborhood. Look for the pizza oven.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;line-height:1.8;">
                You're receiving this because you have an order tonight.<br />
                <a href="${unsubUrl}" style="color:#F8EAD566;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        return { from: FROM, to: r.customer_email, subject: `See you tonight — pickup at ${pickupTime}`, html };
      })
    );
    sent += chunk.length;
  }

  return sent;
}

// ── Order blast (personalized, tonight's customers) ────────────────────────────

export interface OrderBlastRecipient {
  email: string;
  name: string;
  code: string;
  pickupAt: string;
}

export async function sendOrderBlast({
  recipients,
  subject,
  message,
}: {
  recipients: OrderBlastRecipient[];
  subject: string;
  message: string;
}): Promise<number> {
  if (recipients.length === 0) return 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";
  const BATCH_SIZE = 50;
  let sent = 0;

  const messageHtml = formatBlastBody(message);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    await resend.batch.send(
      chunk.map((r) => {
        const sig = generateUnsubscribeSig(r.email);
        const unsubUrl = `${SITE}/unsubscribe?email=${encodeURIComponent(r.email)}&sig=${sig}`;
        const pickupTime = new Date(r.pickupAt).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">Amori Muori</p>
              <h1 style="margin:10px 0 0;font-size:34px;font-weight:900;color:#F8EAD5;line-height:1.1;font-family:Georgia,serif;">${subject}</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:28px;">
              <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#484D52;font-family:Arial,sans-serif;">Hi ${r.name},</p>
              ${messageHtml}

              <!-- Pickup reminder -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#2F7D4F18;border:1px solid #2F7D4F44;border-radius:12px;padding:16px 18px;">
                    <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#2F7D4F;font-weight:700;font-family:Arial,sans-serif;">Your pickup</p>
                    <p style="margin:6px 0 0;font-size:26px;font-weight:900;color:#2F7D4F;font-family:Arial,sans-serif;line-height:1;">${pickupTime}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;">Order ${r.code} · Ashburn Farm, VA</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;line-height:1.8;">
                You're receiving this because you have an order tonight.<br />
                <a href="${unsubUrl}" style="color:#F8EAD566;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        return { from: FROM, to: r.email, subject, html };
      })
    );
    sent += chunk.length;
  }

  return sent;
}

// ── Event blast ────────────────────────────────────────────────────────────────

export interface BlastData {
  emails: string[];
  subject: string;
  body: string;
  eventDate?: string; // "YYYY-MM-DD"
  referralCodes?: Record<string, string>; // lower-cased email → code, adds a share-your-code card
}

export async function sendBlast({ emails, subject, body, eventDate, referralCodes }: BlastData): Promise<number> {
  if (emails.length === 0) return 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://amorimuori.com";

  const dateStr = eventDate
    ? new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  const bodyHtml = formatBlastBody(body);

  const BATCH_SIZE = 100;
  let sent = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    await resend.batch.send(
      chunk.map((email) => {
        const sig = generateUnsubscribeSig(email);
        const unsubUrl = `${SITE}/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#484D52;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">
                Amori Muori
              </p>
              <h1 style="margin:10px 0 0;font-size:34px;font-weight:900;color:#F8EAD5;line-height:1.1;font-family:Georgia,serif;">
                ${subject}
              </h1>
              ${dateStr ? `<p style="margin:10px 0 0;font-size:18px;font-weight:700;color:#2F7D4F;font-family:Arial,sans-serif;">${dateStr}</p>` : ""}
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#F8EAD5;border-radius:16px;padding:28px;">
              ${bodyHtml}
              ${dateStr ? `
              <div style="text-align:center;margin-top:22px;">
                <a href="${SITE}/order"
                  style="display:inline-block;background:#2F7D4F;color:#F8EAD5;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 38px;border-radius:100px;">
                  Order now →
                </a>
              </div>
              <p style="margin:16px 0 0;font-size:13px;color:#484D5266;text-align:center;font-family:Arial,sans-serif;">
                Pickup at Ashburn Farm, VA
              </p>` : ""}
            </td>
          </tr>

          ${referralCodes?.[email.toLowerCase()] ? referralShareBlock(referralCodes[email.toLowerCase()]) : ""}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;line-height:1.8;">
                You're receiving this because you've ordered from Amori Muori.<br />
                <a href="${unsubUrl}" style="color:#F8EAD566;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        return { from: FROM, to: email, subject, html };
      })
    );
    sent += chunk.length;
  }

  return sent;
}

// ── Orders-open Wednesday reminder ────────────────────────────────────────────

export interface OrdersOpenEmailData {
  to: string;
  introCopy: string;
  serviceDate: string;
  pizzas: { name: string; description: string; price_cents: number; is_special: boolean; allergens: string[] }[];
  orderUrl: string;
}

export async function sendOrdersOpenEmail(data: OrdersOpenEmailData): Promise<void> {
  const { to, introCopy, serviceDate, pizzas, orderUrl } = data;

  const fridayFormatted = new Date(serviceDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const introCopyWithLink = introCopy.replace("[ORDER_LINK]", `<a href="${orderUrl}" style="color:#2F7D4F;font-weight:700;">${orderUrl}</a>`);

  const pizzaRows = pizzas.map((p) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #484D5215;vertical-align:top;">
        <div>
          <strong style="font-size:16px;color:#484D52;font-family:Arial,sans-serif;">${p.name}</strong>
          ${p.is_special ? `<span style="font-size:11px;font-weight:700;background:#E8C24A;color:#484D52;border-radius:100px;padding:2px 8px;margin-left:8px;font-family:Arial,sans-serif;">Special</span>` : ""}
          <span style="font-size:15px;font-weight:700;color:#2F7D4F;margin-left:10px;font-family:Arial,sans-serif;">${fmt(p.price_cents)}</span>
        </div>
        <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;line-height:1.5;">${p.description}</p>
        ${p.allergens.length > 0 ? `<p style="margin:4px 0 0;font-size:11px;color:#484D5266;font-family:Arial,sans-serif;">${p.allergens.join(", ")}</p>` : ""}
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#484D52;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;">
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">Amori Muori</p>
            <h1 style="margin:8px 0 0;font-size:32px;font-weight:900;color:#F8EAD5;font-family:Georgia,serif;line-height:1.1;">Ordering is open.</h1>
            <p style="margin:6px 0 0;font-size:15px;color:#F8EAD5aa;font-family:Arial,sans-serif;">${fridayFormatted}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8EAD5;border-radius:16px;padding:28px;">
            <p style="margin:0 0 20px;font-size:16px;color:#484D52;line-height:1.7;font-family:Arial,sans-serif;">${introCopyWithLink}</p>
            <hr style="border:none;border-top:1.5px solid #484D5215;margin:0 0 20px;" />
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#484D5266;font-weight:700;font-family:Arial,sans-serif;">This Friday's menu</p>
            <table width="100%" cellpadding="0" cellspacing="0">${pizzaRows}</table>
            <div style="text-align:center;margin-top:28px;">
              <a href="${orderUrl}" style="display:inline-block;background:#2F7D4F;color:#F8EAD5;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 40px;border-radius:100px;">Order now →</a>
            </div>
            <p style="margin:14px 0 0;font-size:13px;color:#484D5266;text-align:center;font-family:Arial,sans-serif;">Pickup at Ashburn Farm, VA · address shared after payment</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;">You're receiving this because you've ordered from or signed up with Amori Muori.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Ordering is open for ${fridayFormatted} — Amori Muori`,
    html,
  });
}

export function buildOrdersOpenEmailPayload(data: OrdersOpenEmailData): { from: string; to: string; subject: string; html: string } {
  const { to, introCopy, serviceDate, pizzas, orderUrl } = data;

  const fridayFormatted = new Date(serviceDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const introCopyWithLink = introCopy.replace("[ORDER_LINK]", `<a href="${orderUrl}" style="color:#2F7D4F;font-weight:700;">${orderUrl}</a>`);

  const pizzaRows = pizzas.map((p) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #484D5215;vertical-align:top;">
        <div>
          <strong style="font-size:16px;color:#484D52;font-family:Arial,sans-serif;">${p.name}</strong>
          ${p.is_special ? `<span style="font-size:11px;font-weight:700;background:#E8C24A;color:#484D52;border-radius:100px;padding:2px 8px;margin-left:8px;font-family:Arial,sans-serif;">Special</span>` : ""}
          <span style="font-size:15px;font-weight:700;color:#2F7D4F;margin-left:10px;font-family:Arial,sans-serif;">${fmt(p.price_cents)}</span>
        </div>
        <p style="margin:4px 0 0;font-size:13px;color:#484D5299;font-family:Arial,sans-serif;line-height:1.5;">${p.description}</p>
        ${p.allergens.length > 0 ? `<p style="margin:4px 0 0;font-size:11px;color:#484D5266;font-family:Arial,sans-serif;">${p.allergens.join(", ")}</p>` : ""}
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#484D52;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#484D52;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;">
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#F8EAD5aa;font-family:Arial,sans-serif;">Amori Muori</p>
            <h1 style="margin:8px 0 0;font-size:32px;font-weight:900;color:#F8EAD5;font-family:Georgia,serif;line-height:1.1;">Ordering is open.</h1>
            <p style="margin:6px 0 0;font-size:15px;color:#F8EAD5aa;font-family:Arial,sans-serif;">${fridayFormatted}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8EAD5;border-radius:16px;padding:28px;">
            <p style="margin:0 0 20px;font-size:16px;color:#484D52;line-height:1.7;font-family:Arial,sans-serif;">${introCopyWithLink}</p>
            <hr style="border:none;border-top:1.5px solid #484D5215;margin:0 0 20px;" />
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#484D5266;font-weight:700;font-family:Arial,sans-serif;">This Friday's menu</p>
            <table width="100%" cellpadding="0" cellspacing="0">${pizzaRows}</table>
            <div style="text-align:center;margin-top:28px;">
              <a href="${orderUrl}" style="display:inline-block;background:#2F7D4F;color:#F8EAD5;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 40px;border-radius:100px;">Order now →</a>
            </div>
            <p style="margin:14px 0 0;font-size:13px;color:#484D5266;text-align:center;font-family:Arial,sans-serif;">Pickup at Ashburn Farm, VA · address shared after payment</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#F8EAD544;font-family:Arial,sans-serif;">You're receiving this because you've ordered from or signed up with Amori Muori.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    from: FROM,
    to,
    subject: `Ordering is open for ${fridayFormatted} — Amori Muori`,
    html,
  };
}
