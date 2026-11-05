// Erzeugt die Kartendaten (public/geo/*.json) aus Natural-Earth-Daten (gemeinfrei).
// Alle Koordinaten werden in die Spielprojektion (Lambert, konform, Kegel) in Kilometern umgerechnet,
// damit Telemetrie-Koordinaten später rein linear auf die Karte passen.
//   node scripts/build-geo.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { geoConicConformal, geoPath, geoBounds } from 'd3-geo';
import * as topojson from 'topojson-client';
import { EU, US } from './cities.mjs';

const require = createRequire(import.meta.url);
const load = (p) => JSON.parse(readFileSync(require.resolve(p), 'utf8'));
const R_KM = 6370.997;

const world = load('world-atlas/countries-10m.json');
const land10 = load('world-atlas/land-10m.json');
const states = load('us-atlas/states-10m.json');
const eu50 = load('sane-topojson/dist/europe_50m.json');
const na50 = load('sane-topojson/dist/north-america_50m.json');

const MAPS = {
  ets2: {
    proj: () => geoConicConformal().parallels([37, 65]).rotate([-15, 0]).center([0, 50]).scale(R_KM).translate([0, 0]),
    extent: [[-2700, -2300], [2900, 1900]], region: [[-35, 25], [65, 78]],
    hydro: eu50, cities: EU,
  },
  ats: {
    proj: () => geoConicConformal().parallels([33, 45]).rotate([96, 0]).center([0, 39]).scale(R_KM).translate([0, 0]),
    extent: [[-2700, -1600], [1300, 1300]], region: [[-135, 15], [-60, 62]],
    hydro: na50, cities: US,
  },
};

/** geoPath-Kontext, der kompakte SVG-Pfade schreibt und nahe Punkte ausdünnt */
function recorder(minDist) {
  let out = [], cur = null, last = null, n = 0;
  const f = (v) => Math.round(v * 10) / 10;
  return {
    moveTo(x, y) { cur = [`M${f(x)} ${f(y)}`]; last = [x, y]; n = 1; out.push(cur); },
    lineTo(x, y) {
      if (Math.hypot(x - last[0], y - last[1]) < minDist) return;
      cur.push(`L${f(x)} ${f(y)}`); last = [x, y]; n++;
    },
    closePath() { cur.push('Z'); },
    beginPath() {}, arc() {},
    result() { const r = out.filter((s) => s.length > 2).map((s) => s.join('')).join(''); out = []; return r; },
  };
}

/** Nur Polygone behalten, die die Region berühren (verhindert invertierte Flächen, z. B. durch die Antarktis) */
function regionOnly(fc, [[lon0, lat0], [lon1, lat1]]) {
  const polys = [];
  for (const f of fc.features || [fc]) {
    const g = f.geometry || f;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const c of list) {
      const [[a, b], [c2, d]] = geoBounds({ type: 'Polygon', coordinates: c });
      if (b < -55) continue;                               // Antarktis
      const crossesDateLine = a > c2;
      if (!crossesDateLine && (c2 < lon0 || a > lon1)) continue;
      if (d < lat0 || b > lat1) continue;
      polys.push(c);
    }
  }
  return { type: 'MultiPolygon', coordinates: polys };
}

function render(proj, geo, minDist) {
  const rec = recorder(minDist);
  geoPath(proj, rec)(geo);
  return rec.result();
}

mkdirSync('public/geo', { recursive: true });
for (const [game, m] of Object.entries(MAPS)) {
  const proj = m.proj().clipExtent(m.extent);
  const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
  const layers = {
    land: render(proj, regionOnly(topojson.feature(land10, land10.objects.land), m.region), 4),
    coast: render(proj, topojson.mesh(land10, land10.objects.land), 2.2),
    borders: render(proj, borders, 2.5),
    lakes: render(proj, regionOnly(topojson.feature(m.hydro, m.hydro.objects.lakes), m.region), 1.5),
    rivers: render(proj, topojson.feature(m.hydro, m.hydro.objects.rivers), 2),
  };
  if (game === 'ats') layers.states = render(proj, topojson.mesh(states, states.objects.states, (a, b) => a !== b), 1.5);
  const cities = m.cities.map(([name, lat, lon, rank]) => { const [x, y] = m.proj()([lon, lat]); return [name, Math.round(x * 10) / 10, Math.round(y * 10) / 10, rank]; });
  const data = { game, extent: m.extent, layers, cities, attribution: 'Natural Earth (gemeinfrei)' };
  const json = JSON.stringify(data);
  writeFileSync(`public/geo/${game}.json`, json);
  console.log(game, (json.length / 1024).toFixed(0) + ' KB', Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, (v.length / 1024).toFixed(0) + 'K'])));
}
