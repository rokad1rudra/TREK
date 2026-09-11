import { db } from './database';
import { saveAiItinerary, getAiItinerary, AiItineraryDoc, getMongoDb } from './mongoService';
import { isSupabaseConfigured } from './supabaseService';

export interface UnifiedTripResult {
  trip: any;
  aiDetails?: AiItineraryDoc | null;
}

export class CloudDatabaseManager {
  static async isCloudOnline(): Promise<{ sql: boolean; nosql: boolean }> {
    const nosqlDb = await getMongoDb();
    const sqlOnline = isSupabaseConfigured();
    return {
      sql: sqlOnline,
      nosql: Boolean(nosqlDb),
    };
  }

  static async saveAiTrip(
    userId: number,
    sqlTripData: {
      title: string;
      description?: string | null;
      origin_location?: string | null;
      destination_location?: string | null;
      day_count?: number;
      currency?: string;
      cover_image?: string | null;
    },
    aiPayload: Omit<AiItineraryDoc, 'trip_id' | 'created_at' | 'updated_at'>,
    spotsByDay: Array<{
      dayNumber: number;
      spots: Array<{
        name: string;
        address?: string;
        lat: number;
        lng: number;
        category?: string;
        notes?: string;
        duration_minutes?: number;
      }>;
    }>
  ): Promise<{ tripId: number; savedToMongo: boolean }> {
    // 1. Create in SQL (Supabase / local)
    const tripResult = db.prepare(`
      INSERT INTO trips (user_id, title, description, origin_location, destination_location, currency, cover_image, reminder_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, 3)
    `).run(
      userId,
      sqlTripData.title,
      sqlTripData.description || null,
      sqlTripData.origin_location || null,
      sqlTripData.destination_location || null,
      sqlTripData.currency || 'INR',
      sqlTripData.cover_image || null
    );

    const tripId = Number(tripResult.lastInsertRowid);

    // 2. Generate Days in SQL
    const totalDays = sqlTripData.day_count || 5;
    for (let d = 1; d <= totalDays; d++) {
      const dayRes = db.prepare(`
        INSERT INTO days (trip_id, day_number, date)
        VALUES (?, ?, NULL)
      `).run(tripId, d);
      const dayId = Number(dayRes.lastInsertRowid);

      const daySpots = spotsByDay.find((s) => s.dayNumber === d)?.spots || [];
      for (let i = 0; i < daySpots.length; i++) {
        const spot = daySpots[i];
        const placeRes = db.prepare(`
          INSERT INTO places (trip_id, name, address, lat, lng, notes, duration_minutes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          tripId,
          spot.name,
          spot.address || `${spot.name}, ${sqlTripData.destination_location || ''}`,
          spot.lat,
          spot.lng,
          spot.notes || null,
          spot.duration_minutes || 90
        );
        const placeId = Number(placeRes.lastInsertRowid);

        db.prepare(`
          INSERT INTO day_assignments (day_id, place_id, order_index)
          VALUES (?, ?, ?)
        `).run(dayId, placeId, i);
      }
    }

    // 3. Save Rich AI Document in MongoDB Atlas (NoSQL)
    const savedToMongo = await saveAiItinerary({
      trip_id: tripId,
      ...aiPayload,
    });

    console.log(`[Cloud Hybrid DB] Trip #${tripId} saved to SQL and MongoDB Atlas (Synced: ${savedToMongo})`);

    return {
      tripId,
      savedToMongo,
    };
  }

  static async getTripWithAi(tripId: number | string, userId: number): Promise<UnifiedTripResult | null> {
    const trip = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM days d WHERE d.trip_id = t.id) as day_count,
        (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) as place_count
      FROM trips t
      WHERE t.id = ? AND t.user_id = ?
    `).get(tripId, userId);

    if (!trip) return null;

    const aiDetails = await getAiItinerary(tripId);

    return {
      trip,
      aiDetails,
    };
  }
}
