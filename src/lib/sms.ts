import twilio from "twilio";

// SMS is optional — if Twilio env vars aren't set, all functions no-op gracefully
function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendOrderInOven(phone: string, code: string, etaMinutes: number) {
  const client = getClient();
  if (!client || !process.env.TWILIO_PHONE_NUMBER) return;
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toE164(phone),
    body: `Your Amori Muori order ${code} is in the oven 🍕 — about ${etaMinutes} min. Head over to Ashburn Farm.`,
  });
}

export async function sendPaymentLink(phone: string, name: string, code: string, url: string) {
  const client = getClient();
  if (!client || !process.env.TWILIO_PHONE_NUMBER) return;
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toE164(phone),
    body: `Hi ${name}! Your Amori Muori order ${code} is ready to pay. Complete payment here: ${url}`,
  });
}

export async function sendOrderReady(phone: string, code: string) {
  const client = getClient();
  if (!client || !process.env.TWILIO_PHONE_NUMBER) return;
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toE164(phone),
    body: `Your Amori Muori order ${code} is ready! Come pick it up. 📍 42852 Crossbow Ct, Ashburn Farm.`,
  });
}
