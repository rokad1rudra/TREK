import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testMongo() {
  console.log('Testing MongoDB connection...');
  const uri = process.env.MONGODB_URI;
  console.log('URI:', uri?.replace(/:([^@]+)@/, ':****@'));

  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    return;
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    console.log('✅ MongoDB Atlas connected successfully!');
    const dbs = await client.db().admin().listDatabases();
    console.log('Databases available:', dbs.databases.map(d => d.name));
    await client.close();
  } catch (err: any) {
    console.error('❌ MongoDB Connection Error Detail:');
    console.error('Error Code/Name:', err.name, err.code);
    console.error('Message:', err.message);
  }
}

testMongo();
