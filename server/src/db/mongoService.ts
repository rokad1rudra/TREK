import { MongoClient, Db, Collection } from 'mongodb';

export interface AiItineraryDoc {
  trip_id: number | string;
  trip_title: string;
  origin: string;
  destination: string;
  zone: string;
  total_distance_km: number;
  driving_hours: number;
  recommended_mode: string;
  budget_estimate: number;
  currency: string;
  weather?: {
    temp: number;
    feels_like: number;
    condition: string;
    rain_prob: number;
    advisory: string;
  };
  famous_foods?: string[];
  days: Array<{
    day_number: number;
    title: string;
    theme: string;
    daily_cost: number;
    pro_tip: string;
    spots: Array<{
      name: string;
      time: string;
      period: string;
      description: string;
      lat: number;
      lng: number;
      category: string;
      cost_est: number;
      transit_from_prev?: string;
    }>;
  }>;
  ai_model: string;
  created_at: Date;
  updated_at: Date;
}

export interface WeatherSnapshotDoc {
  key: string;
  lat: number;
  lng: number;
  data: any;
  cached_at: Date;
  expires_at: Date;
}

export interface RouteCacheDoc {
  key: string;
  mode: string;
  waypoints: Array<{ lat: number; lng: number }>;
  distance_km: number;
  duration_seconds: number;
  geometry: [number, number][];
  cached_at: Date;
}

export interface AiChatSessionDoc {
  session_id: string;
  user_id?: number | string;
  trip_id?: number | string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnecting = false;
let lastFailedAttempt = 0;
const RETRY_COOLDOWN_MS = 30000; // 30s cooldown before retrying failed connection

export async function getMongoDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (db && client) return db;

  // Don't hammer failing connection synchronously
  const now = Date.now();
  if (lastFailedAttempt && now - lastFailedAttempt < RETRY_COOLDOWN_MS) {
    return null;
  }

  if (isConnecting) {
    // Wait briefly if connection is in progress
    await new Promise((r) => setTimeout(r, 200));
    if (db) return db;
    return null;
  }

  try {
    isConnecting = true;
    const dbName = process.env.MONGODB_DATABASE || 'trek';
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    await client.connect();
    db = client.db(dbName);
    lastFailedAttempt = 0;

    // Initialize TTL indexes for auto-expiring cache asynchronously
    const weatherColl = db.collection<WeatherSnapshotDoc>('weather_snapshots');
    weatherColl.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    weatherColl.createIndex({ key: 1 }, { unique: true }).catch(() => {});

    const itineraryColl = db.collection<AiItineraryDoc>('ai_itineraries');
    itineraryColl.createIndex({ trip_id: 1 }).catch(() => {});

    const routeColl = db.collection<RouteCacheDoc>('route_cache');
    routeColl.createIndex({ key: 1 }, { unique: true }).catch(() => {});

    const genericColl = db.collection('generic_cache');
    genericColl.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    genericColl.createIndex({ key: 1 }, { unique: true }).catch(() => {});

    console.log(`[MongoDB Atlas] Connected successfully to cluster database: "${dbName}"`);
    return db;
  } catch (err) {
    lastFailedAttempt = Date.now();
    client = null;
    db = null;
    console.warn(`[MongoDB Atlas] Connection fallback mode (retry in 30s):`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    isConnecting = false;
  }
}

export async function saveAiItinerary(doc: Omit<AiItineraryDoc, 'created_at' | 'updated_at'>): Promise<boolean> {
  try {
    const database = await getMongoDb();
    if (!database) return false;

    const coll = database.collection<AiItineraryDoc>('ai_itineraries');
    await coll.updateOne(
      { trip_id: doc.trip_id },
      {
        $set: {
          ...doc,
          updated_at: new Date(),
        },
        $setOnInsert: {
          created_at: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('[MongoDB Atlas] Error saving AI itinerary:', err);
    return false;
  }
}

export async function getAiItinerary(tripId: number | string): Promise<AiItineraryDoc | null> {
  try {
    const database = await getMongoDb();
    if (!database) return null;

    const coll = database.collection<AiItineraryDoc>('ai_itineraries');
    return await coll.findOne({ trip_id: tripId });
  } catch (err) {
    console.error('[MongoDB Atlas] Error getting AI itinerary:', err);
    return null;
  }
}

export async function saveCachedWeather(key: string, lat: number, lng: number, data: any, ttlMinutes = 15): Promise<void> {
  try {
    const database = await getMongoDb();
    if (!database) return;

    const coll = database.collection<WeatherSnapshotDoc>('weather_snapshots');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await coll.updateOne(
      { key },
      {
        $set: {
          key,
          lat,
          lng,
          data,
          cached_at: now,
          expires_at: expiresAt,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-blocking cache error
  }
}

export async function getCachedWeather(key: string): Promise<any | null> {
  try {
    const database = await getMongoDb();
    if (!database) return null;

    const coll = database.collection<WeatherSnapshotDoc>('weather_snapshots');
    const record = await coll.findOne({ key, expires_at: { $gt: new Date() } });
    return record ? record.data : null;
  } catch {
    return null;
  }
}
