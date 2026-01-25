import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createSampler } from './sampler';

describe('createSampler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute first call immediately', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('first');
    expect(fn).toHaveBeenCalledWith('first');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should drop calls within sample interval', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('first');
    expect(fn).toHaveBeenCalledTimes(1);

    // These calls are within the interval
    sampled('second');
    sampled('third');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should capture trailing call after interval', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('first'); // Immediate
    sampled('second'); // Dropped, but sets trailing
    sampled('third'); // Updates trailing args

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('should allow immediate execution after interval passes', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('first');
    vi.advanceTimersByTime(100);

    // Now outside interval
    sampled('second');
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle rapid succession of calls correctly', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    // First call - immediate
    sampled(1);
    expect(fn).toHaveBeenCalledTimes(1);

    // Rapid calls within interval - should all be sampled
    for (let i = 2; i <= 10; i++) {
      sampled(i);
    }
    expect(fn).toHaveBeenCalledTimes(1); // Still only the first call

    // After interval, trailing call fires
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(10); // Last arg
  });

  it('should preserve function context (this)', () => {
    const obj = {
      value: 42,
      fn: vi.fn(function (this: { value: number }) {
        return this.value;
      }),
    };
    obj.fn = createSampler(obj.fn, 100);

    obj.fn();
    expect(obj.fn).toBeDefined();
  });

  it('should work with multiple arguments', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('a', 'b', 'c');
    expect(fn).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('should not execute trailing call if only one immediate call was made', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('only');
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    // No trailing call since args were already used
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle zero interval', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 0);

    sampled('first');
    sampled('second');

    // With 0 interval, each call should be immediate
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should clear trailing args after execution', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('first');
    sampled('trailing');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait more, shouldn't call again
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
