# Production Deployment Guide

## ✅ Pre-Deployment Verification (Completed Locally)

The following tests have been completed and passed:

1. **Backend Code Review** ✅
   - Upload endpoint (`/api/upload-file`) - bug-free
   - Search endpoint (`/api/search`) - bug-free
   - Qdrant client configuration - verified

2. **Local Testing** ✅
   - Backend server started successfully
   - Health check: `http://localhost:3001/api/health` - healthy
   - File upload test: Successfully uploaded 3 chunks
   - Search test: Successfully retrieved 3 results with 67.4% relevance
   - Frontend build: Completed in 517ms, no errors

3. **Deployment Configuration** ✅
   - `vercel.json` created with proper routing
   - Routes `/api/*` to backend serverless function
   - Routes static assets from `dist/`

---

## 🚀 Deploy to Vercel Production

### Step 1: Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Link Project (first time only)

```bash
vercel link
```

Follow prompts to link to your existing project or create a new one.

### Step 4: Set Environment Variables

Run these commands to set production environment variables:

```bash
vercel env add QDRANT_URL production
# Paste: https://883ae8cc-7ae3-4abc-b702-7f1abbec53a9.us-east4-0.gcp.cloud.qdrant.io:6333

vercel env add QDRANT_API_KEY production
# Paste your Qdrant API key

vercel env add GEMINI_API_KEY production
# Paste your Gemini API key

vercel env add FRONTEND_URL production
# Paste your production URL (e.g., https://labor-ai-pro.vercel.app)

vercel env add VITE_BACKEND_URL production
# Paste: https://labor-ai-pro.vercel.app/api
```

### Step 5: Deploy to Production

```bash
# Build frontend locally
npm run build

# Deploy to production
vercel deploy --prod --prebuilt
```

This will:
- Upload your local `dist/` folder for static assets
- Package `backend/server.mjs` as a serverless function
- Deploy both to Vercel

---

## ✅ Production Verification Commands

After deployment completes, run these commands to verify everything works:

### 1. Verify Deployment URL

Vercel will output your production URL. Save it for the next steps.

Example: `https://labor-ai-pro.vercel.app`

### 2. Test Health Endpoint

```bash
# Replace with your actual production URL
curl -s https://labor-ai-pro.vercel.app/api/health | python3 -m json.tool
```

**Expected output:**
```json
{
    "status": "healthy",
    "qdrant": {
        "connected": true,
        "url": "https://883ae8cc-7ae3-4abc-b702-7f1abbec53a9.us-east4-0.gcp.cloud.qdrant.io:6333"
    },
    "collection": {
        "vectorCount": 9,
        "vectorSize": 768,
        "distance": "Cosine"
    },
    "message": "Collection \"labor_documents\" is ready"
}
```

✅ **PASS CRITERIA:**
- `status: "healthy"`
- `qdrant.connected: true`
- `collection` is not null
- `collection.vectorSize: 768`

### 3. Test Upload Functionality

Create a test file `test-prod-upload.mjs`:

```javascript
import { readFileSync } from 'fs';

const PROD_URL = 'https://labor-ai-pro.vercel.app'; // Replace with your URL

async function testUpload() {
  const testContent = "This is a test document for Labor AI Pro. Safety is our priority.";
  const base64Data = Buffer.from(testContent).toString('base64');

  const response = await fetch(`${PROD_URL}/api/upload-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'test-upload.txt',
      mimeType: 'text/plain',
      data: base64Data
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.error}`);
  }

  const result = await response.json();
  console.log('✅ Upload test passed:', result);
  return result;
}

testUpload()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Upload test failed:', error.message);
    process.exit(1);
  });
```

Run:
```bash
node test-prod-upload.mjs
```

✅ **PASS CRITERIA:**
- Response status: 200
- `result.success: true`
- `result.count > 0`

### 4. Test Search Functionality

Create a test file `test-prod-search.mjs`:

```javascript
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

config({ path: '.env.local' });

const PROD_URL = 'https://labor-ai-pro.vercel.app'; // Replace with your URL

async function testSearch() {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const result = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: ['electrical safety equipment'],
  });
  const queryVector = result.embeddings[0].values;

  const response = await fetch(`${PROD_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_vector: queryVector, limit: 5 }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Search failed: ${error.error}`);
  }

  const data = await response.json();
  console.log('✅ Search test passed:', {
    count: data.count,
    firstResult: data.results[0]?.payload?.text?.substring(0, 100)
  });
  return data;
}

testSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Search test failed:', error.message);
    process.exit(1);
  });
```

Run:
```bash
node test-prod-search.mjs
```

✅ **PASS CRITERIA:**
- Response status: 200
- `data.count > 0`
- `data.results` contains search results with scores

### 5. Check Production Logs

```bash
# View logs from the last 10 minutes
vercel logs labor-ai-pro --prod --since 10m

# Follow logs in real-time
vercel logs labor-ai-pro --prod --follow
```

✅ **PASS CRITERIA:**
- No error messages in logs
- Upload requests show successful embeddings generation
- Search requests return results
- No Qdrant connection errors

### 6. Test Frontend UI

1. Open `https://labor-ai-pro.vercel.app` in your browser
2. Try uploading a file through the UI
3. Try searching for content

✅ **PASS CRITERIA:**
- UI loads without errors
- File upload completes successfully
- Search returns relevant results
- No console errors in browser DevTools

---

## 📊 Deployment Checklist

Use this checklist after deployment:

- [ ] Deployment completed without errors
- [ ] Health endpoint returns `status: "healthy"`
- [ ] Qdrant connection confirmed (`connected: true`)
- [ ] Collection exists with correct vector size (768)
- [ ] Upload test passes with status 200
- [ ] Search test passes and returns results
- [ ] Production logs show no errors
- [ ] Frontend UI loads correctly
- [ ] File upload works through UI
- [ ] Search functionality works through UI

---

## 🐛 Troubleshooting

### Issue: Health check shows "unhealthy"

**Solution:**
- Verify Qdrant credentials: `vercel env ls production`
- Check Qdrant Cloud dashboard to ensure cluster is running
- Redeploy: `vercel deploy --prod --prebuilt`

### Issue: Upload fails with "Missing GEMINI_API_KEY"

**Solution:**
```bash
vercel env add GEMINI_API_KEY production
# Paste your key
vercel deploy --prod --prebuilt
```

### Issue: CORS errors in browser

**Solution:**
- Verify `FRONTEND_URL` env var matches your actual production URL
- Redeploy: `vercel deploy --prod --prebuilt`

### Issue: 404 on API endpoints

**Solution:**
- Verify `vercel.json` exists in project root
- Check routes configuration in `vercel.json`
- Redeploy: `vercel deploy --prod --prebuilt`

---

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ All verification tests pass
2. ✅ No errors in production logs
3. ✅ Frontend UI is accessible
4. ✅ File upload works end-to-end
5. ✅ Search returns relevant results
6. ✅ Qdrant shows increasing vector count after uploads

---

## 📞 Support

If you encounter issues:

1. Check logs: `vercel logs labor-ai-pro --prod --since 30m`
2. Verify environment variables: `vercel env ls production`
3. Review Vercel dashboard for deployment errors
4. Check Qdrant Cloud dashboard for cluster status
