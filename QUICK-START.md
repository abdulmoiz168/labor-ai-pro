# Labor AI Pro - RAG Quick Start Guide

## Setup (One Time)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create collection:**
   ```bash
   npm run setup:collection
   ```

## Daily Development

**Start everything:**
```bash
npm run dev:all
```

This starts both:
- Frontend (Vite) at http://localhost:5173
- Backend (Express) at http://localhost:3001

## Upload Documents

**PDF files:**
```bash
npm run upload:pdf path/to/document.pdf
```

**Example:**
```bash
npm run upload:pdf docs/safety-manual.pdf
```

## Test Search

```bash
node scripts/test-search.mjs "your query here"
```

**Example:**
```bash
node scripts/test-search.mjs "electrical grounding requirements"
```

## Check System Health

```bash
curl http://localhost:3001/api/health
```

## Verify Documents

After uploading, check the `vectorCount`:
```bash
curl http://localhost:3001/api/health | json_pp
```

## Troubleshooting

**Backend not starting?**
- Check if port 3001 is available
- Verify .env.local has QDRANT_URL and QDRANT_API_KEY

**Upload failing?**
- Make sure backend is running (`npm run backend`)
- Check GEMINI_API_KEY in .env.local

**Search returning no results?**
- Verify documents are uploaded (check health endpoint)
- Try more specific queries

**Frontend can't connect to backend?**
- Check VITE_BACKEND_URL in .env.local
- Restart frontend after .env changes

## File Structure

```
labor-ai-pro/
├── backend/
│   ├── server.mjs              # Express server
│   └── setup-collection.mjs    # Collection setup
├── scripts/
│   ├── upload-pdf.mjs          # PDF uploader
│   ├── upload-text.mjs         # Text uploader (testing)
│   └── test-search.mjs         # Search tester
├── hooks/
│   └── useGeminiLive.ts        # RAG-enabled hook
└── .env.local                  # Environment config
```

## Environment Variables

Required in `.env.local`:
```bash
GEMINI_API_KEY=<your-key>
QDRANT_URL=<your-qdrant-url>
QDRANT_API_KEY=<your-qdrant-key>
VITE_BACKEND_URL=http://localhost:3001
```

## NPM Scripts

- `npm run dev` - Frontend only
- `npm run backend` - Backend only
- `npm run dev:all` - Both (recommended)
- `npm run setup:collection` - Create Qdrant collection
- `npm run upload:pdf <file>` - Upload PDF
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Next Steps

1. Upload your first document
2. Test search functionality
3. Start the app and ask questions
4. Deploy to production (see RAG-IMPLEMENTATION.md)
