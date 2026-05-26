import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.RESEND_FROM ?? "Amori Muori <orders@amorimuori.com>";
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
  items: { pizza_name: string; quantity: number; unit_price_cents: number }[];
}

export async function sendConfirmationEmail(data: ConfirmationEmailData) {
  const { to, name, code, pickupAt, subtotalCents, tipCents, totalCents, items } = data;

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
                See you tonight!
              </h1>
              <p style="margin:8px 0 0;font-size:16px;color:#F8EAD5aa;font-family:Arial,sans-serif;">
                Your order is confirmed, ${name}.
              </p>
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
    subject: `Order ${code} confirmed — see you tonight!`,
    html,
  });
}
