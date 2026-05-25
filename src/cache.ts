import { Collection } from 'discord.js';
import { UmaIndex, SkillIndex, CardIndex } from './types';

export const umaCache = new Collection<number, UmaIndex>();
export const skillCache = new Collection<number, SkillIndex>();
export const cardCache = new Collection<number, CardIndex>();
