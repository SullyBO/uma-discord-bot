import { describe, it, expect, vi } from 'vitest';
import { translateRange, splitIntoOrGroups, renderGroup } from '../../../utils/conditions/ranges';
import type { SkillCondition } from '../../../types';

vi.mock('../../../cache', () => ({
  umaCache: { get: vi.fn(() => undefined) },
  skillCache: { get: vi.fn(() => undefined) },
}));

function cond(cond_key: string, operator: string, cond_val: string, is_or = false): SkillCondition {
  return { cond_key, operator, cond_val, is_or };
}

describe('translateRange', () => {
  it('returns a range string for remain_distance', () => {
    expect(translateRange('remain_distance', '100', '300')).toBe(
      'between 100 and 300 meters remaining',
    );
  });

  it('returns a range string for hp_per', () => {
    expect(translateRange('hp_per', '20', '80')).toBe('stamina between 20% and 80%');
  });

  it('returns a range string for distance_rate', () => {
    expect(translateRange('distance_rate', '30', '70')).toBe('race between 30% and 70% complete');
  });

  it('returns a range string for order with ordinal suffixes', () => {
    const result = translateRange('order', '2', '5');
    expect(result).toContain('2nd');
    expect(result).toContain('5th');
  });

  it('returns null for keys that do not support ranges', () => {
    expect(translateRange('always', '0', '1')).toBeNull();
    expect(translateRange('corner', '1', '3')).toBeNull();
    expect(translateRange('unknown_key', '0', '10')).toBeNull();
  });

  it('returns null for order_rate when lo >= hi', () => {
    expect(translateRange('order_rate', '70', '30')).toBeNull();
  });

  it('returns a range string for order_rate with field positions', () => {
    const result = translateRange('order_rate', '20', '70');
    expect(result).toContain('top 20%');
    expect(result).toContain('70%');
    expect(result).toContain('CM');
    expect(result).toContain('LOH');
  });

  it('converts distance_diff_top_float values to decimal meters', () => {
    const result = translateRange('distance_diff_top_float', '10', '30');
    expect(result).toContain('1.0');
    expect(result).toContain('3.0');
  });
});

describe('splitIntoOrGroups', () => {
  it('puts all non-or conditions in one group', () => {
    const conditions = [cond('phase', 'eq', '1'), cond('distance_type', 'eq', '2')];
    const groups = splitIntoOrGroups(conditions);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('starts a new group at each is_or condition', () => {
    const conditions = [
      cond('phase', 'eq', '1'),
      cond('distance_type', 'eq', '2', true),
      cond('corner', 'not_eq', '0'),
    ];
    const groups = splitIntoOrGroups(conditions);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(1);
    expect(groups[1]).toHaveLength(2);
  });

  it('starts first group even when first condition has is_or true', () => {
    const conditions = [cond('phase', 'eq', '1', true)];
    const groups = splitIntoOrGroups(conditions);
    expect(groups).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(splitIntoOrGroups([])).toHaveLength(0);
  });
});

describe('renderGroup', () => {
  it('renders individual conditions as bullet points', () => {
    const group = [cond('phase', 'eq', '1')];
    const lines = renderGroup(group, false);
    expect(lines[0]).toContain('•');
  });

  it('prefixes first line with OR for or groups', () => {
    const group = [cond('phase', 'eq', '1')];
    const lines = renderGroup(group, true);
    expect(lines[0]).toContain('OR');
  });

  it('does not prefix subsequent lines with OR', () => {
    const group = [cond('phase', 'eq', '1'), cond('distance_type', 'eq', '2')];
    const lines = renderGroup(group, true);
    expect(lines[1]).not.toContain('OR');
  });

  it('merges >= and <= on the same key into a range', () => {
    const group = [
      cond('remain_distance', 'gt_eq', '100'),
      cond('remain_distance', 'lt_eq', '300'),
    ];
    const lines = renderGroup(group, false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('100 and 300 meters remaining');
  });

  it('renders both conditions separately when range returns null for the key', () => {
    const group = [cond('corner', 'gt_eq', '1'), cond('corner', 'lt_eq', '3')];
    const lines = renderGroup(group, false);
    expect(lines).toHaveLength(2);
  });

  it('merges is_finalcorner + corner == 0 into final straight', () => {
    const group = [cond('is_finalcorner', 'eq', '1'), cond('corner', 'eq', '0')];
    const lines = renderGroup(group, false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('final straight');
  });

  it('capitalizes the first character of each rendered line', () => {
    const group = [cond('phase', 'eq', '1')];
    const lines = renderGroup(group, false);
    const text = lines[0].replace(/^[•\s]+/, '');
    expect(text[0]).toBe(text[0].toUpperCase());
  });
});
