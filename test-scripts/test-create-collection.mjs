// test-scripts/test-create-collection.mjs
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'labor_ai_test';

console.log('📦 Creating Test Collection...\n');

async function createTestCollection() {
  try {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Check if collection exists
    console.log(`🔍 Checking if "${COLLECTION_NAME}" exists...`);

    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (exists) {
      console.log(`⚠️  Collection "${COLLECTION_NAME}" already exists`);
      console.log('🗑️  Deleting old collection...');
      await client.deleteCollection(COLLECTION_NAME);
      console.log('✅ Deleted');
    }

    // Create new collection
    console.log(`\n📦 Creating collection "${COLLECTION_NAME}"...`);
    console.log('  Vector size: 768 (Gemini text-embedding-004)');
    console.log('  Distance: Cosine');

    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 768,
        distance: 'Cosine',
      },
    });

    console.log('✅ Collection created successfully!');

    // Verify creation
    const info = await client.getCollection(COLLECTION_NAME);
    console.log('\n📊 Collection Info:');
    console.log(`  Name: ${info.name}`);
    console.log(`  Vector count: ${info.points_count}`);
    console.log(`  Vector size: ${info.config.params.vectors.size}`);
    console.log(`  Distance: ${info.config.params.vectors.distance}`);

    return true;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

createTestCollection()
  .then(() => {
    console.log('\n✅ Collection ready for testing!');
    process.exit(0);
  })
  .catch(() => {
    console.log('\n❌ Failed to create collection');
    process.exit(1);
  });
