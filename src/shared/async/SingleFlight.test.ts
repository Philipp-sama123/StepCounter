import { describe, expect, it, vi } from 'vitest';

import { SingleFlight } from './SingleFlight';

describe('SingleFlight', () => {
  it('shares concurrent work for the same key', async () => {
    const coordinator = new SingleFlight<string>();
    const operation = vi.fn(async () => 42);

    const [first, second] = await Promise.all([
      coordinator.run('user-1', operation),
      coordinator.run('user-1', operation),
    ]);

    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('allows a later operation after completion', async () => {
    const coordinator = new SingleFlight<string>();
    const operation = vi.fn(async () => 'done');

    await coordinator.run('user-1', operation);
    await coordinator.run('user-1', operation);

    expect(operation).toHaveBeenCalledTimes(2);
  });
});
