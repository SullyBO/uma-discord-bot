import { describe, it, expect, vi } from 'vitest';
import { fetchUmaIndex, fetchUmaById, fetchUmas, fetchSkillIndex, Fetcher } from '../../api/client';
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

const mockUmaSummaryList = [
  {
    id: 1,
    name: 'Special Week',
    subtitle: 'default',
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
  },
];

const mockSkillIndex = [
  { id: 1, name: 'Speed Burst' },
  { id: 2, name: 'Final Stretch' },
];

describe('fetchSkillIndex', () => {
  it('returns parsed skill index on success', async () => {
    const fetcher = makeFetcher(mockSkillIndex);
    const result = await fetchSkillIndex(fetcher);
    expect(result).toEqual(mockSkillIndex);
  });

  it('throws on non-ok response', async () => {
    const fetcher = makeFetcher({}, 500);
    await expect(fetchSkillIndex(fetcher)).rejects.toThrow('API error: 500');
  });

  it('throws on schema validation failure', async () => {
    const fetcher = makeFetcher([{ invalid: true }]);
    await expect(fetchSkillIndex(fetcher)).rejects.toThrow('Schema validation failed');
  });

  it('returns empty array when index is empty', async () => {
    const fetcher = makeFetcher([]);
    const result = await fetchSkillIndex(fetcher);
    expect(result).toEqual([]);
  });
});

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

describe('fetchUmas', () => {
  it('returns parsed uma list on success with no filters', async () => {
    const fetcher = makeFetcher(mockUmaSummaryList);
    const result = await fetchUmas({}, fetcher);
    expect(result).toEqual(mockUmaSummaryList);
  });

  it('appends query params when filters are provided', async () => {
    const fetcher = makeFetcher(mockUmaSummaryList);
    await fetchUmas({ turf: 'A', long: 'A' }, fetcher);
    const calledUrl = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('turf=A');
    expect(calledUrl).toContain('long=A');
  });

  it('throws on non-ok response', async () => {
    const fetcher = makeFetcher({}, 500);
    await expect(fetchUmas({}, fetcher)).rejects.toThrow('API error: 500');
  });

  it('throws on schema validation failure', async () => {
    const fetcher = makeFetcher([{ invalid: true }]);
    await expect(fetchUmas({}, fetcher)).rejects.toThrow('Schema validation failed');
  });
});
