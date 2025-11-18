// Test production upload endpoint
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const PROD_URL = 'https://labor-ai-pro.vercel.app';

async function testProductionUpload() {
  console.log('\n🧪 Testing Production Upload Endpoint\n');
  console.log(`URL: ${PROD_URL}/api/upload-file\n`);

  const testContent = "Construction Safety Test Document: Always wear proper PPE including hard hats, safety glasses, and steel-toed boots on construction sites. Follow lockout/tagout procedures when working with electrical equipment.";
  const base64Data = Buffer.from(testContent).toString('base64');

  console.log('📤 Uploading test document...');
  const response = await fetch(`${PROD_URL}/api/upload-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'production-test.txt',
      mimeType: 'text/plain',
      data: base64Data
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Upload successful!\n');
  console.log(`📊 Result:`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Chunks uploaded: ${result.count}`);
  console.log(`   Message: ${result.message}\n`);

  return result;
}

testProductionUpload()
  .then(() => {
    console.log('✅ Production upload test passed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Production upload test failed:', error.message);
    process.exit(1);
  });
