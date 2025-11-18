// test-scripts/test-upload-document.mjs
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuid } from 'uuid';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'labor_ai_test';

// Test document: Safety manual excerpt
const TEST_DOCUMENTS = [
  {
    content: 'Safety Guideline: Always wear proper PPE including hard hat, safety glasses, and steel-toe boots on construction sites. OSHA requires this equipment for all workers.',
    metadata: {
      document_title: 'OSHA Safety Manual',
      page_number: 1,
      section: 'Personal Protective Equipment',
    },
  },
  {
    content: 'Drill Bit Usage: For drilling into concrete, use masonry drill bits rated for the material. Standard drill speeds should be 1500-2000 RPM for 1/4 inch bits.',
    metadata: {
      document_title: 'DeWalt Power Tools Manual',
      page_number: 12,
      section: 'Drill Bit Selection',
    },
  },
  {
    content: 'Electrical Safety: Before working on any electrical circuit, always verify power is OFF using a multimeter. Lock out the circuit breaker and tag it to prevent accidental re-energization.',
    metadata: {
      document_title: 'Electrical Safety Handbook',
      page_number: 5,
      section: 'Lockout/Tagout Procedures',
    },
  },
];

console.log('📤 Uploading Test Documents...\n');

async function uploadDocuments() {
  try {
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const points = [];

    for (let i = 0; i < TEST_DOCUMENTS.length; i++) {
      const doc = TEST_DOCUMENTS[i];
      console.log(`📝 Processing document ${i + 1}/${TEST_DOCUMENTS.length}...`);
      console.log(`  Title: ${doc.metadata.document_title}`);
      console.log(`  Content: ${doc.content.substring(0, 50)}...`);

      // Generate embedding
      console.log('  🔢 Generating embedding...');
      const result = await genai.models.embedContent({
        model: 'text-embedding-004',
        contents: [doc.content],
      });
      const embedding = result.embeddings[0].values;

      console.log(`  ✅ Embedding generated (${embedding.length} dimensions)`);

      // Create point
      const point = {
        id: uuid(),
        vector: embedding,
        payload: {
          content: doc.content,
          document_title: doc.metadata.document_title,
          page_number: doc.metadata.page_number,
          section: doc.metadata.section,
        },
      };

      points.push(point);
      console.log(`  ✅ Point created\n`);
    }

    // Upload to Qdrant
    console.log(`📤 Uploading ${points.length} points to Qdrant...`);
    await qdrant.upsert(COLLECTION_NAME, {
      points,
      wait: true,
    });

    console.log('✅ Upload successful!');

    // Verify upload
    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log('\n📊 Collection Status:');
    console.log(`  Total points: ${info.points_count}`);

    return true;
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    throw error;
  }
}

uploadDocuments()
  .then(() => {
    console.log('\n✅ Test documents ready for search!');
    process.exit(0);
  })
  .catch(() => {
    console.log('\n❌ Upload failed');
    process.exit(1);
  });
