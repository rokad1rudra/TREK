/**
 * ML Service Client for Node.js Express / NestJS Backend
 * Communicates with the internal Python FastAPI ML microservice.
 * Handles timeouts, structured error wrapping, and connection resilience.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface TripMlPredictionRequest {
  origin: string;
  destination: string;
  people?: number;
  days?: number;
  budget?: number;
  travel_pace?: 'relaxed' | 'balanced' | 'explorer';
  interests?: string;
  transit_mode?: string;
  budget_tier?: 'budget' | 'comfort' | 'luxury';
  season?: string;
  start_date?: string;
  origin_coords?: [number, number];
  dest_coords?: [number, number];
}

export interface TripMlPredictionResponse {
  trip_title: string;
  origin: string;
  destination: string;
  zone: string;
  people: number;
  days_count: number;
  total_distance_km: number;
  driving_hours: number;
  recommended_mode: string;
  estimated_total_cost: number;
  cost_per_person: number;
  cost_breakdown: {
    stay: number;
    food: number;
    travel: number;
    activities: number;
    buffer: number;
  };
  ranked_transports: Array<{
    id: string;
    title: string;
    type: string;
    score: number;
    rank: number;
    tag: string;
    tag_color: string;
    price_per_person: number;
    total_cost_for_group: number;
    duration_formatted: string;
    duration_hours: number;
    description: string;
  }>;
  recommended_hotels: Array<{
    id: string;
    name: string;
    tier: string;
    score: number;
    rank: number;
    price_per_night: number;
    per_person_price: number;
    rating: number;
    review_count: number;
    amenities: string[];
    area: string;
    booking_url: string;
    google_hotels_url: string;
  }>;
  recommended_activities: Array<{
    id: string;
    title: string;
    category: string;
    score: number;
    rank: number;
    est_cost: number;
    duration: string;
    rating: number;
    description: string;
  }>;
  itinerary_days: Array<{
    day_number: number;
    title: string;
    theme: string;
    spots: Array<{
      name: string;
      time: string;
      period: string;
      description: string;
      lat: number;
      lng: number;
      cost_est: number;
      category: string;
      transit_from_prev?: string;
    }>;
    daily_cost: number;
    pro_tip: string;
  }>;
  highlights: string[];
  model_version: string;
}

export class MlServiceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 seconds timeout for full multi-day itinerary synthesis
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /** Checks health status of Python ML microservice */
  async checkHealth(): Promise<any> {
    try {
      const res = await this.client.get('/health');
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'checkHealth');
      throw err;
    }
  }

  /**
   * Generates ML-driven trip prediction, cost optimization, transport/hotel ranking, and itinerary.
   */
  async predictTrip(payload: any): Promise<any> {
    try {
      // Route to master /plan if message is provided or standard payload
      const res = await this.client.post('/plan', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'predictTrip');
      throw err;
    }
  }

  /**
   * Master End-to-End AI Trip Planner
   * Handles natural language prompts or structured payloads through the 15-step pipeline.
   */
  async planMaster(payload: Record<string, any>): Promise<any> {
    try {
      console.log(`[ML Client] Requesting End-to-End AI Master Plan...`);
      const res = await this.client.post('/plan', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'planMaster');
      throw err;
    }
  }

  /** Specialized Trip Cost Prediction */
  async predictCost(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/predict/trip-cost', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'predictCost');
      throw err;
    }
  }

  /** Specialized Transport Ranking */
  async predictTransport(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/predict/transport', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'predictTransport');
      throw err;
    }
  }

  /** Specialized Hotel Ranking */
  async predictHotel(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/predict/hotel', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'predictHotel');
      throw err;
    }
  }

  /** Specialized Activity Ranking */
  async predictActivity(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/predict/activity', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'predictActivity');
      throw err;
    }
  }

  /** Generates candidate multimodal transport options */
  async getTransportOptions(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/transport/options', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'getTransportOptions');
      throw err;
    }
  }

  /** Ranks transport options with configurable weight modes */
  async rankTransport(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/transport/rank', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'rankTransport');
      throw err;
    }
  }

  /** Calculates detailed itemized budget across tiers and runs optimization */
  async calculateBudget(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/budget/calculate', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'calculateBudget');
      throw err;
    }
  }

  /** End-to-end trip estimation: OSRM + Transport Intelligence + Budget Engine + Optimization */
  async estimateTrip(payload: Record<string, any>): Promise<any> {
    try {
      console.log(`[ML Client] Estimating trip for ${payload.origin} -> ${payload.destination} (${payload.days} days, ₹${payload.budget})`);
      const res = await this.client.post('/trip/estimate', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'estimateTrip');
      throw err;
    }
  }

  /** Recommends hotels and hostels across budget, mid-range, and premium tiers */
  async recommendHotels(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/recommend/hotels', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'recommendHotels');
      throw err;
    }
  }

  /** Recommends tourist sights and activities across 14 interest categories */
  async recommendActivities(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/recommend/activities', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'recommendActivities');
      throw err;
    }
  }

  /** Generates physics-consistent day-by-day itinerary with OSRM routing and opening hours */
  async generateItinerary(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/itinerary/generate', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'generateItinerary');
      throw err;
    }
  }

  /** Optimizes itinerary spatial sequence and road driving time */
  async optimizeItinerary(payload: Record<string, any>): Promise<any> {
    try {
      const res = await this.client.post('/itinerary/optimize', payload);
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'optimizeItinerary');
      throw err;
    }
  }

  /** OSRM Route Query via Python ML Microservice */
  async getOsrmRoute(coordinates: [number, number][], profile: string = 'driving'): Promise<any> {
    try {
      const res = await this.client.post('/osrm/route', { coordinates, profile });
      return res.data;
    } catch (err: unknown) {
      this.handleError(err, 'getOsrmRoute');
      throw err;
    }
  }

  private handleError(err: unknown, method: string) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail || axiosErr.message;
      console.error(`[ML Client] Error in ${method} (Status ${status}): ${detail}`);
    } else {
      console.error(`[ML Client] Unexpected error in ${method}:`, err);
    }
  }
}

export const mlServiceClient = new MlServiceClient();
