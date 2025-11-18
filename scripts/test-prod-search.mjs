// Test production search endpoint
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const PROD_URL = 'https://labor-ai-pro.vercel.app';

async function testProductionSearch() {
  console.log('\n🧪 Testing Production Search Endpoint\n');
  console.log(`URL: ${PROD_URL}/api/search\n`);

  const query = 'safety equipment and PPE requirements';
  console.log(`Query: "${query}"\n`);

  // Generate embedding for query
  console.log('🧮 Generating query embedding...');
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: [query],
  });
  const queryVector = result.embeddings[0].values;
  console.log(`✅ Embedding generated (${queryVector.length} dimensions)\n`);

  // Search production backend
  console.log('🔍 Searching production backend...');
  const response = await fetch(`${PROD_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_vector: queryVector, limit: 3 }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Search failed: ${error.error || response.statusText}`);
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
      console.log(`   Text: ${result.payload?.text?.substring(0, 120)}...`);
      console.log('');
    });
  } else {
    console.log('No results found.');
  }

  return data;
}

testProductionSearch()
  .then(() => {
    console.log('✅ Production search test passed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Production search test failed:', error.message);
    process.exit(1);
  });
