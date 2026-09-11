/**
 * Travel Recommendation Assistant Prompt Template & RAG Rules
 * Preserves the exact user system instructions for Next Best Move recommendations.
 */

export interface TravelRecommendationInput {
  current_location?: string;
  preferences?: string; // e.g. "adventure, budget-friendly, solo"
  duration?: string;
  budget?: string;
  history?: string[];
  season_or_date?: string;
}

export interface TravelRecommendationOption {
  rank: number;
  destination: string;
  reasoning: string; // Max 20 words per option
  needs_live_data: boolean;
}

export interface TravelRecommendationResponse {
  assumptions: string;
  options: TravelRecommendationOption[];
}

export const SYSTEM_TRAVEL_RECOMMENDATION_PROMPT = `You are a travel recommendation assistant embedded in a website. 
Your job is to suggest the best "next move" (destination, activity, or route) 
for a traveler based on their current location, preferences, and travel history.

Rules:
- Always respond in valid JSON only, no extra text, no markdown formatting.
- Suggest exactly 3 options, ranked by best fit.
- Keep reasoning short (max 20 words per option).
- If budget or time constraints are given, respect them strictly.
- If information is missing, make a reasonable assumption and state it in "assumptions".
- Never invent real-time data (flight prices, live weather) — flag these as "needs_live_data": true when relevant.`;

export function formatTravelPromptUserPayload(input: TravelRecommendationInput): string {
  return `Current location: ${input.current_location || 'Delhi NCR / Noida'}
Travel preferences: ${input.preferences || 'adventure, budget-friendly, solo'}
Trip duration: ${input.duration || '3 days'}
Budget: ${input.budget || 'IDR 200,000 / $200'}
Past visited places: ${JSON.stringify(input.history || [])}
Time of year: ${input.season_or_date || 'Autumn / Winter'}

Task: Suggest the next best travel move (destination or activity) for this user.`;
}
