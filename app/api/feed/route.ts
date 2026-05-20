import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("commits_processed")
      .select("*")
      .order("processed_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ feed: data || [] });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
