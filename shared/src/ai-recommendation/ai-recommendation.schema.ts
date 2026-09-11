import { z } from 'zod';

/**
 * AI trip-recommendation contract — POST /api/trips/:tripId/ai-recommendations
 * (Groq chat completions). The model must return this JSON object.
 */

export const tripAiRecommendationPlaceSchema = z.object({
  name: z.string().min(1),
  kind: z.string().optional(),
  why: z.string().optional(),
  suggestedDay: z.string().optional(),
});
export type TripAiRecommendationPlace = z.infer<typeof tripAiRecommendationPlaceSchema>;

export const tripAiRecommendationFoodSchema = z.object({
  name: z.string().min(1),
  why: z.string().optional(),
});
export type TripAiRecommendationFood = z.infer<typeof tripAiRecommendationFoodSchema>;

export const tripAiRecommendationPackingSchema = z.object({
  item: z.string().min(1),
  why: z.string().optional(),
});
export type TripAiRecommendationPacking = z.infer<typeof tripAiRecommendationPackingSchema>;

export const tripAiRecommendationDayIdeaSchema = z.object({
  day: z.string().min(1),
  idea: z.string().min(1),
});
export type TripAiRecommendationDayIdea = z.infer<typeof tripAiRecommendationDayIdeaSchema>;

export const tripAiRecommendationBudgetSuggestionSchema = z.object({
  category: z.string().min(1),
  budgetTip: z.string().min(1),
  potentialSavings: z.string().optional(),
});
export type TripAiRecommendationBudgetSuggestion = z.infer<typeof tripAiRecommendationBudgetSuggestionSchema>;

export const tripAiRecommendationCostSavingPlaceSchema = z.object({
  name: z.string().min(1),
  kind: z.string().optional(),
  why: z.string().optional(),
  suggestedDay: z.string().optional(),
  isFree: z.boolean().optional(),
  costEstimate: z.string().optional(),
});
export type TripAiRecommendationCostSavingPlace = z.infer<typeof tripAiRecommendationCostSavingPlaceSchema>;

export const tripAiRecommendationsResultSchema = z.object({
  summary: z.string(),
  budgetScore: z.string().optional(),
  budgetSuggestions: z.array(tripAiRecommendationBudgetSuggestionSchema).optional().default([]),
  costSavingPlaces: z.array(tripAiRecommendationCostSavingPlaceSchema).optional().default([]),
  places: z.array(tripAiRecommendationPlaceSchema),
  food: z.array(tripAiRecommendationFoodSchema),
  packing: z.array(tripAiRecommendationPackingSchema),
  tips: z.array(z.string()),
  dayIdeas: z.array(tripAiRecommendationDayIdeaSchema),
});
export type TripAiRecommendationsResult = z.infer<typeof tripAiRecommendationsResultSchema>;

export const tripAiRecommendationsRequestSchema = z.object({
  lang: z.string().min(1).max(16).optional(),
  budgetGoal: z.string().optional(),
});
export type TripAiRecommendationsRequest = z.infer<typeof tripAiRecommendationsRequestSchema>;
