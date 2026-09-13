// worker/src/providers.ts

export interface ProviderCategory {
  id: string;
  label: string;
  kind?: string;
}

export interface ExtractedTxnRow {
  merchant: string;
  amount: number;
  type: 'expense' | 'income';
  date: string | null;
  currency: string;
  method?: string | null;
}

export function buildPrompt(categories: ProviderCategory[]): string {
  const catList = categories.map((c) => `${c.id}: ${c.label}`).join(', ');
  return `You are an accurate receipt parser. Analyze the receipt/statement image and extract transactions into strict JSON format with an array named "transactions".
Each transaction must have:
- "merchant": clean store or business name (string)
- "amount": total amount paid as a positive number (float)
- "type": "expense" or "income" (usually "expense")
- "date": transaction date in YYYY-MM-DD format, or null if not found
- "currency": 3-letter currency code (e.g. MYR, SGD, USD)
- "method": payment method if visible (e.g. "tng", "grabpay", "visa", "cash"), or null

Categories available: ${catList || 'none'}.
Return ONLY valid JSON matching: { "transactions": [...] } without markdown code fences or other text.`;
}

export async function callGroqVision(
  apiKey: string,
  base64: string,
  mime: string,
  categories: ProviderCategory[]
): Promise<ExtractedTxnRow[]> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(categories) },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime};base64,${base64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const json: any = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty provider response');
  const parsed = JSON.parse(content);
  return parseTransactionRows(parsed);
}

export async function callGeminiVision(
  apiKey: string,
  base64: string,
  mime: string,
  categories: ProviderCategory[]
): Promise<ExtractedTxnRow[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildPrompt(categories) },
            {
              inline_data: {
                mime_type: mime,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const json: any = await response.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty provider response');
  const parsed = JSON.parse(content);
  return parseTransactionRows(parsed);
}

export async function callOpenRouterVision(
  apiKeysRaw: string,
  base64: string,
  mime: string,
  categories: ProviderCategory[],
  model: string = 'google/gemini-2.0-flash-001'
): Promise<ExtractedTxnRow[]> {
  const keys = apiKeysRaw.split(',').map((k) => k.trim()).filter(Boolean);
  let lastError: any = null;

  for (const apiKey of keys) {
    try {
      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pipfinance.app',
          'X-Title': 'Pip Finance',
        },
        body: JSON.stringify({
          model: model || 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildPrompt(categories) },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mime};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        lastError = new Error(`OpenRouter API error: ${response.status}`);
        continue;
      }

      const json: any = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error('Empty OpenRouter response');
        continue;
      }
      const parsed = JSON.parse(content);
      return parseTransactionRows(parsed);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All OpenRouter keys failed');
}

export function parseTransactionRows(data: any): ExtractedTxnRow[] {
  const list = Array.isArray(data) ? data : data?.transactions || data?.items || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item: any): ExtractedTxnRow | null => {
      const merchant = String(item.merchant || item.name || 'Unknown').trim();
      const amount = Math.abs(Number(item.amount || 0));
      if (!amount || isNaN(amount)) return null;
      const type = item.type === 'income' ? 'income' : 'expense';
      const date = item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
      const currency = String(item.currency || 'MYR').toUpperCase();
      const method = item.method ? String(item.method).toLowerCase() : null;

      return {
        merchant,
        amount,
        type,
        date,
        currency,
        method,
      };
    })
    .filter((it): it is ExtractedTxnRow => it !== null);
}
