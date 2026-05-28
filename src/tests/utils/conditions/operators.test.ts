import { describe, it, expect } from 'vitest';
import {
  normalizeOperator,
  fmtOp,
  fmtPositionOp,
  ordinalSuffix,
  fieldPos,
} from '../../../utils/conditions/operators';

describe('normalizeOperator', () => {
  it('maps eq to ==', () => expect(normalizeOperator('eq')).toBe('=='));
  it('maps not_eq to !=', () => expect(normalizeOperator('not_eq')).toBe('!='));
  it('maps gt to >', () => expect(normalizeOperator('gt')).toBe('>'));
  it('maps gt_eq to >=', () => expect(normalizeOperator('gt_eq')).toBe('>='));
  it('maps lt to <', () => expect(normalizeOperator('lt')).toBe('<'));
  it('maps lt_eq to <=', () => expect(normalizeOperator('lt_eq')).toBe('<='));
  it('returns unknown operators unchanged', () => expect(normalizeOperator('??')).toBe('??'));
});

describe('fmtOp', () => {
  it('formats == as exactly', () => expect(fmtOp('==', '5')).toBe('exactly 5'));
  it('formats != as not', () => expect(fmtOp('!=', '5')).toBe('not 5'));
  it('formats >= as at least', () => expect(fmtOp('>=', '5')).toBe('at least 5'));
  it('formats <= as at most', () => expect(fmtOp('<=', '5')).toBe('at most 5'));
  it('formats > as more than', () => expect(fmtOp('>', '5')).toBe('more than 5'));
  it('formats < as less than', () => expect(fmtOp('<', '5')).toBe('less than 5'));
  it('falls back to op val for unknown operator', () => expect(fmtOp('??', '5')).toBe('?? 5'));
});

describe('fmtPositionOp', () => {
  it('formats == as exactly', () =>
    expect(fmtPositionOp('==', '3rd place')).toBe('exactly 3rd place'));
  it('formats <= as or better', () =>
    expect(fmtPositionOp('<=', '3rd place')).toBe('3rd place or better'));
  it('formats >= as or worse', () =>
    expect(fmtPositionOp('>=', '3rd place')).toBe('3rd place or worse'));
  it('formats < as better than', () =>
    expect(fmtPositionOp('<', '3rd place')).toBe('better than 3rd place'));
  it('formats > as worse than', () =>
    expect(fmtPositionOp('>', '3rd place')).toBe('worse than 3rd place'));
  it('falls back to op val for unknown operator', () =>
    expect(fmtPositionOp('??', '3rd place')).toBe('?? 3rd place'));
});

describe('ordinalSuffix', () => {
  it('returns st for 1', () => expect(ordinalSuffix('1')).toBe('st'));
  it('returns nd for 2', () => expect(ordinalSuffix('2')).toBe('nd'));
  it('returns rd for 3', () => expect(ordinalSuffix('3')).toBe('rd'));
  it('returns th for 4', () => expect(ordinalSuffix('4')).toBe('th'));
  it('returns th for 11 (teen exception)', () => expect(ordinalSuffix('11')).toBe('th'));
  it('returns th for 12 (teen exception)', () => expect(ordinalSuffix('12')).toBe('th'));
  it('returns th for 13 (teen exception)', () => expect(ordinalSuffix('13')).toBe('th'));
  it('returns st for 21', () => expect(ordinalSuffix('21')).toBe('st'));
  it('returns nd for 22', () => expect(ordinalSuffix('22')).toBe('nd'));
  it('returns rd for 23', () => expect(ordinalSuffix('23')).toBe('rd'));
});

describe('fieldPos', () => {
  it('rounds to nearest position', () => expect(fieldPos(20, 9)).toBe(2));
  it('handles 50% of 12', () => expect(fieldPos(50, 12)).toBe(6));
  it('handles 100%', () => expect(fieldPos(100, 9)).toBe(9));
  it('handles 0%', () => expect(fieldPos(0, 9)).toBe(0));
});
