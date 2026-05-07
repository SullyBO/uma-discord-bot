import { Collection } from 'discord.js';
import { UmaIndex, SkillSummary } from './types';

export const umaCache = new Collection<number, UmaIndex>();
export const skillCache = new Collection<number, SkillSummary>();
