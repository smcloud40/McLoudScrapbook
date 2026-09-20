import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Always run fresh; never cache this route's response.
export const dynamic = "force-dynamic";

// Any table that exists in the DB works — this just needs to be a real read.
// Override with the KEEPALIVE_TABLE env var if you'd rather not hardcode it.
const TABLE = process.env.KEEPALIVE_TABLE || "profiles";

export async function GET(request: NextRequest) {
  // If you set a CRON_SECRET env var in Vercel, Vercel Cron sends it as
  // "Authorization: Bearer <CRON_SECRET>" automatically, and this blocks
  // anyone else from hitting the route. Optional but recommended.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A trivial real query — enough to count as DB activity, cheap enough to
  // run daily forever.
  const { error } = await supabase.from(TABLE).select("*").limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, table: TABLE, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, table: TABLE, at: new Date().toISOString() });
}
