const { MongoClient, GridFSBucket } = require("mongodb");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const DB_PATH = path.join(__dirname, "../data/travel.db");
const BUCKET_NAME = "trek_sqlite_backup";
const DB_FILENAME = "travel.db";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || "trek";
  if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }
  if (!fs.existsSync(DB_PATH)) { console.error("travel.db not found at:", DB_PATH); process.exit(1); }
  const sizeMB = (fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2);
  console.log("Uploading local travel.db (" + sizeMB + " MB) to MongoDB Atlas...");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  console.log("Connected to MongoDB: " + dbName);
  const db = client.db(dbName);
  const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
  const existing = await bucket.find({ filename: DB_FILENAME }).toArray();
  for (const f of existing) { await bucket.delete(f._id); console.log("Deleted old backup: " + f._id); }
  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(DB_PATH);
    const uploadStream = bucket.openUploadStream(DB_FILENAME, { metadata: { backed_up_at: new Date(), source: "local_migration" } });
    readStream.pipe(uploadStream);
    uploadStream.on("finish", resolve);
    uploadStream.on("error", reject);
    readStream.on("error", reject);
  });
  console.log("SUCCESS: travel.db uploaded to MongoDB GridFS bucket: " + BUCKET_NAME);
  console.log("Railway will restore this DB on next boot - your account will be there!");
  await client.close();
}

main().catch(err => { console.error("Upload failed:", err.message); process.exit(1); });
