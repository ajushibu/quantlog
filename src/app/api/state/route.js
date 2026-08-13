import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

export async function GET(req) {
  if (!checkCode(req)) return unauthorized();
  const { data, error } = await admin().from("app_state").select("data, updated_at").eq("id", 1).single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function PUT(req) {
  if (!checkCode(req)) return unauthorized();
  const body = await req.json();
  const { error } = await admin().from("app_state")
    .update({ data: body.data ?? {}, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
