import { admin } from "@/lib/admin";
import { checkCode, unauthorized } from "@/lib/auth";

/* Two devices editing the same single JSON blob would clobber each other
   (last write wins = silent data loss). So the client stamps every change
   with a timestamp in `meta`, and the server merges field-by-field:
   for each item/flag, the newer timestamp wins. Nothing is lost unless the
   SAME item changed on both devices, where the later change rightly wins. */

function mergeStamped(remote = {}, local = {}, remoteMeta = {}, localMeta = {}) {
  const out = { ...remote };
  const meta = { ...remoteMeta };
  for (const key of Object.keys(local)) {
    const lt = localMeta[key] || 0;
    const rt = remoteMeta[key] || 0;
    if (lt >= rt) { out[key] = local[key]; meta[key] = lt || rt; }
  }
  return [out, meta];
}

function mergeState(remote, local) {
  if (!remote || !Object.keys(remote).length) return local;
  const rMeta = remote.meta || {}, lMeta = local.meta || {};

  const [items, itemsMeta] = mergeStamped(remote.items, local.items, rMeta.items || {}, lMeta.items || {});
  const [flags, flagsMeta] = mergeStamped(remote.flags, local.flags, rMeta.flags || {}, lMeta.flags || {});
  const [celebrated, celebratedMeta] = mergeStamped(remote.celebrated, local.celebrated, rMeta.celebrated || {}, lMeta.celebrated || {});

  // log is append-only: union, de-duplicated
  const seen = new Set();
  const log = [...(remote.log || []), ...(local.log || [])].filter((e) => {
    const k = `${e.date}|${e.type}|${e.seq ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(-2000);

  const newerLocal = (field) => (lMeta[field] || 0) >= (rMeta[field] || 0);

  // mocks: union by id so a mock logged on one device is never lost
  const mockMap = new Map();
  [...(remote.mocks || []), ...(local.mocks || [])].forEach((m) => { if (m && m.id) mockMap.set(m.id, m); });
  const mocks = [...mockMap.values()];

  return {
    items, flags, celebrated, mocks, log,
    settings: (newerLocal("settings") ? local.settings : remote.settings) || local.settings || remote.settings,
    digest: newerLocal("digest") ? (local.digest ?? "") : (remote.digest ?? ""),
    digestDate: newerLocal("digest") ? (local.digestDate ?? "") : (remote.digestDate ?? ""),
    meta: {
      items: itemsMeta, flags: flagsMeta, celebrated: celebratedMeta,
      settings: Math.max(rMeta.settings || 0, lMeta.settings || 0),
      mocks: Math.max(rMeta.mocks || 0, lMeta.mocks || 0),
      digest: Math.max(rMeta.digest || 0, lMeta.digest || 0),
    },
  };
}

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
    const local = body.data ?? {};
    const { data: cur } = await admin().from("app_state").select("data").eq("id", 1).single();
    const merged = mergeState(cur?.data || {}, local);
    const updated_at = new Date().toISOString();
    const { error } = await admin().from("app_state").update({ data: merged, updated_at }).eq("id", 1);
    if (error) { console.error("STATE PUT ERROR:", error); return Response.json({ error: error.message }, { status: 500 }); }
    return Response.json({ ok: true, data: merged, updated_at });
  } catch (e) {
    console.error("STATE PUT THREW:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
