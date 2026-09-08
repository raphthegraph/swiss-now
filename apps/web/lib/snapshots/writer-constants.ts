import { SNAPSHOT_INTERVAL_SECONDS } from "@swiss-now/core/snapshot";
/** Client-safe constant (the writer itself imports Node modules). */
export const SNAPSHOT_PING_MS = SNAPSHOT_INTERVAL_SECONDS * 1000;
