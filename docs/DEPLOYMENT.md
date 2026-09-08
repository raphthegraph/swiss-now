# Deployment

Swiss Now runs on Vercel Hobby (free tier, personal and non-commercial use; see
`FREE_TIER_ARCHITECTURE.md` for the limits and the upgrade path). The project `swiss-now` is linked
to `raphthegraph/swiss-now`; every push to `main` builds `apps/web` and becomes the production
deployment. Configuration lives in the repository:

| File                             | Purpose                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web/vercel.json`           | Next.js, region `fra1`, install and build pinned to pnpm 10.15.0 through `npx` (honours the lockfile) |
| `apps/web/next.config.ts`        | traces the vote files and the municipality register into the handlers that read them from disk        |
| `.github/workflows/snapshot.yml` | POST `/api/snapshot` every 10 minutes on the URL in the repository variable `SWISS_NOW_URL`           |
| `.github/workflows/gtfs.yml`     | rail data build (Mon/Thu), published to the `rail-data` branch that GitHub Pages serves               |
| `.github/workflows/data.yml`     | weekly statistics build, committed to `main`                                                          |

Production URL: https://swiss-now.vercel.app

## What works without any secret

Weather, water, quakes, energy, events, air, hazards, politics and the statistics topics: their
sources need no key, and the static files ship with the build. The Today page and the story
render from whatever snapshots exist.

## Secrets and stores (set once, in the dashboards)

These steps need account credentials and are done by the owner, not by tooling:

1. **Blob store.** Vercel dashboard → Storage → Create → Blob → connect it to `swiss-now`. This adds
   `BLOB_READ_WRITE_TOKEN` to the project's environments. Redeploy (Deployments → ⋯ → Redeploy). From
   then on `/api/snapshot` writes to Blob (`snapshots/<id>.json`) and the timeline and story fill up.
2. **Rail.** Project → Settings → Environment Variables → add `OTD_API_KEY` (the "Token" field of
   the application on api-manager.opentransportdata.swiss, a JWT starting with `eyJ`; not the
   "Token Hash") for Production, and `RAIL_DATA_URL` = `https://raphthegraph.github.io/swiss-now`.
   Redeploy. The rail files themselves live on GitHub Pages: the **Rail data build** workflow writes
   them to the orphan branch `rail-data` twice a week, and Pages serves that branch. No secret is
   needed for this; Blob is not involved, so its small operations quota stays for the snapshots.
3. **Snapshot ping.** The repository variable `SWISS_NOW_URL` names the production URL; the ping
   workflow is active once it is set (`gh variable set SWISS_NOW_URL --body <url>`). Without Blob
   the write fails with 500 on Vercel's read-only filesystem; the workflow still reports success and
   prints the response.
4. **Static data on Blob** (optional, later): upload `apps/web/public/data` to the store and set
   `DATA_BASE_URL` and `NEXT_PUBLIC_DATA_BASE_URL` to `https://<store-id>.public.blob.vercel-storage.com/data`.
   Until then the files are served from the build.

## Free-tier budget

Vercel Hobby never bills; a feature that exceeds its quota is paused for 30 days. The tight one
is Blob: 10 000 advanced operations (uploads and listings) per month. The snapshot store therefore
never lists the bucket — slot names are deterministic, existence is a cheap head request, an
hourly index carries the catalogue, and deletes (free) keep the store at 48 hours ≈ 100 MB. Budget
≈ 4 300 snapshot uploads + 720 index uploads a month. The rail files (≈ 9 000 per build) would
have used the whole quota in one upload, which is why they are served from GitHub Pages instead.

## Checks after a deployment

```bash
curl -s https://swiss-now.vercel.app/api/state/weather | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" https://swiss-now.vercel.app/api/state/aviation   # 451 while gated
```

`/status` lists every source with its freshness. Build and runtime logs: Vercel dashboard →
Deployments → the deployment → Logs (one hour retention on Hobby).
