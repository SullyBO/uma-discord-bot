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
  release_date: string;
  is_predicted_date: false;
  skills: UmaSkillEntry[];
}

export interface UmaSummary {
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
  release_date: string;
  is_predicted_date: boolean;
}

export interface SkillSummary {
  id: number;
  name: string;
  category: string;
  rarity: string;
  sp_cost: number;
  is_jp_only: boolean;
}

export interface SkillCondition {
  cond_key: string;
  operator: string;
  cond_val: string;
  is_or: boolean;
}

export interface SkillEffect {
  effect_type: string;
  effect_value: number | null;
}

export interface SkillTrigger {
  id: number;
  effects: SkillEffect[];
  conditions: SkillCondition[];
  preconditions: SkillCondition[];
}

export interface SkillDetail extends SkillSummary {
  triggers: SkillTrigger[];
}

export interface CMRace {
  condition: number;
  distance: number;
  ground: number;
  season: number;
  track: number;
  turn: number;
  weather: number;
}

export interface CM {
  id: number;
  name: string;
  name_en?: string;
  race: CMRace;
  resource_id: number;
  start: number;
  end: number;
}

export interface SkillIndex {
  id: number;
  name: string;
}
