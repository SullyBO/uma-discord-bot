import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { capitalize, formatUmaVersion, formatOperator, logRequest } from '../utils';

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles already capitalized strings', () => {
    expect(capitalize('Wordle')).toBe('Wordle');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('formatUmaVersion', () => {
  it('capitalizes the first letter', () => {
    expect(formatUmaVersion('default')).toBe('Default');
  });

  it('replaces underscores with spaces', () => {
    expect(formatUmaVersion('new_year')).toBe('New year');
  });

  it('handles multiple underscores', () => {
    expect(formatUmaVersion('school_uniform_2')).toBe('School uniform 2');
  });

  it('handles already formatted strings', () => {
    expect(formatUmaVersion('Default')).toBe('Default');
  });

  it('handles empty string', () => {
    expect(formatUmaVersion('')).toBe('');
  });
});

describe('formatOperator', () => {
  it('maps eq to =', () => {
    expect(formatOperator('eq')).toBe('=');
  });

  it('maps not_eq to ≠', () => {
    expect(formatOperator('not_eq')).toBe('≠');
  });

  it('maps gt to >', () => {
    expect(formatOperator('gt')).toBe('>');
  });

  it('maps gt_eq to ≥', () => {
    expect(formatOperator('gt_eq')).toBe('≥');
  });

  it('maps lt to <', () => {
    expect(formatOperator('lt')).toBe('<');
  });

  it('maps lt_eq to ≤', () => {
    expect(formatOperator('lt_eq')).toBe('≤');
  });

  it('returns the operator unchanged when unrecognized', () => {
    expect(formatOperator('unknown_op')).toBe('unknown_op');
  });
});

describe('logRequest', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs ok requests with → arrow', () => {
    logRequest('/umas/1', 200, 42, 'ok');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('→'));
  });

  it('logs error requests with ✗ arrow', () => {
    logRequest('/umas/1', 500, 42, 'error');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✗'));
  });

  it('includes path in log output', () => {
    logRequest('/umas/1', 200, 42, 'ok');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/umas/1'));
  });

  it('includes status code in log output', () => {
    logRequest('/umas/1', 200, 42, 'ok');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('200'));
  });

  it('includes duration in log output', () => {
    logRequest('/umas/1', 200, 42, 'ok');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('42ms'));
  });
});
