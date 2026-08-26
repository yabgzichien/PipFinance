import { GeminiProvider } from '../llm/gemini';
import { GroqProvider } from '../llm/groq';
import { OpenRouterProvider } from '../llm/openrouter';

// Providers are fixed by configuration, not editable in-app. Gemini handles
// primary tasks & document import; Groq and OpenRouter provide fallback tiers.
// Keys come from .env.local (EXPO_PUBLIC_* is inlined at build time);
// models are pinned to the defaults below.
export const GROQ_DEFAULT_MODEL = GroqProvider.defaultModel;
export const GEMINI_DEFAULT_MODEL = GeminiProvider.defaultModel;
export const OPENROUTER_DEFAULT_MODEL = OpenRouterProvider.defaultModel;

const ENV_GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const ENV_GROQ_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL ?? '';
const ENV_GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const ENV_GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? '';
const ENV_OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';
const ENV_OPENROUTER_MODEL = process.env.EXPO_PUBLIC_OPENROUTER_MODEL ?? '';

export type ProviderRole = 'general' | 'docs';

export interface LLMSettings {
  groqKey: string;
  groqModel: string;
  geminiKey: string;
  geminiModel: string;
  openrouterKey: string;
  openrouterModel: string;
}

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
}

/** Which provider/key/model a task should use: general → Groq, documents → Gemini. */
export function configFor(s: LLMSettings, role: ProviderRole): ProviderConfig {
  return role === 'docs'
    ? { provider: 'gemini', apiKey: s.geminiKey, model: s.geminiModel }
    : { provider: 'groq', apiKey: s.groqKey, model: s.groqModel };
}

/** The fixed provider settings (keys from env, models pinned). */
export async function loadSettings(): Promise<LLMSettings> {
  return {
    groqKey: ENV_GROQ_KEY,
    groqModel: ENV_GROQ_MODEL || GROQ_DEFAULT_MODEL,
    geminiKey: ENV_GEMINI_KEY,
    geminiModel: ENV_GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    openrouterKey: ENV_OPENROUTER_KEY,
    openrouterModel: ENV_OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
  };
}
