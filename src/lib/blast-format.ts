// Formatting for Blast messages. Shared by the sent email (src/lib/email.ts) and the
// admin Preview (BlastClient.tsx) so both render exactly the same HTML.
//
// Supported in the message box:
//   **bold**      *italic* or _italic_      [link text](https://example.com)
// Plain <b>, <strong>, <i>, <em>, <u> and <br> tags still work (no attributes).
// Everything else is escaped, so a stray < or & can't break the email.

const PARAGRAPH_STYLE = "margin:0 0 12px;font-size:16px;color:#484D52;font-family:Arial,sans-serif;line-height:1.6;";
const LINK_STYLE = "color:#2F7D4F;text-decoration:underline;font-weight:700;";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(raw: string): string | null {
  // Bare domains like amorimuori.com/order get https:// so they still work.
  const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : null;
}

export function formatBlastLine(line: string): string {
  let html = escapeHtml(line);

  // Allow a few simple tags people already type by hand.
  html = html.replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, "<$1$2>");
  html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br />");

  // Links first, so * or _ inside a URL aren't treated as italics.
  const links: string[] = [];
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text: string, href: string) => {
    // href was escaped above; undo just &amp; so query strings survive, then re-escape for the attribute.
    const url = safeHref(href.replace(/&amp;/g, "&"));
    if (!url) return match;
    links.push(`<a href="${escapeHtml(url)}" style="${LINK_STYLE}">${text}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });

  html = html.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?![*\w])/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, "$1<em>$2</em>");

  return html.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]);
}

/** Each non-empty line becomes a styled <p>, matching the email card. */
export function formatBlastBody(body: string): string {
  return body
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p style="${PARAGRAPH_STYLE}">${formatBlastLine(l)}</p>`)
    .join("");
}
