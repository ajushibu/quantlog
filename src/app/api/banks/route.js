import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

/* Question banks live as JSON files in the private storage bucket under
   banks/<topicId>.json — kept out of app_state so the 12s sync poll never
   drags hundreds of questions over the wire. Fetched on demand, cached
   client-side. */

export async function GET(req) {
  if (!checkCode(req)) return unauthorized();
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic");
  const store = admin().storage.from("photos");

  if (!topic) {
    // index: which topics have banks, and how many questions each holds
    const { data, error } = await store.list("banks");
    if (error) return Response.json({ topics: [] });
    return Response.json({ topics: (data || []).filter((f) => f.name.endsWith(".json")).map((f) => f.name.replace(/\.json$/, "")) });
  }

  const { data, error } = await store.download(`banks/${topic}.json`);
  if (error || !data) return Response.json({ bank: null });
  try {
    return Response.json({ bank: JSON.parse(await data.text()) });
  } catch {
    return Response.json({ bank: null });
  }
}

export async function POST(req) {
  if (!checkCode(req)) return unauthorized();
  try {
    const { topicId, questions } = await req.json();
    if (!topicId || !Array.isArray(questions) || !questions.length) {
      return Response.json({ error: "topicId and a non-empty questions array are required" }, { status: 400 });
    }
    const clean = questions.map((q, i) => ({
      id: String(q.id || `q${i + 1}`),
      source: String(q.source || ""),
      type: String(q.type || ""),
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
      stem: String(q.stem || ""),
      options: q.options && typeof q.options === "object" ? q.options : {},
    })).filter((q) => q.stem.length > 5);

    const body = JSON.stringify({ topicId, count: clean.length, questions: clean });
    const { error } = await admin().storage.from("photos")
      .upload(`banks/${topicId}.json`, new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, count: clean.length });
  } catch (e) {
    console.error("BANK POST THREW:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
