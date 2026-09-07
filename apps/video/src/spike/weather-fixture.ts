import type { WeatherState } from "@swiss-now/core";
import fixture from "../../fixtures/weather-2026-09-07.json";

/** A saved /api/state/weather response — renders are deterministic and network-free for station data. */
export const weatherFixture = fixture as unknown as WeatherState;
