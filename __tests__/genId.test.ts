import { genId } from '../src/db/db';

describe('genId', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // `addTransactions` mints an id per row inside a single `withTransactionAsync`, so a bulk
  // statement import can land many rows in the same millisecond. A collision there is not one
  // lost row: it is a PRIMARY KEY violation that rolls the WHOLE import back.
  it('never repeats across a bulk insert landing in a single millisecond', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(genId());
    expect(ids.size).toBe(10_000);
  });

  it('still varies between two calls in different milliseconds', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_800_000_000_000);
    const a = genId();
    nowSpy.mockReturnValue(1_800_000_000_001);
    expect(genId()).not.toBe(a);
  });

  it('is a plain lowercase base-36 string, safe as a TEXT primary key', () => {
    expect(genId()).toMatch(/^[0-9a-z]+$/);
  });
});
