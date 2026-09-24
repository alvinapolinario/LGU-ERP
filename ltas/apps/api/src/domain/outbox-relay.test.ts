import { describe, expect, it } from 'vitest';
import { describeFailure, RECLAIM_STATES, retryPlan } from './outbox-relay.js';

describe('outbox relay', () => {
  it('keeps the error name and a single-line message', () => {
    expect(describeFailure(new Error('Independent audit export mismatch'))).toEqual({ name: 'Error', message: 'Independent audit export mismatch' });
    expect(describeFailure(new TypeError('bad\npayload'))).toEqual({ name: 'TypeError', message: 'bad payload' });
    expect(describeFailure('x')).toEqual({ name: 'Error', message: 'Unknown delivery failure' });
  });
  it('retries a young failure and parks the fifth attempt without dropping it', () => {
    expect(retryPlan(1)).toEqual({ state: 'PENDING', delayMs: 2000 });
    expect(retryPlan(4)).toEqual({ state: 'PENDING', delayMs: 16_000 });
    expect(retryPlan(5).state).toBe('DEAD');
    expect(retryPlan(12)).toEqual({ state: 'DEAD', delayMs: 300_000 });
    expect(RECLAIM_STATES).toEqual(['PENDING', 'PROCESSING', 'DEAD']);
    expect(RECLAIM_STATES).toContain(retryPlan(5).state);
  });
});
