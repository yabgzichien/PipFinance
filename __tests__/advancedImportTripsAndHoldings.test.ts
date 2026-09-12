import { buildPrompt, parseJSON, isInvestmentCandidate } from '../src/lib/advancedImport';
import type { ParsedAccount } from '../src/lib/advancedImport';

describe('Advanced Import - Prompt & Trips & Live Holdings', () => {
  describe('buildPrompt', () => {
    it('includes strict 100% confidence trip rules and trips schema', () => {
      const prompt = buildPrompt('MYR');
      expect(prompt).toContain('trip: trip / vacation name');
      expect(prompt).toContain('STRICT 100% CONFIDENCE RULE');
      expect(prompt).toContain('TRIPS (Optional)');
      expect(prompt).toContain('"trips": [');
      expect(prompt).toContain('"startDate": "YYYY-MM-DD"');
      expect(prompt).toContain('"endDate": "YYYY-MM-DD"');
    });

    it('includes investment holding fields (ticker, quantity, sub) in Section 3 and reply format', () => {
      const prompt = buildPrompt('MYR');
      expect(prompt).toContain('ticker: ticker symbol for investments or crypto');
      expect(prompt).toContain('quantity: number of units/shares/coins held');
      expect(prompt).toContain('sub: "stock" | "crypto" | "commodity"');
      expect(prompt).toContain('"ticker": null, "quantity": null, "sub": null');
    });
  });

  describe('parseJSON - Trips parsing and strict date matching', () => {
    it('parses top-level trips and tags transactions within the date range', () => {
      const json = JSON.stringify({
        trips: [
          { name: 'Tokyo 2026', startDate: '2026-04-01', endDate: '2026-04-10' },
        ],
        transactions: [
          {
            date: '2026-04-03',
            description: 'Ichiran Ramen',
            amount: -35.0,
            currency: 'JPY',
            trip: 'Tokyo 2026',
          },
          {
            date: '2026-04-10',
            description: 'Tokyo Station Souvenir',
            amount: -50.0,
            currency: 'JPY',
            trip: 'Tokyo 2026',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.trips).toHaveLength(1);
      expect(result.trips![0]).toEqual({
        name: 'Tokyo 2026',
        startDate: '2026-04-01',
        endDate: '2026-04-10',
      });
      expect(result.transactions[0].tripName).toBe('Tokyo 2026');
      expect(result.transactions[1].tripName).toBe('Tokyo 2026');
    });

    it('strictly drops tripName for transactions outside the trip date range', () => {
      const json = JSON.stringify({
        trips: [
          { name: 'Penang Getaway', startDate: '2026-05-01', endDate: '2026-05-03' },
        ],
        transactions: [
          {
            date: '2026-05-02',
            description: 'Laksa',
            amount: -15.0,
            currency: 'MYR',
            trip: 'Penang Getaway',
          },
          // Date before trip start
          {
            date: '2026-04-30',
            description: 'Early Petrol',
            amount: -60.0,
            currency: 'MYR',
            trip: 'Penang Getaway',
          },
          // Date after trip end
          {
            date: '2026-05-15',
            description: 'Post trip meal',
            amount: -25.0,
            currency: 'MYR',
            trip: 'Penang Getaway',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.trips).toHaveLength(1);
      expect(result.transactions[0].tripName).toBe('Penang Getaway');
      // Strictly stripped because date falls outside the trip range:
      expect(result.transactions[1].tripName).toBeUndefined();
      expect(result.transactions[2].tripName).toBeUndefined();
    });

    it('infers trip start and end dates from transaction dates if not provided in trips array', () => {
      const json = JSON.stringify({
        transactions: [
          {
            date: '2026-06-12',
            description: 'Flight ticket',
            amount: -500.0,
            currency: 'MYR',
            trip: 'Bali Vacation',
          },
          {
            date: '2026-06-18',
            description: 'Beach Club',
            amount: -120.0,
            currency: 'IDR',
            trip: 'Bali Vacation',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.trips).toHaveLength(1);
      expect(result.trips![0]).toEqual({
        name: 'Bali Vacation',
        startDate: '2026-06-12',
        endDate: '2026-06-18',
      });
      expect(result.transactions[0].tripName).toBe('Bali Vacation');
      expect(result.transactions[1].tripName).toBe('Bali Vacation');
    });

    it('handles transactions without a date by leaving tripName unset', () => {
      const json = JSON.stringify({
        trips: [{ name: 'London', startDate: '2026-07-01', endDate: '2026-07-10' }],
        transactions: [
          {
            date: null,
            description: 'Unknown date spend',
            amount: -20.0,
            currency: 'GBP',
            trip: 'London',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.transactions[0].tripName).toBeUndefined();
    });
  });

  describe('parseJSON - Investment holdings & Live tracking fields', () => {
    it('parses ticker, quantity, and sub from account objects', () => {
      const json = JSON.stringify({
        accounts: [
          {
            name: 'Luno Bitcoin',
            type: 'Investments',
            balance: 15000.0,
            currency: 'MYR',
            ticker: 'BTC',
            quantity: 0.045,
            sub: 'crypto',
          },
          {
            name: 'Rakuten Trade - Apple',
            type: 'Investments',
            balance: 8500.0,
            currency: 'USD',
            ticker: 'AAPL',
            quantity: 10,
            sub: 'stock',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.accounts).toHaveLength(2);

      expect(result.accounts[0].ticker).toBe('BTC');
      expect(result.accounts[0].quantity).toBe(0.045);
      expect(result.accounts[0].sub).toBe('crypto');

      expect(result.accounts[1].ticker).toBe('AAPL');
      expect(result.accounts[1].quantity).toBe(10);
      expect(result.accounts[1].sub).toBe('stock');
    });

    it('falls back to notes if ticker is provided in notes without spaces', () => {
      const json = JSON.stringify({
        accounts: [
          {
            name: 'Maybank Trade',
            type: 'Investments',
            balance: 3000.0,
            currency: 'MYR',
            notes: '1155.KL',
          },
        ],
      });

      const result = parseJSON(json, 'MYR');
      expect(result.accounts[0].ticker).toBe('1155.KL');
    });
  });

  describe('isInvestmentCandidate', () => {
    it('identifies investment accounts by class, sub, ticker, or keywords', () => {
      const baseAccount: ParsedAccount = {
        name: 'Normal Savings',
        cls: 'cash',
        clsLabel: 'Cash',
        kind: 'asset',
        balance: 1000,
        currency: 'MYR',
        asOf: '2026-09-11',
        notes: null,
        include: true,
        quantity: null,
        cost: null,
      };

      expect(isInvestmentCandidate(baseAccount)).toBe(false);

      // Excluded accounts return false
      expect(isInvestmentCandidate({ ...baseAccount, include: false, cls: 'investments' })).toBe(false);

      // Investment cls
      expect(isInvestmentCandidate({ ...baseAccount, cls: 'investments' })).toBe(true);

      // Has ticker
      expect(isInvestmentCandidate({ ...baseAccount, ticker: 'ETH' })).toBe(true);

      // Has symbol
      expect(isInvestmentCandidate({ ...baseAccount, symbol: 'BTC-USD' })).toBe(true);

      // Keyword match in name
      expect(isInvestmentCandidate({ ...baseAccount, name: 'Binance Wallet' })).toBe(true);
      expect(isInvestmentCandidate({ ...baseAccount, name: 'Moomoo US Stock' })).toBe(true);
    });

    it('correctly parses and detects candidates in the live investment test JSON', () => {
      const testJson = JSON.stringify({
        statement: {
          issuer: 'Investment Portfolio Test',
          period: { start: '2026-09-01', end: '2026-09-11' },
        },
        accounts: [
          {
            name: 'Apple Shares (NASDAQ)',
            type: 'Investments',
            balance: 4500.0,
            currency: 'MYR',
            as_of: '2026-09-11',
            ticker: 'AAPL',
            quantity: null,
            sub: 'stock',
          },
          {
            name: 'Luno Crypto Wallet',
            type: 'Investments',
            balance: 12500.0,
            currency: 'MYR',
            as_of: '2026-09-11',
            ticker: 'BTC',
            quantity: 0.045,
            sub: 'crypto',
          },
        ],
        transactions: [
          {
            date: '2026-09-05',
            description: 'Brokerage Fee',
            amount: -15.0,
            currency: 'MYR',
            category: 'investment',
            account: 'Apple Shares (NASDAQ)',
            trip: null,
          },
        ],
      });

      const parsed = parseJSON(testJson, 'MYR');
      expect(parsed.accounts).toHaveLength(2);
      expect(parsed.transactions).toHaveLength(1);
      expect(parsed.accounts.every(isInvestmentCandidate)).toBe(true);
      expect(parsed.accounts[0].ticker).toBe('AAPL');
      expect(parsed.accounts[0].quantity).toBeNull();
      expect(parsed.accounts[1].ticker).toBe('BTC');
      expect(parsed.accounts[1].quantity).toBe(0.045);
    });
  });
});
