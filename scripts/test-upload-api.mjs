// Test the /api/upload-file endpoint
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

async function testUploadFile(filePath) {
  console.log('\n🧪 Testing /api/upload-file endpoint\n');
  console.log(`File: ${filePath}\n`);

  // Read file
  const fileBuffer = readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  const fileName = filePath.split('/').pop();
  const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain';

  console.log(`📁 File size: ${fileBuffer.length} bytes`);
  console.log(`📝 MIME type: ${mimeType}\n`);

  // Upload file
  console.log('📤 Uploading to backend...');
  const response = await fetch(`${BACKEND_URL}/api/upload-file`, {
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
  console.log(`   Chunks uploaded: ${result.count}`);
  console.log(`   Message: ${result.message}\n`);

  return result;
}

const filePath = process.argv[2] || join(__dirname, '../test-data/test-safety-manual.txt');

testUploadFile(filePath)
  .then(() => {
    console.log('✅ Test passed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
