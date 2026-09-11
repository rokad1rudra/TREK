/**
 * ML Service Client for Node.js Express / NestJS Backend
 * Communicates with the Python FastAPI ML microservice via native fetch.
 * Zero external dependencies (avoids missing module errors in production containers).
 * Handles timeouts, structured error wrapping, and connection resilience.
 */

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
  private baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  }

  private async request(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errJson: any = await res.json();
          detail = errJson.detail || errJson.message || detail;
        } catch {}
        console.error(`[ML Client] Request failed: ${url} -> ${detail}`);
        throw new Error(detail);
      }

      return await res.json();
    } catch (err: any) {
      console.error(`[ML Client] Error in ${endpoint}:`, err?.message || err);
      throw err;
    }
  }

  /** Checks health status of Python ML microservice */
  async checkHealth(): Promise<any> {
    return this.request('/health', 'GET');
  }

  /**
   * Generates ML-driven trip prediction, cost optimization, transport/hotel ranking, and itinerary.
   */
  async predictTrip(payload: any): Promise<any> {
    return this.request('/plan', 'POST', payload);
  }

  /**
   * Master End-to-End AI Trip Planner
   * Handles natural language prompts or structured payloads through the 15-step pipeline.
   */
  async planMaster(payload: Record<string, any>): Promise<any> {
    console.log(`[ML Client] Requesting End-to-End AI Master Plan...`);
    return this.request('/plan', 'POST', payload);
  }

  /** Specialized Trip Cost Prediction */
  async predictCost(payload: Record<string, any>): Promise<any> {
    return this.request('/predict/trip-cost', 'POST', payload);
  }

  /** Specialized Transport Ranking */
  async predictTransport(payload: Record<string, any>): Promise<any> {
    return this.request('/predict/transport', 'POST', payload);
  }

  /** Specialized Hotel Ranking */
  async predictHotel(payload: Record<string, any>): Promise<any> {
    return this.request('/predict/hotel', 'POST', payload);
  }

  /** Specialized Activity Ranking */
  async predictActivity(payload: Record<string, any>): Promise<any> {
    return this.request('/predict/activity', 'POST', payload);
  }

  /** Generates candidate multimodal transport options */
  async getTransportOptions(payload: Record<string, any>): Promise<any> {
    return this.request('/transport/options', 'POST', payload);
  }

  /** Ranks transport options with configurable weight modes */
  async rankTransport(payload: Record<string, any>): Promise<any> {
    return this.request('/transport/rank', 'POST', payload);
  }

  /** Calculates detailed itemized budget across tiers and runs optimization */
  async calculateBudget(payload: Record<string, any>): Promise<any> {
    return this.request('/budget/calculate', 'POST', payload);
  }

  /** End-to-end trip estimation: OSRM + Transport Intelligence + Budget Engine + Optimization */
  async estimateTrip(payload: Record<string, any>): Promise<any> {
    console.log(`[ML Client] Estimating trip for ${payload.origin} -> ${payload.destination} (${payload.days} days, ₹${payload.budget})`);
    return this.request('/trip/estimate', 'POST', payload);
  }

  /** Recommends hotels and hostels across budget, mid-range, and premium tiers */
  async recommendHotels(payload: Record<string, any>): Promise<any> {
    return this.request('/recommend/hotels', 'POST', payload);
  }

  /** Recommends tourist sights and activities across 14 interest categories */
  async recommendActivities(payload: Record<string, any>): Promise<any> {
    return this.request('/recommend/activities', 'POST', payload);
  }

  /** Generates physics-consistent day-by-day itinerary with OSRM routing and opening hours */
  async generateItinerary(payload: Record<string, any>): Promise<any> {
    return this.request('/itinerary/generate', 'POST', payload);
  }

  /** Optimizes itinerary spatial sequence and road driving time */
  async optimizeItinerary(payload: Record<string, any>): Promise<any> {
    return this.request('/itinerary/optimize', 'POST', payload);
  }

  /** OSRM Route Query via Python ML Microservice */
  async getOsrmRoute(coordinates: [number, number][], profile: string = 'driving'): Promise<any> {
    return this.request('/osrm/route', 'POST', { coordinates, profile });
  }
}

export const mlServiceClient = new MlServiceClient();
