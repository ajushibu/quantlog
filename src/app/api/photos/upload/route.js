import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

// Accepts { id, dataUrl } — a compressed JPEG data URL from the client.
export async function POST(req) {
  if (!checkCode(req)) return unauthorized();
  const { id, dataUrl } = await req.json();
  if (!id || !dataUrl?.startsWith("data:image/jpeg;base64,"))
    return Response.json({ error: "bad payload" }, { status: 400 });
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  if (bytes.length > 2 * 1024 * 1024)
    return Response.json({ error: "image too large" }, { status: 413 });
  const { error } = await admin().storage.from("photos")
    .upload(`${id}.jpg`, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
