"use client";
const CODE_KEY = "quantlog_code";

export const getCode = () => (typeof window !== "undefined" ? localStorage.getItem(CODE_KEY) : null);
export const setCode = (c) => localStorage.setItem(CODE_KEY, c);
export const clearCode = () => localStorage.removeItem(CODE_KEY);

async function call(path, opts = {}) {
  const code = getCode();
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-access-code": code || "", ...(opts.headers || {}) },
  });
  if (res.status === 401) { clearCode(); const e = new Error("unauthorized"); e.code = 401; throw e; }
  if (!res.ok) { const e = new Error(`request failed ${res.status}`); e.code = res.status; throw e; }
  return res.json();
}

export const api = {
  getState: () => call("/api/state"),
  putState: (data) => call("/api/state", { method: "PUT", body: JSON.stringify({ data }) }),
  listStruggles: () => call("/api/struggles"),
  createStruggle: (s) => call("/api/struggles", { method: "POST", body: JSON.stringify(s) }),
  patchStruggle: (id, patch) => call("/api/struggles", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),
  uploadPhoto: (id, dataUrl) => call("/api/photos/upload", { method: "POST", body: JSON.stringify({ id, dataUrl }) }),
  classify: (payload) => call("/api/ai/classify", { method: "POST", body: JSON.stringify(payload) }),
  digest: (summary) => call("/api/ai/digest", { method: "POST", body: JSON.stringify({ summary }) }),
  listBanks: () => call("/api/banks"),
  getBank: (topic) => call(`/api/banks?topic=${encodeURIComponent(topic)}`),
  putBank: (topicId, questions) => call("/api/banks", { method: "POST", body: JSON.stringify({ topicId, questions }) }),
};

// <img> can't send custom headers, so fetch protected photos as a blob
// and hand back an object URL. Caller is responsible for revoking it.
export async function fetchPhotoUrl(id) {
  const code = getCode();
  const res = await fetch(`/api/photos/get?id=${encodeURIComponent(id)}`, { headers: { "x-access-code": code || "" } });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
