// test-scripts/test-qdrant-connection.mjs
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

console.log('🔍 Testing Qdrant Cloud Connection...\n');

async function testConnection() {
  try {
    // Validate credentials
    if (!QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error('Missing QDRANT_URL or QDRANT_API_KEY in .env.local');
    }

    console.log(`📡 Connecting to: ${QDRANT_URL}`);

    // Create client
    const client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });

    // Test connection by listing collections
    const collections = await client.getCollections();

    console.log('✅ Connection successful!');
    console.log(`📚 Found ${collections.collections.length} collections:`);

    if (collections.collections.length > 0) {
      collections.collections.forEach((col, i) => {
        console.log(`  ${i + 1}. ${col.name}`);
      });
    } else {
      console.log('  (No collections yet)');
    }

    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    throw error;
  }
}

testConnection()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(() => {
    console.log('\n❌ Tests failed');
    process.exit(1);
  });
