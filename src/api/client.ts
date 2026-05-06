import { umaDetailSchema } from '../tests/schemas/umaDetail.schema';
import { umaIndexSchema } from '../tests/schemas/umaIndex.schema';
import { UmaDetail, UmaIndex } from '../types';
import Ajv, { Schema } from 'ajv';

const ajv = new Ajv();

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function apiFetch<T>(path: string, schema: Schema, fetcher: Fetcher): Promise<T> {
  const res = await fetcher(`${process.env.API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const valid = ajv.validate(schema, data);
  if (!valid) {
    throw new Error(`Schema validation failed for ${path}: ${JSON.stringify(ajv.errors, null, 2)}`);
  }

  return data as T;
}

export async function fetchUmaIndex(fetcher: Fetcher = fetch): Promise<UmaIndex[]> {
  return apiFetch<UmaIndex[]>('/umas/index', umaIndexSchema, fetcher);
}

export async function fetchUmaById(id: number, fetcher: Fetcher = fetch): Promise<UmaDetail> {
  return apiFetch<UmaDetail>(`/umas/${id}`, umaDetailSchema, fetcher);
}
