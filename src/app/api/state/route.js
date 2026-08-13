import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

export async function GET(req) {
  if (!checkCode(req)) return unauthorized();
  try {
    const { data, error } = await admin().from("app_state").select("data, updated_at").eq("id", 1).single();
    if (error) { console.error("STATE GET ERROR:", error); return Response.json({ error: error.message }, { status: 500 }); }
    return Response.json(data);
  } catch (e) {
    console.error("STATE GET THREW:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req) {
  if (!checkCode(req)) return unauthorized();
  try {
    const body = await req.json();
    const { error } = await admin().from("app_state")
      .update({ data: body.data ?? {}, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) { console.error("STATE PUT ERROR:", error); return Response.json({ error: error.message }, { status: 500 }); }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("STATE PUT THREW:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}