import { describe, it, expect } from 'vitest';
import {
  tripAiRecommendationsRequestSchema,
  tripAiRecommendationsResultSchema,
} from './ai-recommendation.schema';

describe('tripAiRecommendationsRequestSchema', () => {
  it('accepts an empty body', () => {
    expect(tripAiRecommendationsRequestSchema.parse({})).toEqual({});
  });

  it('accepts a language code', () => {
    expect(tripAiRecommendationsRequestSchema.parse({ lang: 'de' })).toEqual({ lang: 'de' });
  });

  it('rejects an oversized lang', () => {
    expect(tripAiRecommendationsRequestSchema.safeParse({ lang: 'x'.repeat(20) }).success).toBe(false);
  });
});

describe('tripAiRecommendationsResultSchema', () => {
  it('accepts a full result', () => {
    const parsed = tripAiRecommendationsResultSchema.parse({
      summary: 'A long weekend in Kyoto.',
      places: [{ name: 'Fushimi Inari', kind: 'sight', why: 'Iconic', suggestedDay: 'Day 1' }],
      food: [{ name: 'Nishiki Market', why: 'Street snacks' }],
      packing: [{ item: 'Comfortable shoes', why: 'Lots of walking' }],
      tips: ['Buy an IC card'],
      dayIdeas: [{ day: 'Day 2', idea: 'Arashiyama in the morning' }],
    });
    expect(parsed.places[0].name).toBe('Fushimi Inari');
  });

  it('rejects a missing summary', () => {
    expect(
      tripAiRecommendationsResultSchema.safeParse({
        places: [],
        food: [],
        packing: [],
        tips: [],
        dayIdeas: [],
      }).success,
    ).toBe(false);
  });
});
