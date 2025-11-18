// test-scripts/run-all-tests.mjs
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  { name: 'Connection Test', script: 'test-qdrant-connection.mjs' },
  { name: 'Collection Creation', script: 'test-create-collection.mjs' },
  { name: 'Document Upload', script: 'test-upload-document.mjs' },
  { name: 'Vector Search', script: 'test-search.mjs' },
];

console.log('🚀 Running Qdrant Cloud Integration Tests\n');
console.log('='.repeat(80));

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  Running: ${test.name}`);
    console.log('-'.repeat(80));

    const proc = spawn('node', [join(__dirname, test.script)], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} passed`);
        resolve();
      } else {
        console.log(`❌ ${test.name} failed with code ${code}`);
        reject(new Error(`${test.name} failed`));
      }
    });
  });
}

async function runAllTests() {
  for (const test of tests) {
    await runTest(test);
  }
}

runAllTests()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Qdrant Cloud is fully functional and ready for integration!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n' + '='.repeat(80));
    console.log('❌ TESTS FAILED');
    console.error(error.message);
    process.exit(1);
  });
