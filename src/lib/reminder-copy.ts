import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You write short email copy for Amori Muori, a Neapolitan pizza pop-up in Ashburn Farm, Ashburn VA.
Tone: warm, direct, a little Italian-rooted. Like a friend who happens to make excellent pizza.
Rules:
- 3 to 4 sentences maximum. No more.
- Never use exclamation points.
- Do not invent details not present in the data provided.
- Do not list all the pizzas — the full menu follows in the email template.
- If there is a special this week, mention it by name with one short descriptor.
- If a pizza sold out early last week, mention it once as a practical heads-up, not a hype tactic.
- If there is a new pizza, mention it briefly.
- If nothing notable is happening (no specials, no sellouts, no new items), write a quiet 2-sentence opener: ordering is open, slots fill through the week.
- End on the order link call to action: "Order at [ORDER_LINK]" — use that placeholder exactly.`;

export type ReminderCopyInput = {
  pizzas: {
    name: string;
    description: string;
    isSpecial: boolean;
    isNew: boolean;
    allergens: string[];
  }[];
  lastWeek: {
    soldOutPizzas: { name: string }[];
    totalOrders: number;
    allSoldOut: boolean;
  } | null;
};

function buildUserMessage(input: ReminderCopyInput): string {
  const pizzaLines = input.pizzas
    .map((p) => `- ${p.name}${p.isSpecial ? " (SPECIAL)" : ""}${p.isNew ? " (NEW)" : ""}: ${p.description}`)
    .join("\n");

  let lastWeekLines = "";
  if (!input.lastWeek) {
    lastWeekLines = "No prior service data — this is the first week.";
  } else {
    const { soldOutPizzas, totalOrders, allSoldOut } = input.lastWeek;
    if (soldOutPizzas.length > 0) {
      lastWeekLines += `- ${soldOutPizzas.length} pizza(s) sold out: ${soldOutPizzas.map((p) => p.name).join(", ")}\n`;
    } else {
      lastWeekLines += "- No sellouts — all pizzas available through close.\n";
    }
    if (allSoldOut) lastWeekLines += "- Full nightly pool sold out.\n";
    lastWeekLines += `Total orders last Friday: ${totalOrders}`;
  }

  return `This week's menu:\n${pizzaLines}\n\nLast Friday:\n${lastWeekLines}`;
}

const FALLBACK = "Ordering is open for this Friday. The full menu is below — slots fill through the week, so earlier is better. Order at [ORDER_LINK].";

export async function generateReminderCopy(input: ReminderCopyInput): Promise<string> {
  try {
    const result = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Claude timeout")), 4000)
      ),
    ]);

    const text = result.content[0].type === "text" ? result.content[0].text.trim() : "";
    return text || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
