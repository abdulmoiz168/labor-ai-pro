// backend/server.mjs
import express from 'express';
import cors from 'cors';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || 3001;
const COLLECTION_NAME = 'labor_documents';
const DEFAULT_CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 250;
const DEFAULT_CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 0.2);
const MAX_FILE_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024;

// Middleware
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
  : defaultOrigins;

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Initialize Qdrant client
let qdrantClient;
try {
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    throw new Error('Missing QDRANT_URL or QDRANT_API_KEY in environment variables');
  }

  qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
  console.log('✅ Qdrant client initialized');
} catch (error) {
  console.error('❌ Failed to initialize Qdrant client:', error.message);
  process.exit(1);
}

let genAIClient = null;
function getGenAIClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('✅ Gemini client initialized');
  }
  return genAIClient;
}

function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlapPercent = DEFAULT_CHUNK_OVERLAP) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return [];
  }

  const words = cleanText.split(' ');
  const chunks = [];
  const overlapSize = Math.floor(chunkSize * overlapPercent);
  const step = Math.max(1, chunkSize - overlapSize);

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (!chunkWords.length) continue;
    chunks.push({
      text: chunkWords.join(' '),
      startIndex: i,
      endIndex: Math.min(i + chunkSize, words.length)
    });
  }

  return chunks;
}

async function generateEmbedding(text) {
  const genAI = getGenAIClient();
  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: [text],
  });
  return result.embeddings?.[0]?.values || [];
}

async function ensureCollectionExists() {
  const collections = await qdrantClient.getCollections();
  return collections.collections.some(c => c.name === COLLECTION_NAME);
}

async function uploadPointsToCollection(points) {
  const collectionExists = await ensureCollectionExists();
  if (!collectionExists) {
    throw new Error(`Collection "${COLLECTION_NAME}" not found. Please run setup first.`);
  }

  const BATCH_SIZE = 100;
  let uploadedCount = 0;

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });

    uploadedCount += batch.length;
    console.log(`  Uploaded ${uploadedCount}/${points.length} points`);
  }

  return uploadedCount;
}

// Validation helper functions
function validateSearchRequest(body) {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  const { query_vector, limit } = body;

  if (!query_vector) {
    return { valid: false, error: 'query_vector is required' };
  }

  if (!Array.isArray(query_vector)) {
    return { valid: false, error: 'query_vector must be an array' };
  }

  if (query_vector.length !== 768) {
    return { valid: false, error: 'query_vector must have exactly 768 dimensions' };
  }

  if (!query_vector.every(n => typeof n === 'number' && !isNaN(n))) {
    return { valid: false, error: 'query_vector must contain only valid numbers' };
  }

  if (limit !== undefined) {
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return { valid: false, error: 'limit must be a number between 1 and 100' };
    }
  }

  return { valid: true };
}

function validateUploadRequest(body) {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  const { points } = body;

  if (!points) {
    return { valid: false, error: 'points array is required' };
  }

  if (!Array.isArray(points)) {
    return { valid: false, error: 'points must be an array' };
  }

  if (points.length === 0) {
    return { valid: false, error: 'points array cannot be empty' };
  }

  if (points.length > 1000) {
    return { valid: false, error: 'points array cannot exceed 1000 items per request' };
  }

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (!point.id) {
      return { valid: false, error: `Point at index ${i} is missing required field: id` };
    }

    if (!point.vector) {
      return { valid: false, error: `Point at index ${i} is missing required field: vector` };
    }

    if (!Array.isArray(point.vector)) {
      return { valid: false, error: `Point at index ${i}: vector must be an array` };
    }

    if (point.vector.length !== 768) {
      return { valid: false, error: `Point at index ${i}: vector must have exactly 768 dimensions` };
    }

    if (!point.vector.every(n => typeof n === 'number' && !isNaN(n))) {
      return { valid: false, error: `Point at index ${i}: vector must contain only valid numbers` };
    }

    if (!point.payload || typeof point.payload !== 'object') {
      return { valid: false, error: `Point at index ${i}: payload must be an object` };
    }
  }

  return { valid: true };
}

// API Routes

/**
 * POST /api/search
 * Search documents in Qdrant by vector similarity
 */
app.post('/api/search', async (req, res) => {
  try {
    // Validate request
    const validation = validateSearchRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { query_vector, limit = 5 } = req.body;

    console.log(`🔍 Searching for ${limit} documents...`);

    const collectionExists = await ensureCollectionExists();

    if (!collectionExists) {
      return res.status(404).json({
        error: `Collection "${COLLECTION_NAME}" not found. Please run setup first.`,
        results: []
      });
    }

    // Perform search
    const searchResult = await qdrantClient.query(COLLECTION_NAME, {
      query: query_vector,
      limit: limit,
      with_payload: true,
    });

    console.log(`✅ Found ${searchResult.points?.length || 0} results`);

    res.json({
      results: searchResult.points || [],
      count: searchResult.points?.length || 0
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      message: error.message
    });
  }
});

/**
 * POST /api/upload
 * Upload document chunks (vectors + metadata) to Qdrant
 */
app.post('/api/upload', async (req, res) => {
  try {
    // Validate request
    const validation = validateUploadRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { points } = req.body;

    console.log(`📤 Uploading ${points.length} points to "${COLLECTION_NAME}"...`);

    const collectionExists = await ensureCollectionExists();

    if (!collectionExists) {
      return res.status(404).json({
        error: `Collection "${COLLECTION_NAME}" not found. Please run setup first.`
      });
    }

    const uploadedCount = await uploadPointsToCollection(points);

    console.log(`✅ Successfully uploaded ${uploadedCount} points`);

    res.json({
      success: true,
      count: uploadedCount,
      message: `Successfully uploaded ${uploadedCount} document chunks`
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload documents',
      message: error.message
    });
  }
});

/**
 * POST /api/upload-file
 * Accepts base64 encoded files (PDF or text), chunks content, generates embeddings, and uploads to Qdrant
 */
app.post('/api/upload-file', async (req, res) => {
  try {
    const { fileName, mimeType, data } = req.body || {};

    if (!fileName || !mimeType || !data) {
      return res.status(400).json({ error: 'fileName, mimeType, and data are required' });
    }

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Uploaded file is empty or could not be decoded' });
    }

    if (buffer.length > MAX_FILE_BYTES) {
      const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
      return res.status(400).json({ error: `File exceeds maximum size of ${limitMb} MB` });
    }

    let extractedText = '';
    let pageCount = null;
    let pdfInfo = null;

    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || '';
      pageCount = pdfData.numpages || null;
      pdfInfo = pdfData.info || null;
    } else if (mimeType.startsWith('text/') || fileName.toLowerCase().endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or text files.' });
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'Could not extract readable text from the uploaded file' });
    }

    const chunks = chunkText(extractedText);
    if (!chunks.length) {
      return res.status(400).json({ error: 'File did not produce any usable text chunks' });
    }

    console.log(`📄 Processing ${fileName} (${chunks.length} chunks)`);

    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await generateEmbedding(chunk.text);
        if (!embedding.length) {
          throw new Error('Embedding generation returned an empty vector');
        }

        points.push({
          id: uuidv4(),
          vector: embedding,
          payload: {
            text: chunk.text,
            source: fileName,
            chunkIndex: i,
            totalChunks: chunks.length,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            uploadedAt: new Date().toISOString(),
            metadata: {
              fileName,
              mimeType,
              pageCount,
              pdfInfo,
            }
          }
        });
      } catch (embeddingError) {
        console.error(`❌ Failed to embed chunk ${i + 1}/${chunks.length}:`, embeddingError.message);
        return res.status(500).json({
          error: 'Failed to generate embeddings for document',
          message: embeddingError.message
        });
      }
    }

    const uploadedCount = await uploadPointsToCollection(points);

    console.log(`✅ Uploaded ${uploadedCount} chunks from ${fileName}`);

    res.json({
      success: true,
      count: uploadedCount,
      message: `Successfully uploaded ${uploadedCount} document chunks from ${fileName}`
    });

  } catch (error) {
    console.error('❌ Upload-file error:', error);
    res.status(500).json({
      error: 'Failed to process uploaded file',
      message: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint - verifies Qdrant connection and collection status
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test Qdrant connection
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

    let collectionInfo = null;
    if (collectionExists) {
      const info = await qdrantClient.getCollection(COLLECTION_NAME);
      collectionInfo = {
        name: info.name,
        vectorCount: info.points_count || 0,
        vectorSize: info.config?.params?.vectors?.size || 768,
        distance: info.config?.params?.vectors?.distance || 'Cosine'
      };
    }

    res.json({
      status: 'healthy',
      qdrant: {
        connected: true,
        url: process.env.QDRANT_URL
      },
      collection: collectionExists ? collectionInfo : null,
      message: collectionExists
        ? `Collection "${COLLECTION_NAME}" is ready`
        : `Collection "${COLLECTION_NAME}" not found - run setup`
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Failed to connect to Qdrant',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Vercel serverless deployment
export default app;

// Start server only if running directly (not in serverless environment)
if (import.meta.url === `file://${process.argv[1]}` || process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Labor AI Pro Backend Server`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Collection: ${COLLECTION_NAME}`);
    console.log(`   Qdrant: ${process.env.QDRANT_URL}`);
    console.log(`\n📡 Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/search`);
    console.log(`   POST http://localhost:${PORT}/api/upload`);
    console.log(`   POST http://localhost:${PORT}/api/upload-file`);
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    console.log(`\n✅ Server is running\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}
