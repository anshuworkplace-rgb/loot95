# LOOT 95 — Production Launch Kit

> **AI-Powered Ultra-Rare Deal Intelligence Engine**
> 
> Continuously discovers extremely rare, genuinely exceptional e-commerce price events (especially 90–95%+ real discounts) across Indian marketplaces, verifies them intelligently, ranks them by statistical rarity, and delivers them with minimal latency.

---

## 🚀 Quick Production Launch Summary

### 1. Zero-Cost Online Hosting Architecture

| Component | Provider | Specs |
|:---|:---|:---|
| **Backend & Pipeline Engine** | [Koyeb](https://koyeb.com) / Render | Docker container, 24/7 always-on, 512MB RAM |
| **Frontend Terminal UI** | [Vercel](https://vercel.com) | Global static CDN distribution |
| **Real Deal Data** | [RapidAPI Amazon India](https://rapidapi.com/real-time-amazon-data) | Real-time Amazon.in pricing API |
| **AI Deal Judge** | [Google Gemini API](https://aistudio.google.com/) | Automated fake discount & seller audit |
| **Database** | [Supabase](https://supabase.com) | PostgreSQL persistence schema |

---

## 🛠️ Deployment Steps

### Option A — 1-Click Vercel + Koyeb Deployment

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/loot95.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy Engine to Koyeb**:
   - Go to [koyeb.com](https://koyeb.com) -> Create App -> GitHub.
   - Select repository `loot95`.
   - Add Environment Variables:
     - `GEMINI_API_KEY`: *(From Google AI Studio)*
     - `RAPIDAPI_KEY`: *(From RapidAPI)*
     - `PORT`: `3001`
   - Koyeb automatically builds via `Dockerfile`.

3. **Deploy Terminal UI to Vercel**:
   - Go to [vercel.com](https://vercel.com) -> New Project -> Import `loot95`.
   - Set framework to **Vite**.
   - Deploy!

---

## 💻 Local Execution & Testing

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Start local server + Vite dev UI concurrently
npm run dev:all
```

- **Terminal UI**: http://localhost:5173
- **Engine API**: http://localhost:3001
- **SSE Stream**: http://localhost:3001/api/events

---

## 🔬 Core Intelligence Engine Features

- **Real Economic Discount vs Displayed MRP Discount**: Calculates deviation from rolling historical median, eliminating artificially inflated MRP tricks.
- **Rarity Score (0–100)**: Percentile-based rarity calculation using z-scores and price frequency distributions.
- **Sleeping Product Hunter**: Detects products with historically flat prices that suddenly drop.
- **AI Deal Judge**: Automated sanity checks powered by Gemini API.
- **Manual Deal Evaluation**: Direct submission endpoint allowing instant evaluation of custom Amazon/Flipkart URLs (`POST /api/deals/submit`).
