import { umaDetailSchema } from '../tests/schemas/umaDetail.schema';
import { umaIndexSchema } from '../tests/schemas/umaIndex.schema';
import { umaSummarySchema } from '../tests/schemas/umaSummary.schema';
import { skillSummarySchema } from '../tests/schemas/skillSummary.schema';
import { skillDetailSchema } from '../tests/schemas/skillDetail.schema';
import { skillIndexSchema } from '../tests/schemas/skillIndex.schema';
import { UmaDetail, UmaIndex, UmaSummary, SkillSummary, SkillDetail, SkillIndex } from '../types';
import { logRequest } from '../utils';

import Ajv, { Schema } from 'ajv';

const ajv = new Ajv();

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function apiFetch<T>(path: string, schema: Schema, fetcher: Fetcher): Promise<T> {
  const start = Date.now();

  const res = await fetcher(`${process.env.API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
  });

  const ms = Date.now() - start;

  if (!res.ok) {
    logRequest(path, res.status, ms, 'error');
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const valid = ajv.validate(schema, data);
  if (!valid) {
    logRequest(path, res.status, ms, 'error');
    throw new Error(`Schema validation failed for ${path}: ${JSON.stringify(ajv.errors, null, 2)}`);
  }

  logRequest(path, res.status, ms, 'ok');
  return data as T;
}

export async function fetchUmaIndex(fetcher: Fetcher = fetch): Promise<UmaIndex[]> {
  return apiFetch<UmaIndex[]>('/umas/index', umaIndexSchema, fetcher);
}

export async function fetchSkillIndex(fetcher: Fetcher = fetch): Promise<SkillIndex[]> {
  return apiFetch<SkillIndex[]>('/skills/index', skillIndexSchema, fetcher);
}

export async function fetchUmaById(id: number, fetcher: Fetcher = fetch): Promise<UmaDetail> {
  return apiFetch<UmaDetail>(`/umas/${id}`, umaDetailSchema, fetcher);
}

export async function fetchUmas(
  params: Record<string, string | boolean>,
  fetcher: Fetcher = fetch,
): Promise<UmaSummary[]> {
  const query = new URLSearchParams(
    Object.entries({ released: true, ...params }).map(([k, v]) => [k, String(v)]),
  ).toString();
  const path = query ? `/umas?${query}` : '/umas';

  return apiFetch<UmaSummary[]>(path, umaSummarySchema, fetcher);
}

export async function fetchSkills(
  params: Record<string, string | boolean>,
  fetcher: Fetcher = fetch,
): Promise<SkillSummary[]> {
  const query = new URLSearchParams(
    Object.entries({ ...params, is_jp_only: false }).map(([k, v]) => [k, String(v)]),
  ).toString();
  return apiFetch<SkillSummary[]>(`/skills?${query}`, skillSummarySchema, fetcher);
}

export async function fetchSkillById(id: number, fetcher: Fetcher = fetch): Promise<SkillDetail> {
  return apiFetch<SkillDetail>(`/skills/${id}`, skillDetailSchema, fetcher);
}
