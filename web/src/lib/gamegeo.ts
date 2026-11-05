/**
 * Umrechnung Spielkoordinaten (Telemetrie: placement.x / placement.z, Meter)
 * -> Kartenkoordinaten in km der Spielprojektion (Lambert, konform, Kegel).
 *
 * Die Spielwelten von SCS sind selbst in dieser Projektion angelegt; die Faktoren
 * rechnen Spieleinheiten in Bogengrad um (Kartenmaßstab ~1:19 bzw. ~1:20).
 */
const R_KM = 6370.997;
const DEG = Math.PI / 180;

const ETS2 = { fx: 0.0001729241463 * DEG * R_KM, fz: 0.000171570875 * DEG * R_KM, ox: 16660, oz: 4150 };
const ATS = { fx: 0.000176689948 * DEG * R_KM, fz: 0.00017706234 * DEG * R_KM, ox: 0, oz: 0 };
// Großbritannien ist im Spiel um Calais herum vergrößert dargestellt
const CALAIS = { x: -31100, z: -5500 }, UK_SCALE = 0.75;

export type Game = 'ets2' | 'ats';

export function gameToMap(game: Game, x: number, z: number): [number, number] {
  if (game === 'ats') return [(x - ATS.ox) * ATS.fx, (z - ATS.oz) * ATS.fz];
  if (x < CALAIS.x && z < CALAIS.z) { x = CALAIS.x + (x - CALAIS.x) * UK_SCALE; z = CALAIS.z + (z - CALAIS.z) * UK_SCALE; }
  return [(x - ETS2.ox) * ETS2.fx, (z - ETS2.oz) * ETS2.fz];
}

// Englische / lokale Stadtnamen aus dem Spiel -> Namen in unserer Städteliste
const ALIAS: Record<string, string> = {
  munich: 'München', munchen: 'München', prague: 'Prag', praha: 'Prag', vienna: 'Wien', warsaw: 'Warschau', warszawa: 'Warschau', cologne: 'Köln', koln: 'Köln',
  nuremberg: 'Nürnberg', nurnberg: 'Nürnberg', brussels: 'Brüssel', bruxelles: 'Brüssel', copenhagen: 'Kopenhagen', kobenhavn: 'Kopenhagen', lisbon: 'Lissabon', lisboa: 'Lissabon',
  rome: 'Rom', roma: 'Rom', milan: 'Mailand', milano: 'Mailand', turin: 'Turin', torino: 'Turin', venice: 'Venedig', venezia: 'Venedig', genoa: 'Genua', genova: 'Genua',
  naples: 'Neapel', napoli: 'Neapel', florence: 'Florenz', firenze: 'Florenz', gothenburg: 'Göteborg', goteborg: 'Göteborg', athens: 'Athen', athina: 'Athen',
  belgrade: 'Belgrad', beograd: 'Belgrad', bucharest: 'Bukarest', bucuresti: 'Bukarest', krakow: 'Krakau', cracow: 'Krakau', gdansk: 'Danzig', poznan: 'Posen',
  wroclaw: 'Breslau', szczecin: 'Stettin', katowice: 'Kattowitz', brno: 'Brünn', plzen: 'Pilsen', liege: 'Lüttich', strasbourg: 'Straßburg', nice: 'Nizza',
  zurich: 'Zürich', geneva: 'Genf', geneve: 'Genf', luxembourg: 'Luxemburg', 'saint petersburg': 'Sankt Petersburg', 'st. petersburg': 'Sankt Petersburg',
  pskov: 'Pskow', plovdiv: 'Plowdiw', varna: 'Warna', ruse: 'Russe', zaragoza: 'Saragossa', seville: 'Sevilla', taranto: 'Tarent', patra: 'Patras', thessaloniki: 'Thessaloniki',
  lodz: 'Łódź', bialystok: 'Białystok', gyor: 'Győr', pecs: 'Pécs', kosice: 'Košice', malmo: 'Malmö', orebro: 'Örebro', jonkoping: 'Jönköping', vasteras: 'Västerås', umea: 'Umeå', lulea: 'Luleå',
};
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();

export function findCity(cities: any[], name?: string) {
  if (!name) return null;
  const n = norm(name);
  const target = ALIAS[n] ? norm(ALIAS[n]) : n;
  return cities.find((c) => norm(c[0]) === target) || null;
}
