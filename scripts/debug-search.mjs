// Debug search results
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const PROD_URL = 'https://labor-ai-pro.vercel.app';

async function debugSearch(query) {
  console.log(`\n🔍 Debug Search for: "${query}"\n`);

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Generate embedding
  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: [query],
  });
  const queryVector = result.embeddings[0].values;

  // Search
  const response = await fetch(`${PROD_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_vector: queryVector, limit: 10 }),
  });

  const data = await response.json();

  console.log(`✅ Found ${data.count} results\n`);
  console.log('=' .repeat(80));

  data.results.forEach((result, index) => {
    const score = (result.score * 100).toFixed(1);
    console.log(`\n📄 Result #${index + 1} - Score: ${score}%`);
    console.log(`   Source: ${result.payload?.source || 'Unknown'}`);
    console.log(`   Chunk: ${result.payload?.chunkIndex}/${result.payload?.totalChunks}`);
    console.log(`\n   Text (first 200 chars):`);
    console.log(`   ${result.payload?.text?.substring(0, 200)}...`);
    console.log('\n' + '-'.repeat(80));
  });
}

const query = process.argv[2] || 'PPE safety equipment for electricians';

debugSearch(query)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
