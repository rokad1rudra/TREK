import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { MlService } from './ml.service';
import type { TripMlPredictionRequest } from '../../services/mlServiceClient';

@Controller('api/ml')
export class MlController {
  constructor(private readonly mlService: MlService) {}

  @Get('health')
  async health() {
    try {
      return await this.mlService.checkHealth();
    } catch (err: unknown) {
      throw new HttpException(
        { error: 'ML Microservice is offline or unreachable', detail: String(err) },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('predict')
  @HttpCode(200)
  async predict(@Body() body: TripMlPredictionRequest) {
    if (!body || !body.origin || !body.destination) {
      throw new HttpException({ error: 'Origin and Destination are required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.predictTrip(body);
    } catch (err: unknown) {
      throw new HttpException(
        { error: 'Failed to generate ML prediction', detail: String(err) },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('plan')
  @HttpCode(200)
  async plan(@Body() body: TripMlPredictionRequest) {
    return this.predict(body);
  }

  // ── PART 2 Transport Intelligence ──

  @Post('transport/options')
  @HttpCode(200)
  async getTransportOptions(@Body() body: Record<string, any>) {
    if (!body || !body.origin || !body.destination) {
      throw new HttpException({ error: 'Origin and Destination are required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.getTransportOptions(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to generate transport options', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('transport/rank')
  @HttpCode(200)
  async rankTransport(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.rankTransport(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to rank transport options', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── PART 2 Budget Engine & Optimization ──

  @Post('budget/calculate')
  @HttpCode(200)
  async calculateBudget(@Body() body: Record<string, any>) {
    if (!body || !body.origin || !body.destination) {
      throw new HttpException({ error: 'Origin and Destination are required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.calculateBudget(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to calculate budget', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── PART 2 Comprehensive Trip Estimate ──

  @Post('trip/estimate')
  @HttpCode(200)
  async estimateTrip(@Body() body: Record<string, any>) {
    if (!body || !body.origin || !body.destination) {
      throw new HttpException({ error: 'Origin and Destination are required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.estimateTrip(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to estimate trip', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── PART 3 Hotel & Hostel Recommendations ──

  @Post('recommend/hotels')
  @HttpCode(200)
  async recommendHotels(@Body() body: Record<string, any>) {
    if (!body || !body.destination) {
      throw new HttpException({ error: 'Destination is required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.recommendHotels(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to recommend hotels', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── PART 3 Activity Recommendations ──

  @Post('recommend/activities')
  @HttpCode(200)
  async recommendActivities(@Body() body: Record<string, any>) {
    if (!body || !body.destination) {
      throw new HttpException({ error: 'Destination is required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.recommendActivities(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to recommend activities', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── PART 3 Itinerary Generation & Optimization ──

  @Post('itinerary/generate')
  @HttpCode(200)
  async generateItinerary(@Body() body: Record<string, any>) {
    if (!body || !body.origin || !body.destination) {
      throw new HttpException({ error: 'Origin and Destination are required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.mlService.generateItinerary(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to generate itinerary', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('itinerary/optimize')
  @HttpCode(200)
  async optimizeItinerary(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.optimizeItinerary(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Failed to optimize itinerary', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── Specialized Predictive Models ──

  @Post('cost')
  @HttpCode(200)
  async predictCost(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.predictCost(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Cost prediction failed', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('transport')
  @HttpCode(200)
  async predictTransport(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.predictTransport(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Transport ranking failed', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('hotel')
  @HttpCode(200)
  async predictHotel(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.predictHotel(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Hotel ranking failed', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('activity')
  @HttpCode(200)
  async predictActivity(@Body() body: Record<string, any>) {
    try {
      return await this.mlService.predictActivity(body);
    } catch (err: unknown) {
      throw new HttpException({ error: 'Activity ranking failed', detail: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
