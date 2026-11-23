export const GROUND: Record<number, string> = { 1: 'Turf', 2: 'Dirt' };

export const SEASON: Record<number, string> = {
  1: 'Spring',
  2: 'Summer',
  3: 'Fall',
  4: 'Winter',
  5: 'Cherry Blossom',
};

export const WEATHER: Record<number, string> = { 1: 'Sunny', 2: 'Cloudy', 3: 'Rainy', 4: 'Snowy' };

export const CONDITION: Record<number, string> = { 1: 'Firm', 2: 'Good', 3: 'Soft', 4: 'Heavy' };

export const TURN: Record<number, string> = { 1: 'Right-handed', 2: 'Left-handed', 4: 'Straight' };

export const TRACK: Record<number, string> = {
  10001: 'Sapporo',
  10002: 'Hakodate',
  10003: 'Niigata',
  10004: 'Fukushima',
  10005: 'Nakayama',
  10006: 'Tokyo',
  10007: 'Chukyo',
  10008: 'Kyoto',
  10009: 'Hanshin',
  10010: 'Kokura',
  10101: 'Ooi',
  10103: 'Kawasaki',
  10104: 'Funabashi',
  10105: 'Morioka',
  10201: 'Longchamp',
  10202: 'Santa Anita Park',
  10203: 'Del Mar',
};

export function lookup(map: Record<number, string>, value: number): string {
  return map[value] ?? String(value);
}
