import type { LonLat } from "@swiss-now/core";
import { projectOnPlate, easeHouse, clamp01 } from "@swiss-now/motion/math";
import { fontFamily, ground, layerAccent } from "@swiss-now/motion/tokens";
import { formatNumber } from "@swiss-now/motion";
import type { PlateCamera } from "./FixedMapPlate";

const ANCHORS: Record<string, { outside: LonLat; inside: LonLat }> = {
  DE: { outside: [8.55, 47.95], inside: [8.55, 47.58] },
  FR: { outside: [6.05, 46.95], inside: [6.55, 46.95] },
  AT: { outside: [9.85, 47.2], inside: [9.4, 47.2] },
  IT: { outside: [8.95, 45.75], inside: [8.95, 46.12] },
};

export interface FlowMarksProps {
  borderFlows: Record<string, number>;
  plate: PlateCamera;
  plateW: number;
  plateH: number;
  scale: number;
  tx: number;
  ty: number;
  localFrame: number;
  fps: number;
  width: number;
  height: number;
}

/** The energy chapter: border arrows drawn in frame space, width from the megawatts, dashes flowing with the frame. */
export function FlowMarks(p: FlowMarksProps) {
  const { borderFlows, plate, plateW, plateH, scale, tx, ty, localFrame, fps, width, height } = p;
  const a = easeHouse(clamp01(localFrame / (fps * 0.6)));
  const toFrame = (ll: LonLat) => {
    const q = projectOnPlate(ll, plate.center, plate.zoom, plateW, plateH);
    return { x: q.x * scale + tx, y: q.y * scale + ty };
  };
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0 }}
      opacity={a}
    >
      {Object.entries(borderFlows).map(([code, mw]) => {
        const an = ANCHORS[code];
        if (!an || !Number.isFinite(mw) || Math.abs(mw) < 1) return null;
        const imp = mw >= 0;
        const from = toFrame(imp ? an.outside : an.inside);
        const to = toFrame(imp ? an.inside : an.outside);
        const w = Math.max(4, (Math.min(Math.abs(mw), 3000) / 3000) * 26);
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        const head = w * 1.3 + 10;
        const tip = { x: to.x, y: to.y };
        const label = `${code} ${imp ? "→" : "←"} ${formatNumber(Math.abs(mw), 0)} MW`;
        const lpRaw = toFrame(an.outside);
        const half = label.length * 26 * 0.3;
        const lp = { x: Math.min(Math.max(lpRaw.x, half + 24), width - half - 24), y: lpRaw.y };
        return (
          <g key={code}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x - Math.cos(ang) * head * 0.6}
              y2={to.y - Math.sin(ang) * head * 0.6}
              stroke={layerAccent.energy}
              strokeWidth={w}
              strokeLinecap="round"
              strokeDasharray={`${w * 1.6} ${w * 1.2}`}
              strokeDashoffset={
                -((localFrame / fps) * (20 + (Math.min(Math.abs(mw), 3000) / 3000) * 60))
              }
              opacity={0.9}
            />
            <polygon
              points={`${tip.x + Math.cos(ang) * head * 0.6},${tip.y + Math.sin(ang) * head * 0.6} ${tip.x + Math.cos(ang + 2.5) * head},${tip.y + Math.sin(ang + 2.5) * head} ${tip.x + Math.cos(ang - 2.5) * head},${tip.y + Math.sin(ang - 2.5) * head}`}
              fill={layerAccent.energy}
            />
            <text
              x={lp.x}
              y={code === "IT" ? lp.y + 40 : lp.y - 22}
              textAnchor="middle"
              fontFamily={fontFamily.sans}
              fontSize={26}
              fontWeight={500}
              fill={ground.ink}
              stroke={ground.paper}
              strokeWidth={6}
              strokeLinejoin="round"
              style={{ paintOrder: "stroke" }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
