export interface UmaIndex {
  id: number;
  name: string;
  version: string;
}

export interface UmaSkillEntry {
  id: number;
  name: string;
  category: string;
  rarity: string;
  sp_cost: number;
  acquisition: string;
  evolved_from: number | null;
}

export interface UmaDetail {
  id: number;
  name: string;
  subtitle: string;
  apt_turf: string;
  apt_dirt: string;
  apt_short: string;
  apt_mile: string;
  apt_medium: string;
  apt_long: string;
  apt_front: string;
  apt_pace: string;
  apt_late: string;
  apt_end: string;
  growth_speed: number;
  growth_stamina: number;
  growth_power: number;
  growth_guts: number;
  growth_wit: number;
  skills: UmaSkillEntry[];
}
