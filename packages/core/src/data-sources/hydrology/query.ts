/**
 * BAFU hydrology via LINDAS (verified 2026-09-07/08): graph <https://lindas.admin.ch/foen/hydro>,
 * one current observation per station (200 rivers + 34 lakes), updated every 10 minutes,
 * `measurementTime` with a fixed +01:00 offset (correct as an instant), Open-Use terms.
 * `http://example.com/isLiter` is `true` on every discharge row while values are plainly m³/s
 * (Rhine at Basel ≈ 500) → the flag is ignored. Danger level is 1–5 or `cube:Undefined`.
 */
export const LINDAS_ENDPOINT = "https://ld.admin.ch/query";

export const HYDRO_CURRENT_QUERY = `
PREFIX hydro: <https://environment.ld.admin.ch/foen/hydro/dimension/>
PREFIX schema: <http://schema.org/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?station ?name ?identifier ?type ?waterBody ?wkt ?t ?level ?discharge ?temp ?danger WHERE {
  GRAPH <https://lindas.admin.ch/foen/hydro> {
    ?obs a <https://cube.link/Observation> ;
      hydro:station ?station ;
      hydro:measurementTime ?t ;
      hydro:dangerLevel ?danger .
    OPTIONAL { ?obs hydro:waterLevel ?level }
    OPTIONAL { ?obs hydro:discharge ?discharge }
    OPTIONAL { ?obs hydro:waterTemperature ?temp }
    ?station schema:name ?name ;
             schema:identifier ?identifier ;
             geo:hasGeometry/geo:asWKT ?wkt .
    OPTIONAL { ?station schema:containedInPlace ?wb . ?wb schema:name ?waterBody }
    BIND(IF(CONTAINS(STR(?obs), "/river/"), "river", "lake") AS ?type)
  }
}`.trim();
