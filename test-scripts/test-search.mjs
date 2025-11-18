// test-scripts/test-search.mjs
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'labor_ai_test';

// Test queries
const TEST_QUERIES = [
  'What PPE should I wear on a construction site?',
  'What drill bit should I use for concrete?',
  'How do I safely work on electrical circuits?',
];

console.log('🔍 Testing Vector Search...\n');

async function testSearch() {
  try {
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const query = TEST_QUERIES[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Query ${i + 1}: "${query}"`);
      console.log('='.repeat(80));

      // Generate query embedding
      console.log('🔢 Generating query embedding...');
      const result = await genai.models.embedContent({
        model: 'text-embedding-004',
        contents: [query],
      });
      const queryVector = result.embeddings[0].values;
      console.log(`✅ Embedding generated (${queryVector.length} dimensions)`);

      // Search Qdrant
      console.log('🔍 Searching Qdrant...');
      const searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 3,
        with_payload: true,
      });

      console.log(`✅ Found ${searchResults.length} results\n`);

      // Display results
      searchResults.forEach((hit, idx) => {
        console.log(`Result ${idx + 1} (Score: ${hit.score.toFixed(4)}):`);
        console.log(`  📄 ${hit.payload.document_title} - Page ${hit.payload.page_number}`);
        console.log(`  📑 Section: ${hit.payload.section}`);
        console.log(`  📝 ${hit.payload.content}`);
        console.log();
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    throw error;
  }
}

testSearch()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('✅ All search tests passed!');
    console.log('🎉 Qdrant Cloud integration is working perfectly!');
    process.exit(0);
  })
  .catch(() => {
    console.log('\n❌ Search tests failed');
    process.exit(1);
  });
