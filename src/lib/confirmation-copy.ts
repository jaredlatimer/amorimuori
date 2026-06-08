import Anthropic from "@anthropic-ai/sdk";
import { CustomerHistory, CustomerSegment } from "@/lib/customer-history";

const client = new Anthropic();

const SYSTEM_PROMPT = `You write short email copy for Amori Muori, a Neapolitan pizza pop-up in Ashburn Farm, Ashburn VA.
Tone: warm, direct, a little Italian-rooted. Like a friend who happens to make excellent pizza.
Rules:
- 2 to 4 sentences maximum.
- Never use exclamation points.
- Do not invent details not in the data provided.
- Do not state their order history back to them explicitly ("we see you've ordered 3 times" is never acceptable).
- Use the history to calibrate warmth and assumed familiarity — nothing more.
- The full order details follow immediately after this paragraph — do not repeat them.
- Do not mention the pickup address — it appears in the template below.`;

const FALLBACKS: Record<CustomerSegment, string> = {
  first_time:
    "Your order is confirmed. Your pickup time and address are below — you can cancel up to 30 minutes before pickup if your plans change.",
  returning: "Your order is confirmed. See you Friday.",
  lapsed: "Your order is confirmed. Details below.",
  regular: "Confirmed. Details below.",
};

export const SUBJECT_LINES: Record<CustomerSegment, string> = {
  first_time: "Your Amori Muori order is confirmed — here's what's next",
  returning: "Your Amori Muori order is confirmed",
  lapsed: "Your Amori Muori order is confirmed — good to have you back",
  regular: "Order confirmed",
};

function buildUserMessage(
  history: CustomerHistory,
  pizzaList: string,
  pickupTime: string
): string {
  const { segment, totalOrders, weeksSinceLastOrder } = history;

  switch (segment) {
    case "first_time":
      return `First-time customer. They just placed their first order.
Write a warm, brief welcome. One sentence on what happens next: their pickup time is confirmed, the address is below, and they can cancel up to 30 minutes before pickup if needed.
Their order: ${pizzaList}
Pickup time: ${pickupTime}`;

    case "returning":
      return `Returning customer. ${totalOrders} prior order(s), most recent ${weeksSinceLastOrder} week(s) ago.
Write a brief, familiar confirmation. They know how it works — skip the explanation.
Their order: ${pizzaList}
Pickup time: ${pickupTime}`;

    case "lapsed":
      return `Customer who has ordered before but not recently (${weeksSinceLastOrder} weeks since their last order).
Write a warm, brief confirmation that acknowledges (without stating explicitly) that it's been a while — glad they're back. One sentence. Then confirm the order is in.
Their order: ${pizzaList}
Pickup time: ${pickupTime}`;

    case "regular":
      return `Regular customer. ${totalOrders} prior orders.
Write the shortest possible confirmation — one or two sentences. They know the drill completely. Lead with pickup time if anything.
Their order: ${pizzaList}
Pickup time: ${pickupTime}`;
  }
}

export async function generateConfirmationCopy(
  history: CustomerHistory,
  pizzaList: string,
  pickupTime: string
): Promise<string> {
  const fallback = FALLBACKS[history.segment];

  try {
    const result = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildUserMessage(history, pizzaList, pickupTime) },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Claude timeout")), 3000)
      ),
    ]);

    const text =
      result.content[0].type === "text" ? result.content[0].text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}
