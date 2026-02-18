import { describe, expect, it } from 'vitest';
import { streamingState } from './streaming';

describe('streamingState', () => {
  it('should default to false', () => {
    expect(streamingState.get()).toBe(false);
  });

  it('should update to true', () => {
    streamingState.set(true);
    expect(streamingState.get()).toBe(true);

    // Reset
    streamingState.set(false);
  });

  it('should toggle between states', () => {
    expect(streamingState.get()).toBe(false);

    streamingState.set(true);
    expect(streamingState.get()).toBe(true);

    streamingState.set(false);
    expect(streamingState.get()).toBe(false);
  });

  it('should notify subscribers', () => {
    let notifiedValue: boolean | undefined;

    const unsubscribe = streamingState.subscribe((value) => {
      notifiedValue = value;
    });

    streamingState.set(true);
    expect(notifiedValue).toBe(true);

    streamingState.set(false);
    expect(notifiedValue).toBe(false);

    unsubscribe();
  });
});
