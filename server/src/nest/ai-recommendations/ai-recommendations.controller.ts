import { Body, Controller, HttpException, Param, Post, UseGuards } from '@nestjs/common';
import type { TripAiRecommendationsRequest, TripAiRecommendationsResult } from '@trek/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../types';
import { AiRecommendationsService } from './ai-recommendations.service';
import { AiRecommendationsError } from '../../services/aiRecommendationsService';

/**
 * POST /api/trips/:tripId/ai-recommendations
 * Builds a compact snapshot of the trip and asks Groq for itinerary ideas.
 */
@Controller('api/trips/:tripId/ai-recommendations')
@UseGuards(JwtAuthGuard)
export class AiRecommendationsController {
  constructor(private readonly recs: AiRecommendationsService) {}

  @Post()
  async generate(
    @CurrentUser() user: User,
    @Param('tripId') tripId: string,
    @Body() body: TripAiRecommendationsRequest,
  ): Promise<TripAiRecommendationsResult> {
    if (!this.recs.canAccessTrip(tripId, user.id)) {
      throw new HttpException({ error: 'Trip not found' }, 404);
    }
    try {
      return await this.recs.generate(tripId, user.id, body?.lang, body?.budgetGoal);
    } catch (err: unknown) {
      if (err instanceof AiRecommendationsError) {
        throw new HttpException({ error: err.message }, err.status);
      }
      console.error('AI recommendations error:', err);
      throw new HttpException({ error: 'Error generating recommendations' }, 500);
    }
  }
}
