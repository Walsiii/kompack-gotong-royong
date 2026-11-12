import type { StyleSpecification } from 'maplibre-gl'

/** Ubin vektor OpenStreetMap gratis tanpa API key (skema OpenMapTiles) */
export const VECTOR_URL = 'https://tiles.openfreemap.org/planet'
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
/** cadangan bila server vektor tidak terjangkau */
export const RASTER_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const MINOR = ['minor', 'service', 'track']
const MID = ['secondary', 'tertiary']
const MAJOR = ['motorway', 'trunk', 'primary']

type Expr = unknown[]
const w = (z14: number, z18: number): Expr => ['interpolate', ['exponential', 1.6], ['zoom'], 14, z14, 18, z18]
/** lebar jalan menurut kelas — "zoom" harus di tingkat teratas ekspresi */
const byClass = (major: [number, number], mid: [number, number], minor: [number, number]): Expr => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  14,
  ['match', ['get', 'class'], MAJOR, major[0], MID, mid[0], minor[0]],
  18,
  ['match', ['get', 'class'], MAJOR, major[1], MID, mid[1], minor[1]],
]

/** MapLibre needs resolved colours, rather than CSS var() expressions. */
export function mapPalette() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(`--color-${name}`).trim() || css.getPropertyValue(`--color-${fallback}`).trim()
  return {
    ground: read('map-land', 'paper'),
    land: read('paper', 'paper'),
    light: read('card', 'paper'),
    edge: read('line', 'ink-3'),
    building: read('map-building', 'line'),
    water: read('map-water', 'line'),
    green: read('map-green', 'paper'),
    muted: read('ink-3', 'ink'),
    ink: read('ink', 'ink'),
    text: read('ink-2', 'ink'),
    accent: read('rompi', 'ink'),
    soft: read('accent-soft', 'paper'),
    bad: read('bad', 'ink'),
    gps: read('gps', 'ink'),
    major: read('map-major', 'card'),
    majorEdge: read('map-major-edge', 'line'),
    road: read('map-road', 'card'),
  }
}

/** Neutral streets let category symbols and the selected mission lead. */
export function kompackStyle(): StyleSpecification {
  const c = mapPalette()
  const style = {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      ofm: { type: 'vector', url: VECTOR_URL, attribution: '© OpenStreetMap · OpenFreeMap' },
    },
    light: { anchor: 'viewport', color: c.light, intensity: 0.32, position: [1.4, 200, 40] },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.ground } },
      {
        id: 'landuse',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landuse',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            ['residential', 'suburb', 'neighbourhood'],
            c.land,
            ['school', 'university', 'college', 'hospital'],
            c.ground,
            ['cemetery'],
            c.soft,
            c.land,
          ],
        },
      },
      {
        id: 'green',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland', 'wetland']]],
        paint: { 'fill-color': c.green, 'fill-opacity': 0.85 },
      },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': c.green } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': c.water } },
      {
        id: 'waterway',
        type: 'line',
        source: 'ofm',
        'source-layer': 'waterway',
        paint: { 'line-color': c.muted, 'line-width': w(0.8, 4) },
      },
      {
        id: 'path',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 15,
        filter: ['==', ['get', 'class'], 'path'],
        paint: { 'line-color': c.edge, 'line-width': w(0.6, 2), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'road-case',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', [...MINOR, ...MID, ...MAJOR]]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'class'], MAJOR, c.majorEdge, c.edge],
          'line-width': byClass([5, 30], [4, 24], [2.4, 15]),
        },
      },
      {
        id: 'road',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', [...MINOR, ...MID, ...MAJOR]]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'class'], MAJOR, c.major, c.road],
          'line-width': byClass([3.6, 26], [2.8, 20], [1.4, 12]),
        },
      },
      {
        // gedung datar seperti Google Maps (tanpa 3D)
        id: 'building',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'building',
        minzoom: 14.5,
        paint: { 'fill-color': c.building, 'fill-outline-color': c.edge, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 1] },
      },
      {
        id: 'street-name',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'transportation_name',
        minzoom: 15,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 13],
          'text-max-angle': 30,
        },
        paint: { 'text-color': c.text, 'text-halo-color': c.light, 'text-halo-width': 1.6 },
      },
      {
        id: 'poi',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'poi',
        minzoom: 16,
        filter: ['in', ['get', 'class'], ['literal', ['place_of_worship', 'school', 'college', 'hospital', 'park', 'grocery', 'shop']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10.5,
          'text-max-width': 8,
        },
        paint: { 'text-color': c.text, 'text-halo-color': c.light, 'text-halo-width': 1.4 },
      },
      {
        id: 'place',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-letter-spacing': 0,
        },
        paint: { 'text-color': c.muted, 'text-halo-color': c.light, 'text-halo-width': 1.4 },
      },
    ],
  }
  return style as unknown as StyleSpecification
}
