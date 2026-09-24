export function describeFailure(error: unknown): { name: string; message: string } {
  const raw = error instanceof Error ? { name: error.name || 'Error', message: error.message } : { name: 'Error', message: 'Unknown delivery failure' };
  return { name: raw.name.slice(0, 80), message: raw.message.replaceAll('\n', ' ').slice(0, 300) };
}

export const RECLAIM_STATES = ['PENDING', 'PROCESSING', 'DEAD'] as const;

export function retryPlan(attempts: number): { state: 'PENDING' | 'DEAD'; delayMs: number } {
  return {
    state: attempts >= 5 ? 'DEAD' : 'PENDING',
    delayMs: Math.min(300_000, 1000 * 2 ** attempts),
  };
}
