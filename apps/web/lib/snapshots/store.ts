import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, head, put } from "@vercel/blob";
import {
  SNAPSHOT_INTERVAL_SECONDS,
  parseSnapshotId,
  snapshotId,
  snapshotSlot,
  type Snapshot,
  type SnapshotMeta,
} from "@swiss-now/core/snapshot";

const SLOT_MS = SNAPSHOT_INTERVAL_SECONDS * 1000;

/** Snapshots newer than this are listed for the timeline. */
export const SNAPSHOT_RETENTION_HOURS = 48;

export interface SnapshotStore {
  latest(): Promise<SnapshotMeta | undefined>;
  list(sinceMs: number): Promise<SnapshotMeta[]>;
  write(snapshot: Snapshot): Promise<SnapshotMeta>;
  read(id: string): Promise<Snapshot | undefined>;
}

/** Local development: `public/snapshots/` (gitignored); served through /api/snapshots/{id} because files written after the build are not static assets. */
export class FsSnapshotStore implements SnapshotStore {
  constructor(
    private dir: string,
    private publicBase = "/api/snapshots",
  ) {}
  private async ids(): Promise<string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
        .filter((id) => parseSnapshotId(id))
        .sort();
    } catch {
      return [];
    }
  }
  async latest() {
    const ids = await this.ids();
    const id = ids[ids.length - 1];
    return id
      ? { at: parseSnapshotId(id)!.toISOString(), url: `${this.publicBase}/${id}.json` }
      : undefined;
  }
  async list(sinceMs: number) {
    const ids = await this.ids();
    const out: SnapshotMeta[] = [];
    for (const id of ids) {
      const at = parseSnapshotId(id)!;
      if (at.getTime() < sinceMs) continue;
      const s = await stat(join(this.dir, `${id}.json`)).catch(() => undefined);
      const meta: SnapshotMeta = { at: at.toISOString(), url: `${this.publicBase}/${id}.json` };
      if (s) meta.bytes = s.size;
      out.push(meta);
    }
    return out;
  }
  async write(snapshot: Snapshot) {
    await mkdir(this.dir, { recursive: true });
    const id = snapshotId(new Date(snapshot.at));
    const body = JSON.stringify(snapshot);
    await writeFile(join(this.dir, `${id}.json`), body);
    return { at: snapshot.at, url: `${this.publicBase}/${id}.json`, bytes: body.length };
  }
  async read(id: string) {
    if (!parseSnapshotId(id)) return undefined;
    try {
      return JSON.parse(await readFile(join(this.dir, `${id}.json`), "utf8")) as Snapshot;
    } catch {
      return undefined;
    }
  }
}

/**
 * Vercel Blob (free tier): `snapshots/{slot}.json`, public, fixed pathnames. Slot ids are
 * deterministic (10-minute UTC), so the store never lists the bucket: `head()` (a cheap simple
 * operation) tells whether a slot exists, an hourly `index.json` carries the 48-hour catalogue, and
 * `del()` (free) prunes what falls out of the window. Hobby includes 10 000 advanced operations
 * (put/list) a month; this design uses ≈ 5 000: one put per slot plus one per hour for the index.
 */
export class BlobSnapshotStore implements SnapshotStore {
  private memo: { at: number; metas: SnapshotMeta[] } | undefined;
  private inflight: Promise<SnapshotMeta[]> | undefined;
  constructor(private prefix = "snapshots") {}
  private pathname(id: string) {
    return `${this.prefix}/${id}.json`;
  }
  private async probe(id: string): Promise<SnapshotMeta | undefined> {
    try {
      const h = await head(this.pathname(id));
      return { at: parseSnapshotId(id)!.toISOString(), url: h.url, bytes: h.size };
    } catch {
      return undefined;
    }
  }
  /** The index blob's content, or nothing when it does not exist yet. */
  private async readIndex(): Promise<{ base: string; slots: SnapshotMeta[] } | undefined> {
    try {
      const h = await head(this.pathname("index"));
      const res = await fetch(h.url, { cache: "no-store" });
      if (!res.ok) return undefined;
      return (await res.json()) as { base: string; slots: SnapshotMeta[] };
    } catch {
      return undefined;
    }
  }
  /** Catalogue of the retention window: the index plus a probe of the slots newer than it. */
  private async catalogue(): Promise<SnapshotMeta[]> {
    if (this.memo && Date.now() - this.memo.at < 60_000) return this.memo.metas;
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const since = Date.now() - SNAPSHOT_RETENTION_HOURS * 3_600_000;
      const index = await this.readIndex();
      const known = new Map<string, SnapshotMeta>();
      for (const m of index?.slots ?? [])
        if (new Date(m.at).getTime() >= since) known.set(snapshotId(new Date(m.at)), m);
      const newest = [...known.keys()].sort().pop();
      const from = newest ? parseSnapshotId(newest)!.getTime() + SLOT_MS : since;
      const now = snapshotSlot(new Date()).getTime();
      const ids: string[] = [];
      for (let t = from; t <= now && ids.length < 12; t += SLOT_MS)
        ids.push(snapshotId(new Date(t)));
      const probed = await Promise.all(ids.map((id) => this.probe(id)));
      for (const m of probed) if (m) known.set(snapshotId(new Date(m.at)), m);
      const metas = [...known.values()].sort((a, b) => (a.at < b.at ? -1 : 1));
      this.memo = { at: Date.now(), metas };
      return metas;
    })().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }
  async latest() {
    const all = await this.catalogue();
    return all[all.length - 1];
  }
  async list(sinceMs: number) {
    return (await this.catalogue()).filter((m) => new Date(m.at).getTime() >= sinceMs);
  }
  async write(snapshot: Snapshot) {
    const at = new Date(snapshot.at);
    const id = snapshotId(at);
    const body = JSON.stringify(snapshot);
    const res = await put(this.pathname(id), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 31_536_000,
    });
    const meta: SnapshotMeta = { at: snapshot.at, url: res.url, bytes: body.length };
    const metas = [...(await this.catalogue()).filter((m) => m.at !== meta.at), meta];
    this.memo = { at: Date.now(), metas };
    // prune the slot that just left the window (deletes are free)
    const expired = snapshotId(new Date(at.getTime() - SNAPSHOT_RETENTION_HOURS * 3_600_000));
    await del(this.pathname(expired)).catch(() => undefined);
    // hourly index so a cold instance needs one read plus a handful of probes
    if (at.getUTCMinutes() === 0 || !(await this.readIndex())) {
      const since = at.getTime() - SNAPSHOT_RETENTION_HOURS * 3_600_000;
      await put(
        this.pathname("index"),
        JSON.stringify({
          base: res.url.slice(0, res.url.length - this.pathname(id).length),
          slots: metas.filter((m) => new Date(m.at).getTime() >= since),
        }),
        {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 60,
        },
      );
    }
    return meta;
  }
  async read(id: string) {
    if (!parseSnapshotId(id)) return undefined;
    const meta =
      (await this.catalogue()).find((m) => snapshotId(new Date(m.at)) === id) ??
      (await this.probe(id));
    if (!meta) return undefined;
    const res = await fetch(meta.url, { next: { revalidate: 31_536_000 } });
    return res.ok ? ((await res.json()) as Snapshot) : undefined;
  }
}

let store: SnapshotStore | undefined;
export function snapshotStore(): SnapshotStore {
  if (!store) {
    store = process.env["BLOB_READ_WRITE_TOKEN"]
      ? new BlobSnapshotStore()
      : new FsSnapshotStore(
          process.env["SNAPSHOT_DIR"] ?? join(process.cwd(), "public", "snapshots"),
        );
  }
  return store;
}
