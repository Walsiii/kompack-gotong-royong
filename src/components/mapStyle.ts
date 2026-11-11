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

/**
 * Gaya peta Kompack!: tanah abu kehijauan, jalan putih bersih, gedung 3D berwarna genteng pucat,
 * label dipangkas supaya penanda quest jadi pusat perhatian.
 */
export function kompackStyle(): StyleSpecification {
  const style = {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      ofm: { type: 'vector', url: VECTOR_URL, attribution: '© OpenStreetMap · OpenFreeMap' },
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.4, 200, 40] },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#E6E9E2' } },
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
            '#E0E3DA',
            ['school', 'university', 'college', 'hospital'],
            '#E6E0D3',
            ['cemetery'],
            '#D6E0CF',
            '#E3E6DE',
          ],
        },
      },
      {
        id: 'green',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland', 'wetland']]],
        paint: { 'fill-color': '#CADDC1', 'fill-opacity': 0.85 },
      },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': '#C6DBBE' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#AFCFD8' } },
      {
        id: 'waterway',
        type: 'line',
        source: 'ofm',
        'source-layer': 'waterway',
        paint: { 'line-color': '#A3C6D0', 'line-width': w(0.8, 4) },
      },
      {
        id: 'path',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 15,
        filter: ['==', ['get', 'class'], 'path'],
        paint: { 'line-color': '#C3CBC2', 'line-width': w(0.6, 2), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'road-case',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', [...MINOR, ...MID, ...MAJOR]]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#CDD3CB',
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
          'line-color': ['match', ['get', 'class'], MAJOR, '#FFF4E3', '#FFFFFF'],
          'line-width': byClass([3.6, 26], [2.8, 20], [1.4, 12]),
        },
      },
      {
        id: 'building',
        type: 'fill-extrusion',
        source: 'ofm',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 6],
            0,
            '#ECDCD2',
            10,
            '#E6CDBE',
            30,
            '#DCC3B5',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
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
        paint: { 'text-color': '#5E6C64', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 },
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
        paint: { 'text-color': '#7A877F', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 },
      },
      {
        id: 'place',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']]],
        layout: {
          'text-field': ['upcase', ['coalesce', ['get', 'name:latin'], ['get', 'name']]],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-letter-spacing': 0.12,
        },
        paint: { 'text-color': '#8E9A93', 'text-halo-color': '#F3F5F1', 'text-halo-width': 1.4 },
      },
    ],
  }
  return style as unknown as StyleSpecification
}
