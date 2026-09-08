/**
 * Route paths for trains. Switzerland's GTFS ships no shapes.txt, so paths are derived by
 * snapping each pattern's stops onto a rail network graph (SBB "Linie (graphisch)" LineStrings;
 * the BAV network can be merged in later) and routing between consecutive stops.
 * Pure TypeScript; runs in the build CLI, never in the app.
 */
import type { LonLat } from "../../state/common";
import { haversineMeters } from "./geo-lite";

export interface RailGraph {
  /** node coordinates, WGS84 */
  nodes: LonLat[];
  /** adjacency: nodeIndex → array of [neighbourIndex, lengthMeters] */
  adj: Array<Array<[number, number]>>;
  /** spatial grid for nearest-node lookups: cellKey → node indices */
  grid: Map<string, number[]>;
  cellDeg: number;
}

const SNAP_PRECISION = 1e-5; // ≈ 1 m; vertices closer than this merge into one node

function keyOf(lon: number, lat: number): string {
  return `${Math.round(lon / SNAP_PRECISION)}:${Math.round(lat / SNAP_PRECISION)}`;
}

/**
 * Builds an undirected graph from LineString coordinate arrays. Source datasets do not share exact
 * vertices at junctions (SBB and BAV both split into > 200 components at 1 m), so line endpoints are
 * stitched to the nearest node of another line within `stitchMeters`.
 */
export function buildRailGraph(lines: LonLat[][], cellDeg = 0.02, stitchMeters = 40): RailGraph {
  const index = new Map<string, number>();
  const nodes: LonLat[] = [];
  const adj: Array<Array<[number, number]>> = [];
  const grid = new Map<string, number[]>();
  const nodeFor = (p: LonLat): number => {
    const k = keyOf(p[0], p[1]);
    let i = index.get(k);
    if (i === undefined) {
      i = nodes.length;
      index.set(k, i);
      nodes.push(p);
      adj.push([]);
      const g = `${Math.floor(p[0] / cellDeg)}:${Math.floor(p[1] / cellDeg)}`;
      (grid.get(g) ?? grid.set(g, []).get(g)!).push(i);
    }
    return i;
  };
  const endpoints: number[] = [];
  for (const line of lines) {
    let prev = -1;
    let first = -1;
    for (const p of line) {
      const cur = nodeFor(p);
      if (first < 0) first = cur;
      if (prev >= 0 && prev !== cur) {
        const len = haversineMeters(nodes[prev]!, nodes[cur]!);
        adj[prev]!.push([cur, len]);
        adj[cur]!.push([prev, len]);
      }
      prev = cur;
    }
    if (first >= 0) endpoints.push(first);
    if (prev >= 0 && prev !== first) endpoints.push(prev);
  }
  const graph: RailGraph = { nodes, adj, grid, cellDeg };
  if (stitchMeters > 0) stitchEndpoints(graph, endpoints, stitchMeters);
  return graph;
}

/** Connects each line endpoint to the nearest node it is not already adjacent to, within `maxMeters`. */
export function stitchEndpoints(graph: RailGraph, endpoints: number[], maxMeters: number): number {
  let added = 0;
  for (const e of endpoints) {
    const p = graph.nodes[e]!;
    const cx = Math.floor(p[0] / graph.cellDeg);
    const cy = Math.floor(p[1] / graph.cellDeg);
    const neighbours = new Set(graph.adj[e]!.map(([m]) => m));
    let best = -1;
    let bestD = maxMeters;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = graph.grid.get(`${cx + dx}:${cy + dy}`);
        if (!cell) continue;
        for (const i of cell) {
          if (i === e || neighbours.has(i)) continue;
          const d = haversineMeters(p, graph.nodes[i]!);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    if (best >= 0) {
      graph.adj[e]!.push([best, bestD]);
      graph.adj[best]!.push([e, bestD]);
      added++;
    }
  }
  return added;
}

/** Nearest graph node within `maxMeters`, or -1. */
export function nearestNode(graph: RailGraph, p: LonLat, maxMeters = 800): number {
  const cx = Math.floor(p[0] / graph.cellDeg);
  const cy = Math.floor(p[1] / graph.cellDeg);
  let best = -1;
  let bestD = maxMeters;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = graph.grid.get(`${cx + dx}:${cy + dy}`);
      if (!cell) continue;
      for (const i of cell) {
        const d = haversineMeters(p, graph.nodes[i]!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  return best;
}

/** Binary min-heap keyed by f-score. */
class Heap {
  private a: Array<[number, number]> = [];
  get size(): number {
    return this.a.length;
  }
  push(f: number, n: number): void {
    const a = this.a;
    a.push([f, n]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]![0] <= a[i]![0]) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]![0] < a[m]![0]) m = l;
        if (r < a.length && a[r]![0] < a[m]![0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** A* shortest path between two nodes; returns node indices or undefined when disconnected. */
export function shortestPath(
  graph: RailGraph,
  from: number,
  to: number,
  maxMeters = 400_000,
): number[] | undefined {
  if (from === to) return [from];
  const goal = graph.nodes[to]!;
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  const heap = new Heap();
  heap.push(haversineMeters(graph.nodes[from]!, goal), from);
  const closed = new Set<number>();
  while (heap.size) {
    const [, n] = heap.pop()!;
    if (n === to) {
      const path = [to];
      let c = to;
      while (came.has(c)) {
        c = came.get(c)!;
        path.push(c);
      }
      return path.reverse();
    }
    if (closed.has(n)) continue;
    closed.add(n);
    const gn = g.get(n)!;
    if (gn > maxMeters) return undefined;
    for (const [m, len] of graph.adj[n]!) {
      const tentative = gn + len;
      if (tentative < (g.get(m) ?? Infinity)) {
        g.set(m, tentative);
        came.set(m, n);
        heap.push(tentative + haversineMeters(graph.nodes[m]!, goal), m);
      }
    }
  }
  return undefined;
}

export interface PatternPath {
  patternId: string;
  coordinates: LonLat[];
  /** cumulative distance in metres at each stop of the pattern */
  stopDistances: number[];
  /** how each leg was derived: "network" (routed on rail lines) or "straight" (fallback) */
  legKinds: Array<"network" | "straight">;
  lengthMeters: number;
}

/**
 * Builds the path of one pattern: stop → nearest node → routed legs; legs without a route fall
 * back to a straight line so every pattern has a usable path, flagged honestly.
 */
export function buildPatternPath(
  graph: RailGraph,
  patternId: string,
  stops: LonLat[],
  cache: Map<string, number[] | undefined> = new Map(),
): PatternPath {
  const coords: LonLat[] = [];
  const stopDistances: number[] = [];
  const legKinds: PatternPath["legKinds"] = [];
  let dist = 0;
  const push = (p: LonLat) => {
    const last = coords[coords.length - 1];
    if (last) {
      const d = haversineMeters(last, p);
      if (d < 1) return; // a stop snapped onto its own node: skip the duplicate vertex
      dist += d;
    }
    coords.push(p);
  };
  push(stops[0]!);
  stopDistances.push(0);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const na = nearestNode(graph, a);
    const nb = nearestNode(graph, b);
    let legNodes: number[] | undefined;
    if (na >= 0 && nb >= 0) {
      const key = na < nb ? `${na}-${nb}` : `${nb}-${na}`;
      if (!cache.has(key)) cache.set(key, shortestPath(graph, na, nb));
      legNodes = cache.get(key);
      if (legNodes && legNodes[0] !== na) legNodes = [...legNodes].reverse();
    }
    if (legNodes && legNodes.length > 1) {
      for (const n of legNodes) push(graph.nodes[n]!);
      legKinds.push("network");
    } else {
      legKinds.push("straight");
    }
    push(b);
    stopDistances.push(dist);
  }
  return { patternId, coordinates: coords, stopDistances, legKinds, lengthMeters: dist };
}

/** Perpendicular distance (metres, equirectangular) from p to segment ab. */
function segmentDistance(p: LonLat, a: LonLat, b: LonLat): number {
  const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 111_320;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/**
 * Douglas–Peucker simplification that never removes the vertices at `keepIndices` (the stops),
 * so stop distances stay exact after simplification.
 */
export function simplifyPath(
  coords: LonLat[],
  toleranceMeters: number,
  keepIndices: number[] = [],
): LonLat[] {
  if (coords.length <= 2) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  for (const i of keepIndices) if (i >= 0 && i < coords.length) keep[i] = 1;
  const stack: Array<[number, number]> = [];
  // seed segments between consecutive kept vertices
  let prev = 0;
  for (let i = 1; i < coords.length; i++) {
    if (keep[i]) {
      stack.push([prev, i]);
      prev = i;
    }
  }
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e - s < 2) continue;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistance(coords[i]!, coords[s]!, coords[e]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceMeters && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: LonLat[] = [];
  for (let i = 0; i < coords.length; i++) if (keep[i]) out.push(coords[i]!);
  return out;
}
