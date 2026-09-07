import { z } from "zod";

/** Every external source Swiss Now may read from. Adapter folders are named after these ids. */
export const SourceId = z.enum([
  "meteoswiss-smn",
  "meteoswiss-radar",
  "meteoswiss-forecast",
  "geoadmin-messwerte",
  "geoadmin-hydroweb",
  "bafu-lindas-hydro",
  "sed-fdsn",
  "otd-gtfs-static",
  "otd-gtfs-rt",
  "otd-siri-sx",
  "sbb-line-geometry",
  "sbb-rail-traffic-info",
  "bav-rail-network",
  "fedro-datex2",
  "slf-imis",
  "slf-bulletin",
  "bafu-fire-danger",
  "entsoe",
  "sfoe-energy-dashboard",
  "sharedmobility",
  "swisstopo",
  "bfs",
]);
export type SourceId = z.infer<typeof SourceId>;
