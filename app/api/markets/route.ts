import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    // Use a date floor so the query never does an unrestricted full table scan —
    // Supabase RLS can block unfiltered SELECTs even for the service role in some configs.
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .gte("created_at", "2020-01-01T00:00:00Z")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(
      { markets: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
