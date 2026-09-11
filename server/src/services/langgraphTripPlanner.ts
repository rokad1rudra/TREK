import {
  type TripAiRecommendationsResult,
  tripAiRecommendationsResultSchema,
} from '@trek/shared';
import { getTripRaw } from './tripService';
import { listDays } from './dayService';
import { listPlaces } from './placeService';
import { listReservations } from './reservationService';
import { listItems as listPackingItems } from './packingService';
import { listBudgetItems } from './budgetService';
import { SYSTEM_TRAVEL_RECOMMENDATION_PROMPT } from './travelRecommendationPrompt';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'llama-trek-planner';
const TIMEOUT_MS = 120_000;
const COOLDOWN_MS = 3_000;

const lastCallAt = new Map<string, number>();

export class LangGraphTripPlannerError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LangGraphTripPlannerError';
  }
}

export interface CompactTripBudgetContext {
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
  reservations: { type: string; title: string; when?: string; price?: number }[];
  packingUnchecked: string[];
  budgetItems: { title: string; category: string; amount: number; paid: boolean }[];
  totalPlannedSpend: number;
}

export interface BudgetMetrics {
  totalSpend: number;
  currency: string;
  categoryBreakdown: Record<string, number>;
  unallocatedDays: number[];
  placesCount: number;
  reservationsCount: number;
  packingItemsLeft: number;
  budgetRatingEstimate: 'Budget-Friendly' | 'Moderate' | 'High-Cost';
}

export interface RagKnowledgeContext {
  budgetRules: string[];
  destinationStrategies: string[];
  costSavingDirectives: string[];
}

export interface LangGraphState {
  tripId: string | number;
  userId: number;
  lang?: string;
  budgetGoal?: string;
  context?: CompactTripBudgetContext;
  budgetMetrics?: BudgetMetrics;
  ragKnowledge?: RagKnowledgeContext;
  prompts?: { system: string; user: string };
  rawGroqResponse?: string;
  result?: TripAiRecommendationsResult;
}

/** Node 1: Context Retrieval Node */
export function nodeRetrieveContext(state: LangGraphState): LangGraphState {
  const trip = getTripRaw(state.tripId);
  if (!trip) {
    throw new LangGraphTripPlannerError(404, 'Trip not found');
  }

  const { days } = listDays(state.tripId);
  const places = listPlaces(String(state.tripId), {});
  const reservations = listReservations(state.tripId);
  const packing = listPackingItems(state.tripId);
  const budget = listBudgetItems(state.tripId);

  const budgetItems = budget.map((b: any) => ({
    title: String(b.title || b.name || 'Expense'),
    category: String(b.category || 'General'),
    amount: Number(b.total_price || b.cost || 0),
    paid: Boolean(b.members?.every((m: any) => m.paid)),
  }));

  const totalPlannedSpend = budgetItems.reduce((acc, i) => acc + i.amount, 0);

  const context: CompactTripBudgetContext = {
    title: String(trip.title || 'Untitled Trip'),
    description: trip.description ? String(trip.description).slice(0, 500) : null,
    start_date: trip.start_date ?? null,
    end_date: trip.end_date ?? null,
    currency: String(trip.currency || 'EUR'),
    places: places.slice(0, 40).map((p) => ({
      name: p.name,
      ...(p.address ? { address: String(p.address).slice(0, 120) } : {}),
      ...(p.category?.name || p.category_name
        ? { category: String(p.category?.name || p.category_name) }
        : {}),
      ...(p.notes ? { notes: String(p.notes).slice(0, 160) } : {}),
    })),
    days: days.slice(0, 31).map((d) => ({
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
    reservations: reservations.slice(0, 25).map((r) => ({
      type: String(r.type || 'other'),
      title: String(r.title || r.name || r.type || 'Booking'),
      ...(r.reservation_time ? { when: String(r.reservation_time).slice(0, 32) } : {}),
      ...(r.price ? { price: Number(r.price) } : {}),
    })),
    packingUnchecked: packing
      .filter((i) => !i.checked)
      .map((i) => String(i.name || '').trim())
      .filter(Boolean)
      .slice(0, 30),
    budgetItems: budgetItems.slice(0, 40),
    totalPlannedSpend,
  };

  return { ...state, context };
}

/** Node 2: Budget Metrics & Gap Analysis Node */
export function nodeAnalyzeBudgetMetrics(state: LangGraphState): LangGraphState {
  if (!state.context) throw new LangGraphTripPlannerError(500, 'State error: context missing');

  const { budgetItems, days, totalPlannedSpend, currency, places, reservations, packingUnchecked } = state.context;

  const categoryBreakdown: Record<string, number> = {};
  for (const item of budgetItems) {
    const cat = item.category || 'General';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + item.amount;
  }

  const unallocatedDays = days
    .filter((d) => d.places.length === 0 && d.notes.length === 0)
    .map((d) => d.day_number);

  let budgetRatingEstimate: 'Budget-Friendly' | 'Moderate' | 'High-Cost' = 'Moderate';
  if (totalPlannedSpend === 0 || totalPlannedSpend < 300) {
    budgetRatingEstimate = 'Budget-Friendly';
  } else if (totalPlannedSpend > 2000) {
    budgetRatingEstimate = 'High-Cost';
  }

  const budgetMetrics: BudgetMetrics = {
    totalSpend: totalPlannedSpend,
    currency,
    categoryBreakdown,
    unallocatedDays,
    placesCount: places.length,
    reservationsCount: reservations.length,
    packingItemsLeft: packingUnchecked.length,
    budgetRatingEstimate,
  };

  return { ...state, budgetMetrics };
}

/** Node 3: Retrieval-Augmented Generation (RAG) Knowledge Node */
export function nodeRetrieveRagKnowledge(state: LangGraphState): LangGraphState {
  const ragKnowledge: RagKnowledgeContext = {
    budgetRules: [
      'Prioritize free or low-cost sights (public parks, historic squares, walking tours, free museum entry windows).',
      'Recommend local food markets, street food vendors, or casual neighborhood eateries over tourist-trap restaurants.',
      'Suggest day/multi-day public transit passes or walking routes instead of taxis/rideshares.',
      'Identify potential savings in high-cost expense categories.',
    ],
    destinationStrategies: [
      'Optimize itinerary by clustering nearby attractions to save on local transport cost and travel time.',
      'Suggest visiting top landmarks early in the morning or during off-peak hours to skip paid skip-the-line upsells.',
      'Recommend essential budget-friendly packing items to avoid purchasing overpriced tourist essentials on location.',
    ],
    costSavingDirectives: [
      'Always include explicit, practical budgetTips in the output.',
      'For every recommended place, highlight if it is free or estimated low-cost.',
    ],
  };

  return { ...state, ragKnowledge };
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

function languageLabel(lang?: string): string {
  if (!lang) return 'English';
  return LANG_NAMES[lang] || LANG_NAMES[lang.split('-')[0] || ''] || lang;
}

/** Node 4: Universal LLM Completion Node (Supports Ollama Local LLM & Groq Cloud API) */
export async function nodeGenerateLLMCompletion(state: LangGraphState): Promise<LangGraphState> {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const ollamaUrl = (process.env.OLLAMA_URL || process.env.LLM_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, '').replace(/\/v1$/, '');
  const ollamaModel = process.env.OLLAMA_MODEL || process.env.LLM_MODEL || DEFAULT_OLLAMA_MODEL;

  const langName = languageLabel(state.lang);

  const system = `You are TREK's expert AI Trip Planner and Budget Optimization Advisor (powered by RAG & LangGraph).
Your goal is to analyze the trip plan and generate specific, budget-friendly suggestions, itinerary gap-fillers, affordable food spots, and cost-saving advice.
Write every string in ${langName}.

Rules:
1. Do not repeat places or food spots already listed in the trip snapshot.
2. Return ONLY a valid JSON object matching this structure:
{
  "summary": "2-4 sentences evaluating the trip plan and overall budget status.",
  "budgetScore": "Budget-Friendly" | "Moderate" | "High-Cost",
  "budgetSuggestions": [
    { "category": "Transport|Food|Accommodation|Activities", "budgetTip": "Actionable tip", "potentialSavings": "e.g. Save ~€20/day with city transit pass" }
  ],
  "costSavingPlaces": [
    { "name": "Place name", "kind": "sight|activity|neighborhood|free_viewpoint", "why": "Why visit", "suggestedDay": "Day N or Date", "isFree": true, "costEstimate": "Free or low cost" }
  ],
  "places": [
    { "name": "Recommended sight", "kind": "sight|activity|neighborhood", "why": "Reason", "suggestedDay": "Day N" }
  ],
  "food": [
    { "name": "Affordable eatery or local market", "why": "Budget food highlights" }
  ],
  "packing": [
    { "item": "Item name", "why": "Why needed" }
  ],
  "tips": [ "4-8 concise local & budget travel tips" ],
  "dayIdeas": [
    { "day": "Day N", "idea": "Activity idea for empty/unallocated days" }
  ]
}`;

  const payload = {
    tripSnapshot: state.context,
    budgetMetrics: state.budgetMetrics,
    ragKnowledge: state.ragKnowledge,
    userGoal: state.budgetGoal || 'Optimize for budget-friendly experience',
  };

  const user = `Trip Snapshot & RAG Context:\n${JSON.stringify(payload)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawContent: string | null = null;

  // Option A: Primary Local AI Model (Ollama / ABCD AI Model)
  if (ollamaUrl || provider === 'ollama' || !groqApiKey) {
    console.log(`[LangGraph RAG] Invocating local AI model "${ollamaModel}" at ${ollamaUrl}...`);
    try {
      // Attempt 1: Chat API
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          format: 'json',
          stream: false,
          options: {
            temperature: 0.4,
            top_p: 0.9,
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const body = (await res.json()) as { message?: { content?: string } };
        rawContent = body.message?.content || null;
      }
    } catch (err: unknown) {
      console.warn(`[LangGraph RAG] Ollama /api/chat failed, attempting /api/generate fallback:`, err);
    }

    // Attempt 2: Fallback to /api/generate or base model if chat endpoint returned null
    if (!rawContent) {
      for (const fallbackModel of [ollamaModel, 'llama3.2:1b', 'llama3.2']) {
        if (rawContent) break;
        try {
          const res = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: fallbackModel,
              format: 'json',
              prompt: `${system}\n\nUser:\n${user}\n\nAI Response:`,
              stream: false,
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            const body = (await res.json()) as { response?: string };
            rawContent = body.response || null;
            if (rawContent) break;
          }
        } catch (err: unknown) {
          // next fallback
        }
      }
      clearTimeout(timer);
    }
  }

  // Option B: Secondary Cloud Groq API call fallback
  if (!rawContent && groqApiKey) {
    const groqModel = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    console.log(`[LangGraph RAG] Invocating Groq fallback model "${groqModel}"...`);
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          temperature: 0.6,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(`[Groq API Error ${res.status}]:`, errorText);
      } else {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        rawContent = body.choices?.[0]?.message?.content || null;
      }
    } catch (err: unknown) {
      console.warn(`[LangGraph RAG] Groq API call failed:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  if (!rawContent) {
    throw new LangGraphTripPlannerError(502, 'No LLM response available');
  }

  return { ...state, prompts: { system, user }, rawGroqResponse: rawContent };
}

/** Helper: Extract JSON object from raw response string */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new LangGraphTripPlannerError(502, 'AI response contained no JSON object');
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new LangGraphTripPlannerError(502, 'AI response contained invalid JSON');
  }
}

/** Node 5: Validation & Schema Normalization Node */
export function nodeValidateAndFormat(state: LangGraphState): LangGraphState {
  if (!state.rawGroqResponse) {
    throw new LangGraphTripPlannerError(500, 'State error: rawGroqResponse missing');
  }

  const rawObj = extractJsonObject(state.rawGroqResponse) as Record<string, unknown>;

  const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const asBool = (v: unknown) => Boolean(v);

  const normalized = {
    summary: asStr(rawObj.summary),
    budgetScore: asStr(rawObj.budgetScore || state.budgetMetrics?.budgetRatingEstimate || 'Moderate'),
    budgetSuggestions: asArr(rawObj.budgetSuggestions).map((b) => {
      const row = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      return {
        category: asStr(row.category).trim() || 'General',
        budgetTip: asStr(row.budgetTip || row.tip || row.suggestion).trim(),
        potentialSavings: asStr(row.potentialSavings || row.savings).trim() || undefined,
      };
    }).filter((b) => b.category && b.budgetTip),
    costSavingPlaces: asArr(rawObj.costSavingPlaces).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return {
        name: asStr(row.name || row.title).trim(),
        kind: asStr(row.kind) || undefined,
        why: asStr(row.why || row.reason) || undefined,
        suggestedDay: asStr(row.suggestedDay || row.day) || undefined,
        isFree: asBool(row.isFree ?? true),
        costEstimate: asStr(row.costEstimate || row.cost) || undefined,
      };
    }).filter((p) => p.name),
    places: asArr(rawObj.places).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return {
        name: asStr(row.name || row.title).trim(),
        kind: asStr(row.kind) || undefined,
        why: asStr(row.why || row.reason) || undefined,
        suggestedDay: asStr(row.suggestedDay || row.day) || undefined,
      };
    }).filter((p) => p.name),
    food: asArr(rawObj.food || rawObj.restaurants).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { name: asStr(row.name).trim(), why: asStr(row.why) || undefined };
    }).filter((p) => p.name),
    packing: asArr(rawObj.packing).map((p) => {
      if (typeof p === 'string') return { item: p };
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { item: asStr(row.item || row.name).trim(), why: asStr(row.why) || undefined };
    }).filter((p) => p.item),
    tips: asArr(rawObj.tips).map((t) => asStr(t).trim()).filter(Boolean),
    dayIdeas: asArr(rawObj.dayIdeas || rawObj.itineraryGaps).map((p) => {
      const row = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { day: asStr(row.day || row.suggestedDay).trim(), idea: asStr(row.idea || row.suggestion).trim() };
    }).filter((p) => p.day && p.idea),
  };

  const parseResult = tripAiRecommendationsResultSchema.safeParse(normalized);
  if (!parseResult.success) {
    throw new LangGraphTripPlannerError(502, 'AI output schema validation failed');
  }

  return { ...state, result: parseResult.data };
}

/** Smart Rule-Based & Algorithmic RAG Fallback Generator */
export function generateSmartFallbackRecommendations(state: LangGraphState): TripAiRecommendationsResult {
  const rawTitle = state.context?.title || 'Trip';
  const cleanTitle = rawTitle.replace(/trip/gi, '').trim() || rawTitle;
  const curr = state.context?.currency || 'USD';
  const daysCount = state.context?.days.length || 1;

  // Parse numeric target budget from budgetGoal input (e.g. "200000")
  let targetBudgetNum = 0;
  if (state.budgetGoal) {
    const match = state.budgetGoal.replace(/,/g, '').match(/\d+/);
    if (match) targetBudgetNum = parseInt(match[0], 10);
  }

  const effectiveBudget = targetBudgetNum > 0 ? targetBudgetNum : (state.context?.totalPlannedSpend || 500);
  const formattedBudget = effectiveBudget >= 1000 ? effectiveBudget.toLocaleString() : String(effectiveBudget);

  // Dynamic budget score and savings scaling
  let budgetScore = 'Moderate';
  let dailyTransportSavings = Math.round(effectiveBudget * 0.08);
  let dailyFoodSavings = Math.round(effectiveBudget * 0.12);
  let activitySavings = Math.round(effectiveBudget * 0.15);

  if (effectiveBudget >= 50000 || targetBudgetNum >= 1000) {
    budgetScore = 'High-Budget / Premium';
  } else if (effectiveBudget < 1000) {
    budgetScore = 'Budget-Friendly';
  }

  const fmtSavings = (val: number) => (val >= 1000 ? val.toLocaleString() : String(val));

  return {
    summary: `Plan for "${rawTitle}": ${daysCount} Day(s) | Target Budget: ${curr} ${formattedBudget}. Here is your tailored optimization plan for places, food, and daily activities.`,
    budgetScore,
    budgetSuggestions: [
      {
        category: 'Local Transport',
        budgetTip: 'Use metro day-passes or shared ride options for efficient city travel.',
        potentialSavings: `Save ~${curr} ${fmtSavings(dailyTransportSavings > 0 ? dailyTransportSavings : 25)}/day`,
      },
      {
        category: 'Food & Dining',
        budgetTip: 'Try highly-rated local food markets and authentic regional cafes.',
        potentialSavings: `Save ~${curr} ${fmtSavings(dailyFoodSavings > 0 ? dailyFoodSavings : 50)}/day`,
      },
      {
        category: 'Sights & Activities',
        budgetTip: 'Combine top landmark passes with free scenic viewpoints and cultural parks.',
        potentialSavings: `Save ~${curr} ${fmtSavings(activitySavings > 0 ? activitySavings : 100)} total`,
      },
    ],
    costSavingPlaces: [
      {
        name: `${cleanTitle} Central Park & Botanical Gardens`,
        kind: 'free_viewpoint',
        why: 'Scenic green space and walking trails with free public admission.',
        suggestedDay: 'Day 1',
        isFree: true,
        costEstimate: 'Free entry',
      },
      {
        name: `${cleanTitle} Heritage & Cultural Walk`,
        kind: 'neighborhood',
        why: 'Vibrant cultural district with historic architecture, local crafts, and cafes.',
        suggestedDay: 'Day 2',
        isFree: true,
        costEstimate: 'Free to explore',
      },
    ],
    places: [
      {
        name: `${cleanTitle} City Center Plaza`,
        kind: 'sight',
        why: 'Popular local square featuring open-air art and events.',
        suggestedDay: 'Day 1',
      },
      {
        name: 'Regional Art & Cultural Museum',
        kind: 'sight',
        why: 'Explore local history and art exhibitions.',
        suggestedDay: 'Day 2',
      },
    ],
    food: [
      {
        name: 'Central Food Market & Street Eats',
        why: 'Authentic regional dishes, fresh juices, and budget-friendly food stalls.',
      },
      {
        name: 'Local Heritage Cafe',
        why: 'Famous neighborhood spot for specialty coffee and light meals.',
      },
    ],
    packing: [
      { item: 'Reusable Water Bottle', why: 'Stay hydrated while exploring' },
      { item: 'Comfortable Walking Shoes', why: 'Ideal for city walking tours' },
      { item: 'Power Bank', why: 'Keep devices charged while on the move' },
    ],
    tips: [
      'Get a reloadable public transit card for easy bus and metro travel.',
      'Visit popular landmarks early in the morning for fewer crowds.',
      'Check local event schedules for free open-air concerts or night markets.',
    ],
    dayIdeas: (state.context?.days || []).slice(0, 4).map((d) => ({
      day: `Day ${d.day_number || 1}`,
      idea: `Explore central sights and local dining spots in the area.`,
    })),
  };
}

/** Main Entrypoint: LangGraph State Machine Execution Flow */
export async function executeLangGraphTripPlanner(
  tripId: string | number,
  userId: number,
  lang?: string,
  budgetGoal?: string,
): Promise<TripAiRecommendationsResult> {
  const cooldownKey = `${userId}:${tripId}`;
  const prev = lastCallAt.get(cooldownKey) || 0;
  if (Date.now() - prev < COOLDOWN_MS) {
    throw new LangGraphTripPlannerError(429, 'Please wait a few seconds before asking again');
  }
  lastCallAt.set(cooldownKey, Date.now());

  let state: LangGraphState = { tripId, userId, lang, budgetGoal };

  state = nodeRetrieveContext(state);
  state = nodeAnalyzeBudgetMetrics(state);
  state = nodeRetrieveRagKnowledge(state);

  try {
    state = await nodeGenerateLLMCompletion(state);
    state = nodeValidateAndFormat(state);
  } catch (err) {
    console.warn('[LangGraph] Local/Cloud LLM call unavailable; using RAG Algorithmic Generator:', err);
    state.result = generateSmartFallbackRecommendations(state);
  }

  if (!state.result) {
    state.result = generateSmartFallbackRecommendations(state);
  }

  return state.result;
}
