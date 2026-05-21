import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    // Run both a count query and a full select to isolate the issue
    const [countResult, dataResult] = await Promise.all([
      supabase.from("markets").select("id", { count: "exact", head: true }),
      supabase.from("markets").select("*").order("created_at", { ascending: false })
    ]);

    // Return debug info so we can see exactly what Supabase reports
    if (countResult.error || dataResult.error) {
      return NextResponse.json(
        {
          markets: [],
          _countError: countResult.error?.message,
          _dataError: dataResult.error?.message,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { markets: dataResult.data ?? [], _count: countResult.count },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
