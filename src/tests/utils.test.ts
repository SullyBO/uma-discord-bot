import { describe, it, expect } from 'vitest';
import { capitalize, formatUmaVersion } from '../utils';

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
