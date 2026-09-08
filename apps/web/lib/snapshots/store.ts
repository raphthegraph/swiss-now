import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
import {
  parseSnapshotId,
  snapshotId,
  type Snapshot,
  type SnapshotMeta,
} from "@swiss-now/core/snapshot";

/** Snapshots newer than this are listed for the timeline. */
export const SNAPSHOT_RETENTION_HOURS = 48;

export interface SnapshotStore {
  latest(): Promise<SnapshotMeta | undefined>;
  list(sinceMs: number): Promise<SnapshotMeta[]>;
  write(snapshot: Snapshot): Promise<SnapshotMeta>;
  read(id: string): Promise<Snapshot | undefined>;
}

/** Local development: `public/snapshots/` (gitignored), served as static files. */
export class FsSnapshotStore implements SnapshotStore {
  constructor(
    private dir: string,
    private publicBase = "/snapshots",
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

/** Vercel Blob (free tier): `snapshots/{id}.json`, public, fixed pathnames. */
export class BlobSnapshotStore implements SnapshotStore {
  constructor(private prefix = "snapshots") {}
  private async all(): Promise<SnapshotMeta[]> {
    const out: SnapshotMeta[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: `${this.prefix}/`,
        limit: 1000,
        ...(cursor ? { cursor } : {}),
      });
      for (const b of page.blobs) {
        const id = b.pathname.slice(this.prefix.length + 1, -5);
        const at = parseSnapshotId(id);
        if (at) out.push({ at: at.toISOString(), url: b.url, bytes: b.size });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out.sort((a, b) => (a.at < b.at ? -1 : 1));
  }
  async latest() {
    const all = await this.all();
    return all[all.length - 1];
  }
  async list(sinceMs: number) {
    return (await this.all()).filter((m) => new Date(m.at).getTime() >= sinceMs);
  }
  async write(snapshot: Snapshot) {
    const id = snapshotId(new Date(snapshot.at));
    const body = JSON.stringify(snapshot);
    const res = await put(`${this.prefix}/${id}.json`, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 31_536_000,
    });
    return { at: snapshot.at, url: res.url, bytes: body.length };
  }
  async read(id: string) {
    const all = await this.all();
    const meta = all.find((m) => snapshotId(new Date(m.at)) === id);
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
