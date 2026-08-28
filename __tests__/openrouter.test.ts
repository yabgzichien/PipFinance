import { OpenRouterProvider } from '../src/llm/openrouter';
import { LLMError } from '../src/llm/types';

function mockFetchOnce(opts: {
  status?: number;
  ok?: boolean;
  json?: unknown;
  reject?: boolean;
}) {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  const impl = opts.reject
    ? () => Promise.reject(new Error('offline'))
    : () =>
        Promise.resolve({
          status,
          ok,
          json: async () => opts.json,
          text: async () => JSON.stringify(opts.json ?? ''),
        });
  (global as any).fetch = jest.fn(impl);
}

const input = {
  apiKey: 'sk-or-test',
  model: 'openrouter/free',
  imageBase64: 'AAAA',
  mimeType: 'image/png',
};

describe('OpenRouterProvider.extract', () => {
  afterEach(() => jest.restoreAllMocks());

  it('parses a well-formed chat completion with transactions', async () => {
    mockFetchOnce({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transactions: [{ merchant: 'GrabFood', amount: 25.5, direction: 'out', currency: 'MYR' }],
              }),
            },
          },
        ],
      },
    });
    const rows = await OpenRouterProvider.extract(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].merchant).toBe('GrabFood');
    expect(rows[0].amount).toBe(25.5);
    expect(rows[0].type).toBe('expense');
  });

  it('maps HTTP 401 and 403 to an auth error', async () => {
    mockFetchOnce({ status: 401, json: {} });
    await expect(OpenRouterProvider.extract(input)).rejects.toMatchObject({ code: 'auth' });

    mockFetchOnce({ status: 403, json: {} });
    await expect(OpenRouterProvider.extract(input)).rejects.toMatchObject({ code: 'auth' });
  });

  it('maps HTTP 429 to a rate_limit error', async () => {
    mockFetchOnce({ status: 429, json: {} });
    await expect(OpenRouterProvider.extract(input)).rejects.toMatchObject({ code: 'rate_limit' });
  });

  it('throws no_key when the key is empty', async () => {
    mockFetchOnce({ json: {} });
    await expect(OpenRouterProvider.extract({ ...input, apiKey: '' })).rejects.toBeInstanceOf(LLMError);
    await expect(OpenRouterProvider.extract({ ...input, apiKey: '' })).rejects.toMatchObject({
      code: 'no_key',
    });
  });

  it('maps a thrown fetch to a network error', async () => {
    mockFetchOnce({ reject: true });
    await expect(OpenRouterProvider.extract(input)).rejects.toMatchObject({ code: 'network' });
  });

  it('maps an unreadable model reply to bad_response', async () => {
    mockFetchOnce({
      json: { choices: [{ message: { content: 'not valid json' } }] },
    });
    await expect(OpenRouterProvider.extract(input)).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('extractReceipt parses itemized receipts correctly', async () => {
    mockFetchOnce({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                merchant: 'Kopitiam',
                items: [{ label: 'Kopi O', amount: 3.5, quantity: 1 }],
                total: 3.5,
              }),
            },
          },
        ],
      },
    });
    const receipt = await OpenRouterProvider.extractReceipt!({
      apiKey: input.apiKey,
      model: input.model,
      parts: [{ kind: 'binary', base64: 'AAAA', mimeType: 'image/jpeg' }],
    });
    expect(receipt.merchant).toBe('Kopitiam');
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].label).toBe('Kopi O');
  });

  it('extractBalance parses account balance correctly', async () => {
    mockFetchOnce({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({ amount: 1520.5, currency: 'MYR' }),
            },
          },
        ],
      },
    });
    const balance = await OpenRouterProvider.extractBalance!({
      apiKey: input.apiKey,
      model: input.model,
      parts: [{ kind: 'binary', base64: 'AAAA', mimeType: 'image/jpeg' }],
    });
    expect(balance).toBe(1520.5);
  });

  it('rejects PDF documents in extractDocument with bad_response for fallback routing', async () => {
    await expect(
      OpenRouterProvider.extractDocument!({
        apiKey: input.apiKey,
        model: input.model,
        parts: [{ kind: 'binary', base64: 'AAAA', mimeType: 'application/pdf' }],
      })
    ).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('coach returns trimmed string advice', async () => {
    mockFetchOnce({
      json: {
        choices: [{ message: { content: '  Save RM50 by dining in!  ' } }],
      },
    });
    const advice = await OpenRouterProvider.coach({
      apiKey: input.apiKey,
      model: input.model,
      prompt: 'How to save?',
      system: 'You are a budget coach.',
    });
    expect(advice).toBe('Save RM50 by dining in!');
  });
});

describe('OpenRouterProvider.quickAdd', () => {
  const cats = [{ id: 'food', label: 'Food', kind: 'expense' as const }];
  const args = { apiKey: 'sk-or-test', model: 'openrouter/free', text: 'lunch 9.2', categories: cats, today: '2026-08-28', activeCurrencies: ['MYR'] };

  it('parses a well-formed reply into drafts', async () => {
    mockFetchOnce({
      json: {
        choices: [{ message: { content: JSON.stringify({ items: [{ label: 'lunch', amount: 9.2, type: 'expense', categoryId: 'food' }] }) } }],
      },
    });
    const out = await OpenRouterProvider.quickAdd!(args);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'lunch', amount: 9.2, categoryId: 'food' });
  });

  it('raises bad_response when the reply is not JSON', async () => {
    mockFetchOnce({ json: { choices: [{ message: { content: 'sorry, what?' } }] } });
    await expect(OpenRouterProvider.quickAdd!(args)).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('raises bad_response when the message content is missing', async () => {
    mockFetchOnce({ json: { choices: [{}] } });
    await expect(OpenRouterProvider.quickAdd!(args)).rejects.toBeInstanceOf(LLMError);
  });
});

