import { Injectable, Logger } from '@nestjs/common';
import { mlServiceClient, TripMlPredictionRequest, TripMlPredictionResponse } from '../../services/mlServiceClient';

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  async checkHealth(): Promise<any> {
    return mlServiceClient.checkHealth();
  }

  async predictTrip(payload: TripMlPredictionRequest): Promise<TripMlPredictionResponse> {
    this.logger.log(`Invoking ML prediction for ${payload.origin} -> ${payload.destination}`);
    return mlServiceClient.predictTrip(payload);
  }

  async predictCost(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.predictCost(payload);
  }

  async predictTransport(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.predictTransport(payload);
  }

  async predictHotel(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.predictHotel(payload);
  }

  async predictActivity(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.predictActivity(payload);
  }

  async getTransportOptions(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.getTransportOptions(payload);
  }

  async rankTransport(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.rankTransport(payload);
  }

  async calculateBudget(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.calculateBudget(payload);
  }

  async estimateTrip(payload: Record<string, any>): Promise<any> {
    this.logger.log(`Invoking trip estimation for ${payload.origin} -> ${payload.destination}`);
    return mlServiceClient.estimateTrip(payload);
  }

  async recommendHotels(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.recommendHotels(payload);
  }

  async recommendActivities(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.recommendActivities(payload);
  }

  async generateItinerary(payload: Record<string, any>): Promise<any> {
    this.logger.log(`Generating itinerary for ${payload.origin} -> ${payload.destination}`);
    return mlServiceClient.generateItinerary(payload);
  }

  async optimizeItinerary(payload: Record<string, any>): Promise<any> {
    return mlServiceClient.optimizeItinerary(payload);
  }

  async getOsrmRoute(coordinates: [number, number][], profile?: string): Promise<any> {
    return mlServiceClient.getOsrmRoute(coordinates, profile);
  }
}
