import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

// GET /api/photos/get?id=abc — streams the JPEG back.
export async function GET(req) {
  if (!checkCode(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const { data, error } = await admin().storage.from("photos").download(`${id}.jpg`);
  if (error) return Response.json({ error: error.message }, { status: 404 });
  return new Response(data, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
