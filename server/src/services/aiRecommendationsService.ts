import { tripAiRecommendationsResultSchema, type TripAiRecommendationsResult } from '@trek/shared';
import { getTripRaw } from './tripService';
import { listDays } from './dayService';
import { listPlaces } from './placeService';
import { listReservations } from './reservationService';
import { listItems as listPackingItems } from './packingService';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 45_000;
const MAX_CONTEXT_CHARS = 12_000;
const COOLDOWN_MS = 8_000;

const lastCallAt = new Map<string, number>();

export class AiRecommendationsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AiRecommendationsError';
  }
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim() || process.env.OLLAMA_URL?.trim() || process.env.LLM_PROVIDER?.trim() || true);
}

export function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  hu: 'Hungarian',
  nl: 'Dutch',
  br: 'Portuguese (Brazil)',
  cs: 'Czech',
  pl: 'Polish',
  ru: 'Russian',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  it: 'Italian',
  ar: 'Arabic',
  id: 'Indonesian',
  tr: 'Turkish',
  ja: 'Japanese',
  ko: 'Korean',
  uk: 'Ukrainian',
  gr: 'Greek',
  sv: 'Swedish',
  vi: 'Vietnamese',
  ca: 'Catalan',
};

export interface CompactTripContext {
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  places: { name: string; address?: string; category?: string; notes?: string }[];
  days: {
    day_number: number;
    date: string | null;
    title: string | null;
    notes: string[];
    places: string[];
  }[];
  reservations: { type: string; title: string; when?: string }[];
  packingUnchecked: string[];
}

type DayRow = {
  day_number?: number;
  date?: string | null;
  title?: string | null;
  notes?: string | null;
  assignments?: { place?: { name?: string } }[];
  notes_items?: { text?: string }[];
};

type PlaceRow = {
  name: string;
  address?: string | null;
  notes?: string | null;
  category?: { name?: string | null } | null;
  category_name?: string | null;
};

type ReservationRow = {
  type?: string;
  title?: string | null;
  name?: string | null;
  reservation_time?: string | null;
  day_number?: number | null;
};

type PackingRow = { name?: string; checked?: number | boolean };

/** Pure: trim trip data into a prompt-sized snapshot. Exported for tests. */
export function compactTripContext(input: {
  trip: {
    title?: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    currency?: string;
  };
  places: PlaceRow[];
  days: DayRow[];
  reservations: ReservationRow[];
  packing: PackingRow[];
}): CompactTripContext {
  return {
    title: String(input.trip.title || 'Untitled trip'),
    description: input.trip.description ? String(input.trip.description).slice(0, 500) : null,
    start_date: input.trip.start_date ?? null,
    end_date: input.trip.end_date ?? null,
    currency: String(input.trip.currency || 'EUR'),
    places: input.places.slice(0, 40).map((p) => ({
      name: p.name,
      ...(p.address ? { address: String(p.address).slice(0, 120) } : {}),
      ...(p.category?.name || p.category_name
        ? { category: String(p.category?.name || p.category_name) }
        : {}),
      ...(p.notes ? { notes: String(p.notes).slice(0, 160) } : {}),
    })),
    days: input.days.slice(0, 31).map((d) => ({
      day_number: Number(d.day_number || 0),
      date: d.date ?? null,
      title: d.title ?? null,
      notes: (d.notes_items || [])
        .map((n) => String(n.text || '').trim())
        .filter(Boolean)
        .slice(0, 8),
      places: (d.assignments || [])
        .map((a) => a.place?.name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 12),
    })),
    reservations: input.reservations.slice(0, 25).map((r) => ({
      type: String(r.type || 'other'),
      title: String(r.title || r.name || r.type || 'Booking'),
      ...(r.reservation_time ? { when: String(r.reservation_time).slice(0, 32) } : {}),
    })),
    packingUnchecked: input.packing
      .filter((i) => !i.checked)
      .map((i) => String(i.name || '').trim())
      .filter(Boolean)
      .slice(0, 30),
  };
}

/** Strip markdown fences and parse the first JSON object in a model reply. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new AiRecommendationsError(502, 'AI returned no JSON');
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new AiRecommendationsError(502, 'AI returned invalid JSON');
  }
}

export function normalizeRecommendations(raw: unknown): TripAiRecommendationsResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

  const parsed = tripAiRecommendationsResultSchema.safeParse({
    summary: asStr(obj.summary),
    places: asArr(obj.places).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return {
        name: asStr(row.name).trim() || asStr(row.title).trim(),
        kind: asStr(row.kind) || undefined,
        why: asStr(row.why || row.reason) || undefined,
        suggestedDay: asStr(row.suggestedDay || row.day) || undefined,
      };
    }).filter((p) => p.name),
    food: asArr(obj.food || obj.restaurants).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { name: asStr(row.name).trim(), why: asStr(row.why) || undefined };
    }).filter((p) => p.name),
    packing: asArr(obj.packing).map((p) => {
      if (typeof p === 'string') return { item: p };
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { item: asStr(row.item || row.name).trim(), why: asStr(row.why) || undefined };
    }).filter((p) => p.item),
    tips: asArr(obj.tips).map((t) => asStr(t).trim()).filter(Boolean),
    dayIdeas: asArr(obj.dayIdeas || obj.itineraryGaps).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { day: asStr(row.day || row.suggestedDay).trim(), idea: asStr(row.idea || row.suggestion).trim() };
    }).filter((p) => p.day && p.idea),
  });

  if (!parsed.success) {
    throw new AiRecommendationsError(502, 'AI returned an unexpected shape');
  }
  return parsed.data;
}

function languageLabel(lang?: string): string {
  if (!lang) return 'English';
  return LANG_NAMES[lang] || LANG_NAMES[lang.split('-')[0] || ''] || lang;
}

function buildPrompt(context: CompactTripContext, lang?: string): { system: string; user: string } {
  const langName = languageLabel(lang);
  const system = `You are TREK's trip advisor. Recommend practical, specific ideas for THIS trip only.
Write every string in ${langName}.
Do not repeat places, restaurants, or packing items already listed in the trip.
Prefer walkable / well-known local options over generic tourist filler.
If the trip has empty days, fill dayIdeas; if days are packed, suggest lighter alternatives.
Return ONLY a JSON object with keys: summary, places, food, packing, tips, dayIdeas.
- summary: 2–4 sentences about the trip as planned and what is missing.
- places: 4–8 objects {name, kind (sight|activity|neighborhood|hidden_gem), why, suggestedDay}.
- food: 3–6 objects {name, why}.
- packing: 4–8 objects {item, why} that are not already packed.
- tips: 4–8 short local tips (transit cards, timing, weather, etiquette).
- dayIdeas: 2–6 objects {day, idea} keyed to Day N or a date.`;

  let user = JSON.stringify(context);
  if (user.length > MAX_CONTEXT_CHARS) user = `${user.slice(0, MAX_CONTEXT_CHARS)}\n…`;
  return { system, user: `Trip snapshot:\n${user}` };
}

function loadContext(tripId: string | number): CompactTripContext {
  const trip = getTripRaw(tripId);
  if (!trip) {
    throw new AiRecommendationsError(404, 'Trip not found');
  }
  const { days } = listDays(tripId);
  const places = listPlaces(String(tripId), {});
  const reservations = listReservations(tripId);
  const packing = listPackingItems(tripId);
  return compactTripContext({
    trip: {
      title: trip.title,
      description: trip.description,
      start_date: trip.start_date,
      end_date: trip.end_date,
      currency: trip.currency,
    },
    places,
    days,
    reservations,
    packing,
  });
}

import {
  executeLangGraphTripPlanner,
  LangGraphTripPlannerError,
} from './langgraphTripPlanner';

export async function generateTripRecommendations(
  tripId: string | number,
  userId: number,
  lang?: string,
  budgetGoal?: string,
): Promise<TripAiRecommendationsResult> {
  try {
    return await executeLangGraphTripPlanner(tripId, userId, lang, budgetGoal);
  } catch (err: unknown) {
    if (err instanceof LangGraphTripPlannerError) {
      throw new AiRecommendationsError(err.status, err.message);
    }
    throw err;
  }
}

/** Test helper — clears the per-user cooldown map. */
export function resetAiRecommendationCooldown(): void {
  lastCallAt.clear();
}
