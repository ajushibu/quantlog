// Shared-secret auth. The client sends the code in the x-access-code header.
// Constant-time compare to avoid trivial timing leaks.
import crypto from "crypto";

export function checkCode(req) {
  const given = req.headers.get("x-access-code") || "";
  const expected = process.env.ACCESS_CODE || "";
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });
