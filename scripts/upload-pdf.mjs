// scripts/upload-pdf.mjs
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
const CHUNK_SIZE = 250; // tokens (approximate - we'll use words as proxy)
const OVERLAP_PERCENTAGE = 0.2;

/**
 * Split text into chunks with overlap
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlapPercent = OVERLAP_PERCENTAGE) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  const overlapSize = Math.floor(chunkSize * overlapPercent);
  const step = chunkSize - overlapSize;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push({
        text: chunk,
        startIndex: i,
        endIndex: Math.min(i + chunkSize, words.length)
      });
    }
  }

  return chunks;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(filePath) {
  try {
    console.log(`📄 Reading PDF file: ${filePath}`);
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    console.log(`✅ Extracted ${data.numpages} pages`);
    console.log(`   Total text length: ${data.text.length} characters`);

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: data.info
    };
  } catch (error) {
    console.error('❌ Failed to parse PDF:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings using Gemini
 */
async function generateEmbedding(text, genAI) {
  try {
    const result = await genAI.models.embedContent({
      model: 'text-embedding-004',
      contents: [text],
    });
    return result.embeddings[0].values;
  } catch (error) {
    console.error('❌ Failed to generate embedding:', error.message);
    throw error;
  }
}

/**
 * Upload chunks to backend
 */
async function uploadToBackend(points) {
  try {
    console.log(`\n📤 Uploading ${points.length} chunks to backend...`);

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully uploaded ${result.count} chunks`);

    return result;
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    throw error;
  }
}

/**
 * Check backend health
 */
async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Cannot connect to backend at ${BACKEND_URL}. Make sure the backend server is running.`);
  }
}

/**
 * Main upload function
 */
async function uploadPDF(filePath) {
  const startTime = Date.now();

  try {
    console.log('\n🚀 Labor AI Pro - PDF Upload Utility\n');

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY in environment variables');
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Check backend health
    console.log(`🔍 Checking backend connection at ${BACKEND_URL}...`);
    const health = await checkBackendHealth();
    console.log(`✅ Backend is healthy: ${health.message}\n`);

    // Extract text from PDF
    const pdfData = await extractTextFromPDF(filePath);

    // Split into chunks
    console.log(`\n✂️  Splitting into chunks (${CHUNK_SIZE} words, ${OVERLAP_PERCENTAGE * 100}% overlap)...`);
    const chunks = chunkText(pdfData.text, CHUNK_SIZE, OVERLAP_PERCENTAGE);
    console.log(`✅ Created ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    console.log('\n🧮 Generating embeddings...');
    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Show progress
      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        process.stdout.write(`   Processing chunk ${i + 1}/${chunks.length}...\r`);
      }

      try {
        const embedding = await generateEmbedding(chunk.text, genAI);

        points.push({
          id: uuidv4(),
          vector: embedding,
          payload: {
            text: chunk.text,
            source: basename(filePath),
            chunkIndex: i,
            totalChunks: chunks.length,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            uploadedAt: new Date().toISOString(),
            metadata: {
              fileName: basename(filePath),
              pageCount: pdfData.pageCount,
              ...pdfData.metadata
            }
          }
        });

        // Small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`\n❌ Failed to process chunk ${i + 1}:`, error.message);
        throw error;
      }
    }

    console.log(`\n✅ Generated ${points.length} embeddings`);

    // Upload to backend
    await uploadToBackend(points);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Upload complete in ${duration}s`);
    console.log(`\n📊 Summary:`);
    console.log(`   File: ${basename(filePath)}`);
    console.log(`   Pages: ${pdfData.pageCount}`);
    console.log(`   Chunks: ${chunks.length}`);
    console.log(`   Duration: ${duration}s`);

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    throw error;
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('❌ Error: No file path provided\n');
    console.log('Usage: npm run upload:pdf <path-to-pdf-file>\n');
    console.log('Example: npm run upload:pdf ./docs/safety-manual.pdf');
    process.exit(1);
  }

  uploadPDF(filePath)
    .then(() => {
      console.log('\n✅ Success!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

// Export for use in other scripts
export { uploadPDF, chunkText, extractTextFromPDF };
