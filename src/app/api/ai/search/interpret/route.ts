import { NextRequest, NextResponse } from "next/server";
import { interpretSearchQuery } from "@/lib/ai/search-interpret";

/**
 * POST /api/ai/search/interpret
 * Body: { query: string }
 * Returns: { category_slugs, state, city_or_area, price_hint, search_phrase }
 * for use with the service search (e.g. search_services or GET /api/slots).
 * The AI does NOT diagnose or give medical advice; it only maps the query to filters.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query : "";

    const interpretation = await interpretSearchQuery(query);

    return NextResponse.json(interpretation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interpretation failed";
    const isConfig = message.includes("OPENAI");
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 500 }
    );
  }
}
