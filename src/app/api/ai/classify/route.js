import { checkCode, unauthorized } from "@/lib/auth";
import { CLASSIFY_LIST, ITEM_BY_ID } from "@/lib/syllabus";

const MODEL = "claude-fable-5";

export async function POST(req) {
  if (!checkCode(req)) return unauthorized();
  const { text, imageDataUrl } = await req.json();
  const list = CLASSIFY_LIST.map((c) => `${c.id} = ${c.sectionName}: ${c.name}${c.kind === "s" ? " (practice set)" : ""}`).join("\n");
  const content = [];
  if (imageDataUrl?.startsWith("data:image/jpeg;base64,"))
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageDataUrl.split(",")[1] } });
  content.push({
    type: "text",
    text: `Classify this CAT quant struggle/question into ONE item from the syllabus. Prefer a class over a practice set when both fit.\n${list}\nother = doesn't fit any\n\n${text ? `Student's note: """${text}"""` : "Classify the question in the image."}\n\nRespond ONLY with JSON, no fences: {"itemId":"<id>"}`,
  });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) return Response.json({ error: `anthropic ${res.status}` }, { status: 502 });
  const data = await res.json();
  try {
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
    return Response.json({ itemId: ITEM_BY_ID[parsed.itemId] ? parsed.itemId : "other" });
  } catch {
    return Response.json({ itemId: "other" });
  }
}
