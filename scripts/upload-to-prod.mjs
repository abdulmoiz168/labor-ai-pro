// Upload test document to production
import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const PROD_URL = 'https://labor-ai-pro.vercel.app';

async function uploadToProd(filePath) {
  console.log('\n📤 Uploading to Production\n');
  console.log(`File: ${filePath}`);

  // Read file
  const fileContent = readFileSync(filePath);
  const base64Data = fileContent.toString('base64');
  const fileName = filePath.split('/').pop();
  const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain';

  console.log(`Size: ${fileContent.length} bytes`);
  console.log(`Type: ${mimeType}\n`);

  // Upload
  console.log('📡 Uploading to backend...');
  const response = await fetch(`${PROD_URL}/api/upload-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName,
      mimeType,
      data: base64Data
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  console.log(`✅ Upload successful!\n`);
  console.log(`📊 Result:`);
  console.log(`   Chunks: ${result.count}`);
  console.log(`   Message: ${result.message}\n`);

  return result;
}

const filePath = process.argv[2] || join(__dirname, '../test-data/test-safety-manual.txt');

uploadToProd(filePath)
  .then(() => {
    console.log('✅ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
