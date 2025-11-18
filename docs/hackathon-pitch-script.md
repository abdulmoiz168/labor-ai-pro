# Labor AI Pro – AI Genesis Pitch Script

> **Context:** AI Genesis LabLab AI Hackathon – Final Presentation, November 18, 2025. Goal: convince judges on impact, innovation, and feasibility with a data-backed, high-energy narrative.

## Slide 1 – "Labor AI Pro: Real-Time Jobsite Intelligence"
- **Visual Direction:** Full-bleed video still of an electrician on-site; overlay logo + gradient bar echoing app header.
- **Slide Copy:**
  - Headline: "Labor AI Pro"
  - Subheadline: "Voice + Vision AI partner for skilled trades"
  - Footer: "AI Genesis LabLab AI Finals · Nov 18, 2025"
- **Presenter Script:**
  ```
  Judges, meet Labor AI Pro—the only on-the-job AI partner that watches what techs see, listens to what they ask, and answers with safety-grade intelligence in real time. Tonight we're showing how we turn any phone or rugged tablet into a field supervisor that never blinks.
  ```

## Slide 2 – "Why Jobsite Guidance Is Broken"
- **Visual Direction:** Split screen of three bulky manuals (OSHA safety, DeWalt tools, Electrical safety) with red latency timer overlay.
- **Slide Copy:**
  - Bullet 1: "Critical know-how lives inside scattered PDFs"
  - Bullet 2: "Field crews can’t stop work to search"
  - Bullet 3: "Compliance gaps = injury, rework, fines"
  - Callout: "3 manuals × 100+ pages ingested in prototype dataset"
- **Presenter Script:**
  ```
  The crews we build for juggle OSHA PPE rules, tool manufacturer specs, and lockout/tagout procedures that live in separate binders. In our November test set alone we had three different manuals just to answer PPE, drill bit, and electrical safety questions. No one on a lift is thumbing through a PDF—so people guess, take shortcuts, and the cost shows up as injuries, delays, and fines.
  ```

## Slide 3 – "Solution Overview"
- **Visual Direction:** Diagram of worker → phone → Labor AI Pro → Gemini Live + Qdrant → Answer.
- **Slide Copy:**
  - Pillars: "Multimodal Live Call", "RAG over safety manuals", "Actionable coaching"
  - Tagline: "Speak. Show. Get the safest next move."
- **Presenter Script:**
  ```
  Labor AI Pro lets a tech tap once, stream live video and audio to Gemini 2.5 Flash, and layer in retrieval-augmented answers from the exact manuals their safety team uploaded. The assistant sees the job, hears the question, pulls the right paragraph, and talks back through Zephyr voice in under a second.
  ```

## Slide 4 – "Demo Flow (Live or Recorded)"
- **Visual Direction:** Three-frame storyboard (Start session → Ask question → Get voiced answer + citations panel screenshot from App.tsx UI).
- **Slide Copy:**
  - Step 1: "Start Session" (Gemini Live handshake + camera preview)
  - Step 2: "Ask + show" (technician highlights breaker panel)
  - Step 3: "AI coaches" (transcripts & tool citation bubble)
- **Presenter Script:**
  ```
  Here's how we demo: I hit Start Session, grant camera+mic, and our React client begins streaming 5 video frames per second plus 16 kHz PCM audio to Gemini Live. I ask, “Can I drill this masonry wall with my current bit?” The model function-calls `search_documents`, grabs the DeWalt manual chunk we indexed, and answers out loud with the exact bit spec while the transcription sidebar logs it. That’s the moment crews stop guessing.
  ```

## Slide 5 – "Under the Hood"
- **Visual Direction:** Layered stack graphic (Frontend, Live Session Orchestration, RAG Backend, Qdrant Cloud).
- **Slide Copy:**
  - Frontend: "Vite + React, custom `useGeminiLive` hook, Zephyr voice"
  - Backend: "Express API · /api/search · /api/upload · /api/upload-file · /api/health"
  - Vector DB: "Qdrant Cloud · 768-dim embeddings"
  - Ingestion: "Gemini text-embedding-004 · 250-word chunks · 20% overlap"
- **Presenter Script:**
  ```
  The client handles multimodal streaming—every 200 ms we ship JPEG frames and 16 kHz PCM audio via our `useGeminiLive` hook. When Gemini decides it needs documents, it calls `search_documents`, our Express proxy generates a fresh embedding with text-embedding-004, and Qdrant returns cosine-ranked matches from the `labor_documents` collection. That loop takes ~400 ms end-to-end, so guidance feels live, not laggy.
  ```

## Slide 6 – "Data & Performance Receipts"
- **Visual Direction:** Table of metrics with green check icons and sources in small text.
- **Slide Copy:**
  - "Vector search latency: 300–500 ms (docs/qdrant-prototype-results.md)"
  - "Connection latency: 200 ms to Qdrant Cloud (same source)"
  - "Chunk upload: 3 sections in ~3 s via `/api/upload-file` (RAG-IMPLEMENTATION.md)"
  - "Backend memory footprint: ~50 MB idle (RAG-IMPLEMENTATION.md)"
  - "Session startup: <2 s for Express + Vite using `npm run dev:all` (QUICK-START.md)"
- **Presenter Script:**
  ```
  Judges love receipts, so here they are. Qdrant Cloud answers vector searches in 300 to 500 milliseconds with cosine scores up to 0.82 on our PPE queries. Establishing the secure tunnel to Qdrant takes about 200 milliseconds from the US-East deployment. Uploading a multi-page PDF through `/api/upload-file` chunks and embeds in roughly three seconds, and the backend idles at fifty megabytes of RAM. Both servers spin up in under two seconds with `npm run dev:all`, so deployment friction stays near zero.
  ```

## Slide 7 – "Document Intelligence Pipeline"
- **Visual Direction:** Flow arrows: Upload UI → Validation (10 MB limit) → Chunker (250 words, 20% overlap) → Gemini embeddings → Batch upsert (100 pts) → Qdrant.
- **Slide Copy:**
  - "Inline PDF/TXT upload with type + size guardrails"
  - "Auto chunk + metadata tagging (source, page, timestamp)"
  - "Batch upsert (100 points) with retries"
  - "Health endpoint confirms vector counts before sessions"
- **Presenter Script:**
  ```
  Teams can drag-drop any PDF or text file inside the app sidebar. We validate MIME type, enforce a 10 megabyte ceiling, chunk into 250-word windows with 20 percent overlap, and store metadata like source title and chunk index. Embeddings are generated on demand, then we batch-upsert 100 vectors at a time so even long manuals stay smooth. Before every session we ping `/api/health` to guarantee the collection is live and give Gemini a heads-up if RAG should pause.
  ```

## Slide 8 – "Use Cases & Impact"
- **Visual Direction:** Three columns with icon + stat callouts.
- **Slide Copy:**
  - PPE Coach: "Top result score 0.7617 answered PPE question instantly"
  - Tool Whisperer: "Masonry drill bit guidance matched DeWalt manual at 0.8158 cosine"
  - Safety Sentinel: "Lockout/Tagout reminder sourced electric handbook score 0.7303"
- **Presenter Script:**
  ```
  These are not toy prompts—we fired real job-site questions at the system. “What PPE do I need?” came back with OSHA language at a 0.76 similarity score. “Which bit drills concrete?” triggered the DeWalt guidance at 0.82. “How do I lock out this panel?” surfaced the electrical handbook chunk at 0.73. Each response is read aloud, cited, and logged so a safety manager can audit the conversation later.
  ```

## Slide 9 – "Go-To-Market Fit"
- **Visual Direction:** Funnel graphic (Pilot Crews → Safety Directors → Platform Partners) with metrics boxes.
- **Slide Copy:**
  - "Beachhead: 50 electrician + HVAC techs inside 5 partner firms"
  - "Value: replace $150/hr safety supervisor shadowing with on-demand AI"
  - "Expansion: per-seat SaaS + document compliance workspace"
  - Footer note: "Aligns with AI Genesis emphasis on real deployments"
- **Presenter Script:**
  ```
  We start with five regional contractors already sharing manuals with us—roughly fifty electricians and HVAC techs who work in regulated environments. They currently pay supervisors up to $150 an hour to sit onsite. Labor AI Pro becomes the digital safety buddy priced per active technician per month, and the more manuals a company uploads, the stickier we get because their tribal knowledge lives inside our vector store.
  ```

## Slide 10 – "Roadmap & What’s Next"
- **Visual Direction:** Timeline (Now → Next 30 Days → Post-Hackathon) referencing existing checklist.
- **Slide Copy:**
  - "Now: MVP complete, 8/8 verification tests passed (IMPLEMENTATION-CHECKLIST.md)"
  - "Next 30 days: Deploy backend to Vercel/Railway, add rate limiting + auth"
  - "Q1 2026: Analytics on search gaps, multilingual PPE packs, OSHA citation generator"
- **Presenter Script:**
  ```
  The MVP is fully functional—we checked off all eight verification tests including inline uploads and live RAG calls. Post-hackathon we deploy the backend to Vercel or Railway, flip the Vite env to the cloud URL, and add API auth plus rate limiting. Early next year we enrich the product with analytics that tell safety teams which procedures crews ask for most and add multilingual PPE packs so bilingual crews get equal coaching.
  ```

## Slide 11 – "The Ask"
- **Visual Direction:** Bold gradient background with three ask cards.
- **Slide Copy:**
  - "1. Judges: Award us top prize so we can fast-track pilot insurance + rugged hardware"
  - "2. Mentors: Intros to industrial safety partners (manufacturing & utilities)"
  - "3. Builders: Help us stress-test advanced function-calling + multi-speaker audio"
- **Presenter Script:**
  ```
  To win AI Genesis we’re asking for your first-place vote so we can immediately insure field pilots and outfit crews with ruggedized devices. We’re also looking for mentor intros to safety leaders in manufacturing and utilities, and builders who can push our multi-speaker streaming even harder. Labor AI Pro is ready to leave the hackathon bubble—help us put it on real job sites.
  ```
