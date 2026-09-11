import { Injectable } from '@nestjs/common';
import { canAccessTrip } from '../../db/database';
import { generateTripRecommendations } from '../../services/aiRecommendationsService';
import type { TripAiRecommendationsResult } from '@trek/shared';

@Injectable()
export class AiRecommendationsService {
  canAccessTrip(tripId: string, userId: number) {
    return canAccessTrip(tripId, userId);
  }

  generate(tripId: string, userId: number, lang?: string, budgetGoal?: string): Promise<TripAiRecommendationsResult> {
    return generateTripRecommendations(tripId, userId, lang, budgetGoal);
  }
}
