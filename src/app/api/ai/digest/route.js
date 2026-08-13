import { checkCode, unauthorized } from "@/lib/auth";

const MODEL = "claude-fable-5";

// The client sends a pre-computed stats summary; the server only prompts.
export async function POST(req) {
  if (!checkCode(req)) return unauthorized();
  const { summary } = await req.json();
  if (!summary || summary.length > 4000) return Response.json({ error: "bad summary" }, { status: 400 });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 300,
      messages: [{ role: "user", content: `Summarize a CAT aspirant's study week for her partner in EXACTLY 3 short plain sentences: what got done, where struggles clustered, one concrete suggestion. Honest, not cheerleading. No emoji.\n\n${summary}` }],
    }),
  });
  if (!res.ok) return Response.json({ error: `anthropic ${res.status}` }, { status: 502 });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return Response.json({ digest: text });
}
