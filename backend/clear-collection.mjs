// Clear and recreate Qdrant collection
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'labor_documents';
const VECTOR_SIZE = 768; // Gemini text-embedding-004 dimension

async function clearCollection() {
  console.log('\n🗑️  Labor AI Pro - Clear Collection\n');

  try {
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      throw new Error('Missing QDRANT_URL or QDRANT_API_KEY in environment variables');
    }

    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    console.log(`📍 Connected to: ${process.env.QDRANT_URL}`);

    // Check if collection exists
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (exists) {
      console.log(`\n🔍 Found collection: "${COLLECTION_NAME}"`);

      // Get current stats
      const info = await client.getCollection(COLLECTION_NAME);
      console.log(`   Current vectors: ${info.points_count}`);

      // Delete collection
      console.log(`\n🗑️  Deleting collection...`);
      await client.deleteCollection(COLLECTION_NAME);
      console.log(`✅ Collection deleted`);
    } else {
      console.log(`\n⚠️  Collection "${COLLECTION_NAME}" does not exist`);
    }

    // Recreate collection
    console.log(`\n🔨 Creating fresh collection...`);
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    });

    console.log(`✅ Collection "${COLLECTION_NAME}" created successfully`);
    console.log(`   Vector size: ${VECTOR_SIZE}`);
    console.log(`   Distance metric: Cosine`);
    console.log(`   Vectors: 0\n`);

    console.log('🎉 Collection is ready for fresh uploads!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

clearCollection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
