import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("markets").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ markets: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown markets failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
