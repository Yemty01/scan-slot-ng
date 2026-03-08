import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { interpretSearchQuery } from "@/lib/ai/search-interpret";

/**
 * POST /api/ai/search
 * Body: { query: string, limit?: number, offset?: number }
 * Uses AI to interpret the query, then runs the DB search_services RPC.
 * Returns: { interpretation, results }.
 * The AI does NOT diagnose or give medical advice.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query : "";
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
    const offset = Math.max(Number(body.offset) || 0, 0);

    const interpretation = await interpretSearchQuery(query);

    const supabase = await createClient();

    let categoryId: string | null = null;
    if (interpretation.category_slugs.length > 0) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", interpretation.category_slugs[0])
        .eq("is_active", true)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    const pQuery = interpretation.search_phrase ?? interpretation.category_slugs[0] ?? null;
    const pState = interpretation.state ?? null;
    let pMaxPrice: number | null = null;
    if (interpretation.price_hint === "cheap") pMaxPrice = 15_000;
    if (interpretation.price_hint === "affordable") pMaxPrice = 50_000;

    const { data: results, error } = await supabase.rpc("search_services", {
      p_query: pQuery,
      p_category_id: categoryId,
      p_state: pState,
      p_min_price: null,
      p_max_price: pMaxPrice,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interpretation: {
        category_slugs: interpretation.category_slugs,
        state: interpretation.state,
        city_or_area: interpretation.city_or_area,
        price_hint: interpretation.price_hint,
        search_phrase: interpretation.search_phrase,
      },
      results: results ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    const isConfig = message.includes("OPENAI");
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 500 }
    );
  }
}
