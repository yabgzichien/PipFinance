import { configFor, loadSettings, OPENROUTER_DEFAULT_MODEL, type LLMSettings } from '../src/settings/settingsStore';

const s: LLMSettings = {
  groqKey: 'gsk_x',
  groqModel: 'llama-model',
  geminiKey: 'AIza_y',
  geminiModel: 'gemini-3.1-flash-lite',
  openrouterKey: 'sk-or-z',
  openrouterModel: 'openrouter/free',
};

describe('configFor', () => {
  it('routes general tasks to Groq', () => {
    expect(configFor(s, 'general')).toEqual({ provider: 'groq', apiKey: 'gsk_x', model: 'llama-model' });
  });
  it('routes document tasks to Gemini', () => {
    expect(configFor(s, 'docs')).toEqual({ provider: 'gemini', apiKey: 'AIza_y', model: 'gemini-3.1-flash-lite' });
  });
});

describe('loadSettings', () => {
  it('loads settings with OpenRouter defaults when keys/models present', async () => {
    const loaded = await loadSettings();
    expect(loaded.openrouterModel).toBeDefined();
    expect(OPENROUTER_DEFAULT_MODEL).toBe('openrouter/free');
  });
});
