// backend/setup-collection.mjs
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'labor_documents';
const VECTOR_SIZE = 768; // Gemini text-embedding-004
const DISTANCE_METRIC = 'Cosine';

/**
 * Setup Qdrant collection for Labor AI Pro
 * Creates the collection if it doesn't exist
 */
async function setupCollection() {
  try {
    // Validate environment variables
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      throw new Error('Missing QDRANT_URL or QDRANT_API_KEY in environment variables');
    }

    console.log('🔧 Setting up Qdrant collection...\n');

    // Initialize client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    console.log(`🔍 Checking if "${COLLECTION_NAME}" exists...`);

    // Check if collection exists
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (exists) {
      console.log(`✅ Collection "${COLLECTION_NAME}" already exists`);

      // Get collection info
      const info = await client.getCollection(COLLECTION_NAME);
      console.log('\n📊 Collection Info:');
      console.log(`   Name: ${info.name}`);
      console.log(`   Vector count: ${info.points_count || 0}`);
      console.log(`   Vector size: ${info.config?.params?.vectors?.size || 'N/A'}`);
      console.log(`   Distance: ${info.config?.params?.vectors?.distance || 'N/A'}`);

      return { existed: true, created: false };
    }

    // Create new collection
    console.log(`\n📦 Creating collection "${COLLECTION_NAME}"...`);
    console.log(`   Vector size: ${VECTOR_SIZE} (Gemini text-embedding-004)`);
    console.log(`   Distance: ${DISTANCE_METRIC}`);

    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE_METRIC,
      },
    });

    console.log('✅ Collection created successfully!');

    // Verify creation
    const info = await client.getCollection(COLLECTION_NAME);
    console.log('\n📊 Collection Info:');
    console.log(`   Name: ${info.name}`);
    console.log(`   Vector count: ${info.points_count || 0}`);
    console.log(`   Vector size: ${info.config?.params?.vectors?.size}`);
    console.log(`   Distance: ${info.config?.params?.vectors?.distance}`);

    return { existed: false, created: true };

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    throw error;
  }
}

// Export for use in server.mjs
export { setupCollection };

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  setupCollection()
    .then((result) => {
      if (result.created) {
        console.log('\n✅ Collection setup complete! Ready to accept documents.');
      } else {
        console.log('\n✅ Collection is ready!');
      }
      process.exit(0);
    })
    .catch(() => {
      console.log('\n❌ Failed to setup collection');
      process.exit(1);
    });
}
