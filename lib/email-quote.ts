import type { EmailAccount } from "@prisma/client";
import type { MailDetail } from "@/lib/email";
import { materialRateCatalog } from "@/lib/pricing";

const COLOURS = [
  "black", "white", "red", "blue", "green", "yellow", "orange", "purple",
  "pink", "grey", "gray", "silver", "gold", "brown", "beige", "clear",
];

export type ParsedQuoteRequest = {
  senderName: string | null;
  senderEmail: string;
  description: string;
  quantity: number;
  material: string | null;
  colour: string | null;
  estimatedGrams: number | null;
  estimatedMinutes: number | null;
  missingFields: string[];
  confidence: number;
  likelyQuoteRequest: boolean;
};

function firstNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

export function senderAddress(from: string) {
  const bracketed = from.match(/^(.*?)<([^<>@\s]+@[^<>\s]+)>/);
  if (bracketed) {
    return {
      name: bracketed[1].replace(/^["']|["']$/g, "").trim() || null,
      email: bracketed[2].trim().toLowerCase(),
    };
  }
  const email = from.match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
  return { name: null, email: email.toLowerCase() };
}

function cleanMessage(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^>/.test(line.trim()))
    .join("\n")
    .split(/\nOn .+wrote:\n/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

export function parseQuoteRequest(input: Pick<MailDetail, "from" | "subject" | "text">): ParsedQuoteRequest {
  const sender = senderAddress(input.from);
  const body = cleanMessage(input.text);
  const combined = `${input.subject}\n${body}`;
  const lower = combined.toLowerCase();
  const codes = materialRateCatalog().materials.map((item) => item.code);
  const material = codes.find((code) => new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(combined)) || null;
  const colour = COLOURS.find((value) => new RegExp(`\\b${value}\\b`, "i").test(combined)) || null;
  const quantity = Math.max(1, Math.round(firstNumber(lower, [
    /(?:quantity|qty|need|want|make|print|order)\s*(?:of|:|=)?\s*(\d{1,5})\b/i,
    /\b(\d{1,5})\s*(?:pieces|pcs|copies|units|keychains|parts|items)\b/i,
  ]) || 1));
  const grams = firstNumber(lower, [
    /(?:estimated\s*)?(?:weight|material|filament|grams?)\s*(?:per\s*(?:item|piece))?\s*(?:is|:|=|of)?\s*(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/i,
    /\b(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*(?:per\s*(?:item|piece))\b/i,
    /\b(?:about|approximately|approx\.?)?\s*(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/i,
  ]);
  const hours = firstNumber(lower, [/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i]);
  const minutes = firstNumber(lower, [
    /(?:print|machine|estimated)\s*time\s*(?:per\s*(?:item|piece))?\s*(?:is|:|=|of)?\s*(\d+)\s*(?:minutes?|mins?)\b/i,
    /\b(\d+)\s*(?:minutes?|mins?)\s*(?:per\s*(?:item|piece))\b/i,
    /\b(\d+)\s*(?:minutes?|mins?)\b/i,
  ]);
  const estimatedMinutes = hours !== null ? Math.round(hours * 60) : minutes === null ? null : Math.round(minutes);
  const subjectDescription = input.subject
    .replace(/^(re|fw|fwd):\s*/gi, "")
    .replace(/\b(?:quote|quotation|estimate|pricing|price)\s*(?:request|needed|please)?\b/gi, "")
    .replace(/^[-:–—\s]+|[-:–—\s]+$/g, "")
    .trim();
  const description = subjectDescription || body.slice(0, 160) || "3D printing request";
  const intentTerms = ["quote", "quotation", "estimate", "price", "pricing", "cost", "how much", "3d print", "print this", "stl"];
  const intentMatches = intentTerms.filter((term) => lower.includes(term)).length;
  const detailCount = [material, colour, grams, estimatedMinutes, quantity > 1].filter(Boolean).length;
  const confidence = Math.min(100, 30 + intentMatches * 15 + detailCount * 8);
  const missingFields = [
    ...(!material ? ["material"] : []),
    ...(!grams ? ["estimated grams per item"] : []),
    ...(estimatedMinutes === null ? ["estimated print minutes per item"] : []),
  ];
  return {
    senderName: sender.name,
    senderEmail: sender.email,
    description,
    quantity,
    material,
    colour,
    estimatedGrams: grams,
    estimatedMinutes,
    missingFields,
    confidence,
    likelyQuoteRequest: Boolean(sender.email && (intentMatches > 0 || detailCount >= 3)),
  };
}

export function quoteReviewEmail(account: EmailAccount, input: {
  draftId: string;
  subject: string;
  senderEmail: string;
  description: string;
  quantity: number;
  material: string | null;
  colour: string | null;
  estimatedGrams: number | null;
  estimatedMinutes: number | null;
  missingFields: string[];
}) {
  const base = (process.env.TITAN_BASE_URL || "http://localhost:1200").replace(/\/$/, "");
  return {
    to: account.quoteForwardTo || "",
    subject: `TITAN quote request: ${input.subject}`,
    text: [
      "TITAN found a possible customer quote request.",
      "",
      `Customer: ${input.senderEmail}`,
      `Description: ${input.description}`,
      `Quantity: ${input.quantity}`,
      `Material: ${input.material || "Needs review"}`,
      `Colour: ${input.colour || "Not specified"}`,
      `Weight per item: ${input.estimatedGrams ?? "Needs review"} g`,
      `Print time per item: ${input.estimatedMinutes ?? "Needs review"} minutes`,
      `Missing: ${input.missingFields.join(", ") || "None"}`,
      "",
      `Review in TITAN: ${base}/messages/quote-drafts#${input.draftId}`,
      "",
      "No quote has been sent to the customer.",
    ].join("\n"),
  };
}
