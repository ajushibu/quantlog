import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

export async function GET(req) {
  if (!checkCode(req)) return unauthorized();
  const { data, error } = await admin().from("struggles").select("*").order("created_at", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ struggles: data });
}

export async function POST(req) {
  if (!checkCode(req)) return unauthorized();
  const s = await req.json();
  const row = {
    id: s.id, text_body: s.text || "", topic_id: s.topicId || "other",
    filed_on: s.date, answer_text: s.answerText || "",
    has_photo: !!s.hasPhoto, has_ans_photo: !!s.hasAnsPhoto,
    retired: false, last_tried: null, keep_count: 0,
  };
  const { error } = await admin().from("struggles").insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function PATCH(req) {
  if (!checkCode(req)) return unauthorized();
  const { id, ...patch } = await req.json();
  const allowed = {};
  if ("retired" in patch) allowed.retired = !!patch.retired;
  if ("lastTried" in patch) allowed.last_tried = patch.lastTried;
  if ("keepCount" in patch) allowed.keep_count = patch.keepCount;
  const { error } = await admin().from("struggles").update(allowed).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
