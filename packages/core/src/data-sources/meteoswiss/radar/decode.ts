/**
 * ODIM HDF5 → rain-rate grid. Verified against live RZC/CPC files (2026-09-08):
 * `/dataset1/data1/data` float64 [640 rows × 710 cols], mm/h (RZC) or mm (CPC 60-min),
 * `gain 1, offset 0, undetect 0, nodata null`; `/where` carries corner lon/lat, `xsize/ysize`,
 * `xscale/yscale` (1000 m) and the LV95 `projdef`. Row 0 is the northern edge.
 */
import h5wasm from "h5wasm/node";

export interface RadarGrid {
  width: number;
  height: number;
  /** row-major, row 0 = north; NaN = no data */
  values: Float32Array;
  unit: string;
  quantity: string;
  /** LV95 easting of the western edge and northing of the northern edge, metres */
  originEast: number;
  originNorth: number;
  cellMeters: number;
  startTime: string;
  endTime: string;
  product: string;
}

type H5Module = Awaited<typeof h5wasm.ready>;
let ready: Promise<H5Module> | undefined;
async function lib(): Promise<H5Module> {
  if (!ready) ready = h5wasm.ready;
  return ready;
}

const num = (v: unknown): number => (typeof v === "bigint" ? Number(v) : Number(v));
const attrs = (obj: { attrs: Record<string, { value: unknown }> }): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj.attrs).map(([k, a]) => [k, a.value]));

/** Decodes one ODIM HDF5 composite. Pure CPU; ~10–30 ms for a 640×710 grid. */
export async function decodeOdimComposite(bytes: Uint8Array): Promise<RadarGrid> {
  const { FS } = await lib();
  const path = `/tmp/swiss-now-${Math.random().toString(36).slice(2)}.h5`;
  FS.writeFile(path, bytes);
  const file = new h5wasm.File(path, "r");
  try {
    const where = attrs(file.get("/where") as never);
    const dataWhat = attrs(file.get("/dataset1/data1/what") as never);
    const what = attrs(file.get("/dataset1/what") as never);
    const dataset = file.get("/dataset1/data1/data") as {
      value: ArrayLike<number>;
      shape: number[];
    };
    const [height, width] = dataset.shape as [number, number];
    const gain = dataWhat["gain"] === undefined ? 1 : num(dataWhat["gain"]);
    const offset = dataWhat["offset"] === undefined ? 0 : num(dataWhat["offset"]);
    const nodata =
      dataWhat["nodata"] === null || dataWhat["nodata"] === undefined
        ? undefined
        : num(dataWhat["nodata"]);
    const raw = dataset.value;
    const values = new Float32Array(width * height);
    for (let i = 0; i < values.length; i++) {
      const v = raw[i] as number;
      values[i] = v === undefined || Number.isNaN(v) || v === nodata ? NaN : v * gain + offset;
    }
    const origin = gridOrigin(where);
    return {
      width,
      height,
      values,
      unit: String(dataWhat["unit"] ?? (dataWhat["quantity"] === "ACRR" ? "mm" : "mm/h")),
      quantity: String(dataWhat["quantity"] ?? "RATE"),
      originEast: origin.east,
      originNorth: origin.north,
      cellMeters: num(where["xscale"] ?? 1000),
      startTime: odimTime(String(what["startdate"]), String(what["starttime"])),
      endTime: odimTime(String(what["enddate"]), String(what["endtime"])),
      product: String(what["prodname"] ?? ""),
    };
  } finally {
    file.close();
    try {
      FS.unlink(path);
    } catch {
      // ignore
    }
  }
}

/**
 * The Swiss composite grid is fixed: 710 × 640 km at 1 km, LV95 easting 2 255 000 → 2 965 000,
 * northing 840 000 → 1 480 000. We still derive it from `/where` when present so a future grid
 * change fails loudly in tests rather than silently misplacing rain.
 */
export function gridOrigin(where: Record<string, unknown>): { east: number; north: number } {
  const xsize = num(where["xsize"] ?? 710);
  const ysize = num(where["ysize"] ?? 640);
  const xscale = num(where["xscale"] ?? 1000);
  const yscale = num(where["yscale"] ?? 1000);
  if (xsize !== 710 || ysize !== 640 || xscale !== 1000 || yscale !== 1000) {
    throw new Error(`unexpected radar grid ${xsize}×${ysize} @ ${xscale}×${yscale} m`);
  }
  return { east: 2_255_000, north: 1_480_000 };
}

function odimTime(date: string, time: string): string {
  if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(time)) return new Date(0).toISOString();
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
}
