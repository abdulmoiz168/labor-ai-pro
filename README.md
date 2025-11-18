# 🔧 Labor AI Pro

<div align="center">

**AI-Powered Jobsite Intelligence for Skilled Trades**

[![Live Demo](https://img.shields.io/badge/Live-Demo-orange?style=for-the-badge&logo=vercel)](https://labor-ai-pro.vercel.app)
[![AI Genesis Hackathon](https://img.shields.io/badge/AI%20Genesis-LabLab.AI-blue?style=for-the-badge)](https://lablab.ai)
[![Built with Gemini](https://img.shields.io/badge/Built%20with-Gemini%202.0-purple?style=for-the-badge&logo=google)](https://ai.google.dev)

*The only on-the-job AI partner that watches what techs see, listens to what they ask, and answers with safety-grade intelligence in real time.*

[Live Demo](https://labor-ai-pro.vercel.app) • [Video Demo](#) • [Documentation](./docs/)

</div>

---

## 🎯 Problem

Field crews in skilled trades (electricians, plumbers, construction workers) face critical challenges:

- **Critical know-how lives in scattered PDFs** – OSHA safety manuals, tool specs, electrical codes
- **Can't stop work to search** – Workers on lifts or in hazardous areas need immediate answers
- **Compliance gaps = injuries, rework, fines** – Guesswork leads to safety violations and costly mistakes

**Labor AI Pro** turns any phone or rugged tablet into a field supervisor that never blinks.

---

## ✨ Features

### 🎥 Multimodal Live AI
- **Real-time video + audio streaming** with Gemini 2.0 Flash Native Audio
- **Visual analysis** of tools, materials, PPE, and work procedures
- **Voice interaction** – hands-free operation for workers in the field

### 📚 RAG-Powered Knowledge Base
- **Vector search** over safety manuals and technical documentation
- **Qdrant Cloud** for high-performance document retrieval
- **Gemini embeddings** for semantic search accuracy

### 💬 Intelligent Conversations
- **Text messaging** interface for detailed queries
- **Function calling** – AI automatically searches documents when needed
- **Context-aware responses** tailored for skilled trades

### 📄 Document Upload
- **PDF and text file support** for custom safety manuals
- **Automatic chunking and indexing** with vector embeddings
- **Instant searchability** across all uploaded documents

---

## 🏗️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for blazing-fast development
- **TailwindCSS** for responsive UI
- **Google Gemini 2.0 Flash** for multimodal AI

### Backend
- **Express.js** serverless functions
- **Qdrant Cloud** vector database
- **Gemini Text Embedding 004** for embeddings
- **PDF parsing** for document processing

### Infrastructure
- **Vercel** for deployment and hosting
- **Qdrant Cloud** for managed vector search
- **GitHub Actions** for CI/CD

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))
- **Qdrant Cloud Account** ([Sign up free](https://cloud.qdrant.io))

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdulmoiz168/labor-ai-pro.git
   cd labor-ai-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   QDRANT_URL=your_qdrant_cluster_url
   QDRANT_API_KEY=your_qdrant_api_key
   VITE_BACKEND_URL=http://localhost:3001
   ```

4. **Initialize Qdrant collection**
   ```bash
   node backend/setup-collection.mjs
   ```

5. **Run the development servers**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   npm run backend
   ```

6. **Open your browser**

   Navigate to `http://localhost:3000`

---

## 🌐 Production Deployment

### Deploy to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Set environment variables**
   ```bash
   vercel env add GEMINI_API_KEY production
   vercel env add QDRANT_URL production
   vercel env add QDRANT_API_KEY production
   vercel env add VITE_BACKEND_URL production
   ```

4. **Deploy**
   ```bash
   npm run build
   vercel --prod
   ```

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) for detailed instructions.

---

## 📖 Usage

### Starting a Session

1. Click **"Start Session"** to begin
2. Grant camera and microphone permissions
3. Point your camera at tools, materials, or work areas
4. Ask questions naturally via voice or text

### Example Queries

- *"What PPE do I need for electrical work?"*
- *"Is this drill bit suitable for concrete?"*
- *"Show me the lockout/tagout procedure"*
- *"What's the minimum wire gauge for 20 amp circuits?"*

### Uploading Documents

1. Click **"Upload Document"**
2. Select a PDF or text file (max 10MB)
3. Wait for indexing to complete
4. Documents are instantly searchable via AI

---

## 🧪 Testing

The project includes comprehensive test scripts:

```bash
# Test Qdrant collection setup
node scripts/test-collection.mjs

# Test document upload
node scripts/test-upload-api.mjs

# Test vector search
node scripts/test-search.mjs

# Run all tests
node backend/test-all.mjs
```

See [RAG-IMPLEMENTATION.md](./RAG-IMPLEMENTATION.md) for RAG architecture details.

---

## 🏆 AI Genesis Hackathon

This project was built for the **AI Genesis LabLab.AI Hackathon** (November 2025).

### Hackathon Goals
- Demonstrate **Gemini 2.0 Flash multimodal capabilities**
- Build a **production-ready RAG pipeline** with Qdrant
- Solve a **real-world problem** for skilled trades workers

### Key Innovations
- **First-of-its-kind** jobsite AI assistant
- **Real-time function calling** for document retrieval
- **Safety-first design** for hazardous work environments

---

## 📁 Project Structure

```
labor-ai-pro/
├── backend/                 # Express serverless functions
│   ├── server.mjs          # API routes (upload, search, health)
│   ├── setup-collection.mjs # Qdrant initialization
│   └── clear-collection.mjs # Reset database
├── components/              # React components
│   ├── Logo.tsx
│   └── StatusIndicator.tsx
├── hooks/                   # Custom React hooks
│   └── useGeminiLive.ts    # Gemini Live integration
├── utils/                   # Utility functions
│   ├── audio.ts            # Audio processing
│   └── image.ts            # Image encoding
├── scripts/                 # Test and deployment scripts
├── docs/                    # Documentation
├── test-data/              # Sample safety manuals
├── App.tsx                 # Main React component
├── types.ts                # TypeScript definitions
├── vercel.json             # Vercel deployment config
└── README.md               # You are here!
```

---

## 🔐 Security & Privacy

- **API keys** stored securely in environment variables
- **No data persistence** – conversations are ephemeral
- **User documents** stored only in your Qdrant cluster
- **HTTPS enforcement** in production

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) for details.

---

## 👨‍💻 Author

**Abdul Moiz**

- GitHub: [@abdulmoiz168](https://github.com/abdulmoiz168)
- Project: [Labor AI Pro](https://labor-ai-pro.vercel.app)

---

## 🙏 Acknowledgments

- **Google Gemini Team** for the incredible multimodal AI capabilities
- **Qdrant** for the powerful vector search engine
- **LabLab.AI** for hosting the AI Genesis Hackathon
- **Vercel** for seamless deployment infrastructure

---

<div align="center">

**Built with ❤️ for skilled trades professionals**

[⭐ Star this repo](https://github.com/abdulmoiz168/labor-ai-pro) • [🐛 Report Bug](https://github.com/abdulmoiz168/labor-ai-pro/issues) • [💡 Request Feature](https://github.com/abdulmoiz168/labor-ai-pro/issues)

</div>
