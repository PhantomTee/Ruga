import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .order("created_at", { ascending: false });

    // Surface DB errors rather than silently returning []
    if (error) {
      console.error("markets GET supabase error:", error);
      return NextResponse.json(
        { markets: [], _dbError: error.message, _dbCode: error.code },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { markets: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
