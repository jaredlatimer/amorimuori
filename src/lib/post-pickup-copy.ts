import Anthropic from "@anthropic-ai/sdk";
import { CustomerHistory, CustomerSegment } from "@/lib/customer-history";

const client = new Anthropic();

const SYSTEM_PROMPT = `You write short post-pickup thank-you copy for Amori Muori, a Neapolitan pizza pop-up in Ashburn Farm, Ashburn VA.
Tone: genuine, brief, warm. Like a host thanking a guest at the end of the night.
Rules:
- 2 to 3 sentences maximum.
- Never use exclamation points.
- Do not state their order history back to them explicitly.
- Do not mention the food specifically unless it's their first order — you don't know how it went.
- Do not ask for a review or a rating. The Instagram ask follows in the template — do not duplicate it.
- End naturally. The Instagram CTA is a separate block that follows this paragraph.`;

const FALLBACKS: Record<CustomerSegment, string> = {
  first_time: "Thanks for your first order — hope you enjoyed it.",
  returning: "Thanks for coming out tonight.",
  lapsed: "Good to have you back. Thanks for coming out.",
  regular: "Thanks, as always.",
};

export const SUBJECT_LINES: Record<CustomerSegment, string> = {
  first_time: "Thanks for your first Amori Muori order",
  returning: "Thanks for coming out",
  lapsed: "Good to have you back",
  regular: "Thanks, as always",
};

function buildUserMessage(history: CustomerHistory, pizzaList: string): string {
  const { segment, totalOrders, weeksSinceLastOrder } = history;

  switch (segment) {
    case "first_time":
      return `First-time customer. They just picked up their first order.
Write a genuine, brief thank-you for trying it. Hope they enjoyed it. That's all.
What they ordered: ${pizzaList}`;

    case "returning":
      return `Returning customer. ${totalOrders} prior orders, most recent ${weeksSinceLastOrder} week(s) ago.
Brief, familiar thank-you. They're a known face.
What they ordered: ${pizzaList}`;

    case "lapsed":
      return `Customer returning after a gap of ${weeksSinceLastOrder} weeks.
Warm thank-you that acknowledges (without stating) that it's been a while and it's good to have them back.
What they ordered: ${pizzaList}`;

    case "regular":
      return `Regular customer. ${totalOrders} total orders.
The briefest possible thank-you. One sentence. They're practically family at this point.
What they ordered: ${pizzaList}`;
  }
}

export async function generatePostPickupCopy(
  history: CustomerHistory,
  pizzaList: string
): Promise<string> {
  const fallback = FALLBACKS[history.segment];

  try {
    const result = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildUserMessage(history, pizzaList) },
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
