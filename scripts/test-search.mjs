// scripts/test-search.mjs
// Test the search functionality
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

async function testSearch(query) {
  console.log('\n🔍 Testing Search Functionality\n');
  console.log(`Query: "${query}"\n`);

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Generate embedding for query
  console.log('🧮 Generating query embedding...');
  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: [query],
  });
  const queryVector = result.embeddings[0].values;
  console.log(`✅ Embedding generated (${queryVector.length} dimensions)\n`);

  // Search backend
  console.log('🔍 Searching backend...');
  const response = await fetch(`${BACKEND_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_vector: queryVector, limit: 3 }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Found ${data.count} results\n`);

  // Display results
  if (data.results && data.results.length > 0) {
    console.log('📄 Results:\n');
    data.results.forEach((result, index) => {
      const score = (result.score * 100).toFixed(1);
      console.log(`${index + 1}. Score: ${score}%`);
      console.log(`   Source: ${result.payload?.source || 'Unknown'}`);
      console.log(`   Text: ${result.payload?.text?.substring(0, 150)}...`);
      console.log('');
    });
  } else {
    console.log('No results found.');
  }
}

const query = process.argv[2] || 'electrical safety grounding requirements';

testSearch(query)
  .then(() => {
    console.log('✅ Search test complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
