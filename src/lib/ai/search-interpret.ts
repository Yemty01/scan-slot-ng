import OpenAI from "openai";

/** Category slugs from our DB (categories table). Used to constrain AI output. */
export const SERVICE_CATEGORY_SLUGS = [
  "blood-tests",
  "imaging-scans",
  "consultations",
  "cancer-screening",
  "cardiac-tests",
  "fertility-tests",
  "eye-tests",
  "dental-services",
] as const;

export type PriceHint = "cheap" | "affordable" | "any";

export interface SearchInterpretation {
  /** One or more category slugs from SERVICE_CATEGORY_SLUGS. Empty if unclear. */
  category_slugs: string[];
  /** Nigerian state (e.g. Lagos, Abuja, Rivers). */
  state: string | null;
  /** City or area within state (e.g. Ikeja, Lekki, Victoria Island). */
  city_or_area: string | null;
  /** User intent for price, if mentioned. */
  price_hint: PriceHint | null;
  /** Optional: free-text search phrase for service name/description (e.g. "MRI", "blood count"). */
  search_phrase: string | null;
}

const CATEGORY_LIST = SERVICE_CATEGORY_SLUGS.join(", ");

const SYSTEM_PROMPT = `You are a search query interpreter for a Nigerian healthcare booking platform. Your ONLY job is to turn a user's natural language search into structured filters.

RULES:
- You must NOT diagnose illness, suggest conditions, or give any medical advice.
- Output valid JSON only, no markdown or explanation.
- Map the user's intent to the EXACT category slugs from this list (use only these): ${CATEGORY_LIST}
- For location: extract Nigerian state (e.g. Lagos, Abuja, FCT, Rivers, Kano) and optionally city/area (e.g. Ikeja, Lekki, Wuse, Port Harcourt).
- If the user says "cheap", "affordable", "budget" set price_hint accordingly; otherwise "any".
- If they mention a specific test or scan (e.g. MRI, blood test, ultrasound), set search_phrase to that and pick the best-matching category slug(s).
- If the query is not about finding a healthcare service, return category_slugs: [], state: null, city_or_area: null, price_hint: null, search_phrase: null.`;

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

/**
 * Interpret a natural language search query and return structured filters
 * (categories, location, price hint) for use with the service search API.
 */
export async function interpretSearchQuery(
  query: string
): Promise<SearchInterpretation> {
  const trimmed = query?.trim();
  if (!trimmed) {
    return {
      category_slugs: [],
      state: null,
      city_or_area: null,
      price_hint: null,
      search_phrase: null,
    };
  }

  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_SEARCH_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
    response_format: { type: "json_object" },
    max_tokens: 256,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return {
      category_slugs: [],
      state: null,
      city_or_area: null,
      price_hint: null,
      search_phrase: null,
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      category_slugs: [],
      state: null,
      city_or_area: null,
      price_hint: null,
      search_phrase: null,
    };
  }

  const allowedSlugs = new Set(SERVICE_CATEGORY_SLUGS);
  const category_slugs = Array.isArray(parsed.category_slugs)
    ? (parsed.category_slugs as string[]).filter((s) => allowedSlugs.has(s as (typeof SERVICE_CATEGORY_SLUGS)[number]))
    : [];

  return {
    category_slugs,
    state: typeof parsed.state === "string" && parsed.state.trim() ? parsed.state.trim() : null,
    city_or_area: typeof parsed.city_or_area === "string" && parsed.city_or_area.trim() ? parsed.city_or_area.trim() : null,
    price_hint: parsed.price_hint === "cheap" || parsed.price_hint === "affordable" || parsed.price_hint === "any" ? parsed.price_hint : null,
    search_phrase: typeof parsed.search_phrase === "string" && parsed.search_phrase.trim() ? parsed.search_phrase.trim() : null,
  };
}
