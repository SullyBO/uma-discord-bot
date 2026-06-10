import { describe, it, expect, vi } from 'vitest';
import { translateCondition } from '../../../utils/conditions/translate';
import type { SkillCondition } from '../../../types';

// translateCondition reads from umaCache and skillCache at module level.
// Mock the cache module so tests don't depend on runtime state.
vi.mock('../../../cache', () => ({
  umaCache: {
    get: vi.fn((id: number) => {
      if (id === 1) return { name: 'Special Week' };
      return undefined;
    }),
  },
  skillCache: {
    get: vi.fn((id: number) => {
      if (id === 100) return { name: 'Speed Boost' };
      return undefined;
    }),
  },
}));

function cond(cond_key: string, operator: string, cond_val: string, is_or = false): SkillCondition {
  return { cond_key, operator, cond_val, is_or };
}

describe('translateCondition', () => {
  describe('always', () => {
    it('returns always activates', () => {
      expect(translateCondition(cond('always', 'eq', '1'))).toBe('always activates');
    });
  });

  describe('phase', () => {
    it('returns in the X for ==', () => {
      expect(translateCondition(cond('phase', 'eq', '1'))).toContain('in the');
    });

    it('returns or later for >=', () => {
      expect(translateCondition(cond('phase', 'gt_eq', '1'))).toContain('or later');
    });

    it('returns or earlier for <=', () => {
      expect(translateCondition(cond('phase', 'lt_eq', '1'))).toContain('or earlier');
    });

    it('falls back to raw format for other operators', () => {
      expect(translateCondition(cond('phase', 'gt', '1'))).toContain('phase');
    });

    it('joins multiple values with or when separated by @', () => {
      expect(translateCondition(cond('phase', 'eq', '0@1'))).toContain(' or ');
    });
  });

  describe('order_rate', () => {
    it('returns top X% for <=', () => {
      expect(translateCondition(cond('order_rate', 'lt_eq', '30'))).toContain('top 30%');
    });

    it('returns bottom X% for >=', () => {
      expect(translateCondition(cond('order_rate', 'gt_eq', '70'))).toContain('bottom');
    });

    it('returns exactly at mark for ==', () => {
      expect(translateCondition(cond('order_rate', 'eq', '50'))).toContain('exactly at');
    });

    it('returns outside top X% for >', () => {
      expect(translateCondition(cond('order_rate', 'gt', '50'))).toContain('outside the top 50%');
    });

    it('returns strictly inside top X% for <', () => {
      expect(translateCondition(cond('order_rate', 'lt', '50'))).toContain(
        'strictly inside the top 50%',
      );
    });
  });

  describe('corner', () => {
    it('returns on any corner for != 0', () => {
      expect(translateCondition(cond('corner', 'not_eq', '0'))).toBe('on a corner');
    });

    it('returns not on a corner for == 0', () => {
      expect(translateCondition(cond('corner', 'eq', '0'))).toBe('not on a corner');
    });

    it('returns specific corner for other values', () => {
      expect(translateCondition(cond('corner', 'eq', '3'))).toContain('3rd corner');
    });
  });

  describe('slope', () => {
    it('returns flat for 0', () => {
      expect(translateCondition(cond('slope', 'eq', '0'))).toContain('flat');
    });

    it('returns uphill for 1', () => {
      expect(translateCondition(cond('slope', 'eq', '1'))).toContain('uphill');
    });

    it('returns downhill for 2', () => {
      expect(translateCondition(cond('slope', 'eq', '2'))).toContain('downhill');
    });

    it('falls back to raw format for other values', () => {
      expect(translateCondition(cond('slope', 'eq', '9'))).toContain('slope');
    });
  });

  describe('motivation', () => {
    it('returns mood: X for ==', () => {
      expect(translateCondition(cond('motivation', 'eq', '3'))).toContain('mood');
    });

    it('returns or better for >=', () => {
      expect(translateCondition(cond('motivation', 'gt_eq', '3'))).toContain('or better');
    });

    it('returns or worse for <=', () => {
      expect(translateCondition(cond('motivation', 'lt_eq', '3'))).toContain('or worse');
    });

    it('falls back to raw format for other operators', () => {
      expect(translateCondition(cond('motivation', 'gt', '3'))).toContain('mood');
    });
  });

  describe('binary 1/0 conditions', () => {
    it('is_lastspurt 1 returns in last spurt mode', () => {
      expect(translateCondition(cond('is_lastspurt', 'eq', '1'))).toContain('in last spurt mode');
    });

    it('is_lastspurt 0 returns not in last spurt mode', () => {
      expect(translateCondition(cond('is_lastspurt', 'eq', '0'))).toContain(
        'not in last spurt mode',
      );
    });

    it('blocked_front 1 returns blocked from the front', () => {
      expect(translateCondition(cond('blocked_front', 'eq', '1'))).toContain(
        'blocked from the front',
      );
    });

    it('blocked_front 0 returns not blocked from the front', () => {
      expect(translateCondition(cond('blocked_front', 'eq', '0'))).toContain('not blocked');
    });

    it('is_finalcorner 1 returns on or past the final corner', () => {
      expect(translateCondition(cond('is_finalcorner', 'eq', '1'))).toContain('final corner');
    });
  });

  describe('lookup table cases', () => {
    it('distance_type resolves known value', () => {
      // cond_val '2' = Mile in DISTANCE_TYPE_NAMES
      const result = translateCondition(cond('distance_type', 'eq', '2'));
      expect(result).toContain('distance race');
      expect(result).not.toContain('2');
    });

    it('distance_type falls back for unknown value', () => {
      const result = translateCondition(cond('distance_type', 'eq', '999'));
      expect(result).toContain('999');
    });

    it('running_style resolves known value', () => {
      const result = translateCondition(cond('running_style', 'eq', '1'));
      expect(result).toContain('running as');
      expect(result).not.toContain('style 1');
    });

    it('weather resolves known value', () => {
      const result = translateCondition(cond('weather', 'eq', '1'));
      expect(result).not.toContain('undefined');
    });
  });

  describe('cache-dependent cases', () => {
    it('is_exist_chara_id resolves known uma', () => {
      expect(translateCondition(cond('is_exist_chara_id', 'eq', '1'))).toContain('Special Week');
    });

    it('is_exist_chara_id falls back for unknown uma', () => {
      expect(translateCondition(cond('is_exist_chara_id', 'eq', '9999'))).toContain(
        'unknown character',
      );
    });

    it('is_used_skill_id resolves known skill', () => {
      expect(translateCondition(cond('is_used_skill_id', 'eq', '100'))).toContain('Speed Boost');
    });

    it('is_used_skill_id falls back for unknown skill', () => {
      expect(translateCondition(cond('is_used_skill_id', 'eq', '9999'))).toContain('unknown skill');
    });
  });

  describe('default fallback', () => {
    it('returns cond_key operator cond_val for unknown keys', () => {
      const result = translateCondition(cond('unknown_key', 'eq', '42'));
      expect(result).toContain('unknown_key');
      expect(result).toContain('==');
      expect(result).toContain('42');
    });
  });
});
