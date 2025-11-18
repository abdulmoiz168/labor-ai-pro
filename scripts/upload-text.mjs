// scripts/upload-text.mjs
// Quick test utility for uploading text documents (not PDF)
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
const CHUNK_SIZE = 250; // words
const OVERLAP_PERCENTAGE = 0.2;

function chunkText(text, chunkSize = CHUNK_SIZE, overlapPercent = OVERLAP_PERCENTAGE) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  const overlapSize = Math.floor(chunkSize * overlapPercent);
  const step = chunkSize - overlapSize;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push({ text: chunk, startIndex: i, endIndex: Math.min(i + chunkSize, words.length) });
    }
  }

  return chunks;
}

async function generateEmbedding(text, genAI) {
  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: [text],
  });
  return result.embeddings[0].values;
}

async function uploadToBackend(points) {
  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

async function uploadText(filePath) {
  console.log('\n🚀 Labor AI Pro - Text Upload Utility\n');

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log(`📄 Reading text file: ${filePath}`);
  const text = readFileSync(filePath, 'utf-8');
  console.log(`✅ Read ${text.length} characters`);

  console.log(`\n✂️  Splitting into chunks (${CHUNK_SIZE} words, ${OVERLAP_PERCENTAGE * 100}% overlap)...`);
  const chunks = chunkText(text, CHUNK_SIZE, OVERLAP_PERCENTAGE);
  console.log(`✅ Created ${chunks.length} chunks`);

  console.log('\n🧮 Generating embeddings...');
  const points = [];

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`   Processing chunk ${i + 1}/${chunks.length}...\r`);
    const embedding = await generateEmbedding(chunks[i].text, genAI);

    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: {
        text: chunks[i].text,
        source: basename(filePath),
        chunkIndex: i,
        totalChunks: chunks.length,
        uploadedAt: new Date().toISOString(),
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ Generated ${points.length} embeddings`);

  console.log(`\n📤 Uploading to backend...`);
  const result = await uploadToBackend(points);
  console.log(`✅ Successfully uploaded ${result.count} chunks\n`);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/upload-text.mjs <path-to-text-file>');
  process.exit(1);
}

uploadText(filePath)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });
