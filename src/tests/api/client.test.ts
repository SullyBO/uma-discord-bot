import { describe, it, expect, vi } from 'vitest';
import { fetchUmaIndex, fetchUmaById, Fetcher } from '../../api/client';

const mockUmaIndex = [{ id: 1, name: 'Special Week', version: 'A promising newcomer' }];

const mockUmaDetail = {
  id: 1,
  name: 'Special Week',
  subtitle: 'a promising newcomer',
  apt_turf: 'A',
  apt_dirt: 'G',
  apt_short: 'G',
  apt_mile: 'A',
  apt_medium: 'A',
  apt_long: 'B',
  apt_front: 'A',
  apt_pace: 'B',
  apt_late: 'C',
  apt_end: 'G',
  growth_speed: 10,
  growth_stamina: 10,
  growth_power: 10,
  growth_guts: 10,
  growth_wit: 10,
  skills: [],
};

function makeFetcher(data: unknown, status = 200): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  } as Response);
}

describe('fetchUmaIndex', () => {
  it('returns parsed uma index on success', async () => {
    const fetcher = makeFetcher(mockUmaIndex);
    const result = await fetchUmaIndex(fetcher);
    expect(result).toEqual(mockUmaIndex);
  });

  it('throws on non-ok response', async () => {
    const fetcher = makeFetcher({}, 500);
    await expect(fetchUmaIndex(fetcher)).rejects.toThrow('API error: 500');
  });

  it('throws on schema validation failure', async () => {
    const fetcher = makeFetcher([{ invalid: true }]);
    await expect(fetchUmaIndex(fetcher)).rejects.toThrow('Schema validation failed');
  });
});

describe('fetchUmaById', () => {
  it('returns parsed uma detail on success', async () => {
    const fetcher = makeFetcher(mockUmaDetail);
    const result = await fetchUmaById(1, fetcher);
    expect(result).toEqual(mockUmaDetail);
  });

  it('throws on non-ok response', async () => {
    const fetcher = makeFetcher({}, 404);
    await expect(fetchUmaById(1, fetcher)).rejects.toThrow('API error: 404');
  });

  it('throws on schema validation failure', async () => {
    const fetcher = makeFetcher({ id: 'not a number' });
    await expect(fetchUmaById(1, fetcher)).rejects.toThrow('Schema validation failed');
  });
});
