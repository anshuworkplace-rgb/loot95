# LOOT 95 — Production Deployment Guide

> Step-by-step guide to host LOOT 95 online 24/7 on free/low-cost cloud infrastructure with real-time Amazon India deal data and Gemini AI evaluation.

---

## 1. Hosting Architecture Overview

```
 ┌───────────────────────────┐         ┌───────────────────────────┐
 │   Vercel (Frontend SPA)   │ ──────► │   Koyeb / Render (Backend)│
 │   https://loot95.vercel.app│  proxy  │   https://loot95.koyeb.app│
 └───────────────────────────┘         └─────────────┬─────────────┘
                                                     │
                                       ┌─────────────┴─────────────┐
                                       │ RapidAPI Amazon India     │
                                       │ Gemini AI Deal Judge      │
                                       │ Supabase PostgreSQL       │
                                       └───────────────────────────┘
```

| Component | Provider | Cost | Persistence / Specs |
|:---|:---|:---|:---|
| **Backend & Engine** | [Koyeb.com](https://www.koyeb.com/) or Render | **Free** | Always-on, 512MB RAM, 0.1 vCPU |
| **Frontend SPA** | [Vercel.com](https://vercel.com/) | **Free** | Global CDN, sub-50ms loading |
| **Database** | [Supabase.com](https://supabase.com/) | **Free** | 500MB PostgreSQL |
| **AI Deal Judge** | [Google AI Studio](https://aistudio.google.com/) | **Free** | Gemini 2.5 Flash API (15 RPM free) |
| **Real Amazon Data** | [RapidAPI](https://rapidapi.com/real-time-amazon-data) | **Free** | 100 real requests/month |

---

## 2. Deploying Backend to Koyeb (24/7 Always-On)

1. Sign up for a free account at [Koyeb.com](https://www.koyeb.com/).
2. Click **Create App** → Choose **GitHub** repository or **Docker**.
3. Point to your repository branch containing `loot95`. Koyeb will automatically detect the `Dockerfile`.
4. Add the following **Environment Variables** in the Koyeb dashboard:
   - `GEMINI_API_KEY`: *(Your Google AI Studio key)*
   - `RAPIDAPI_KEY`: *(Your RapidAPI key for real Amazon India data)*
   - `PORT`: `3001`
5. Click **Deploy**. Koyeb will build the image and give you a public URL (e.g. `https://loot95-backend.koyeb.app`).

---

## 3. Deploying Frontend to Vercel

1. Sign up for a free account at [Vercel.com](https://vercel.com/).
2. Click **Add New Project** → Import your repository containing `loot95`.
3. Framework Preset: **Vite**.
4. Root Directory: `./`.
5. Update `vercel.json` to proxy `/api/(.*)` to your Koyeb URL:
   ```json
   {
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "https://loot95-backend.koyeb.app/api/$1"
       }
     ]
   }
   ```
6. Click **Deploy**. Vercel will deploy the frontend SPA globally.

---

## 4. Setting Up Supabase PostgreSQL (Optional)

1. Create a free project at [Supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in Supabase dashboard.
3. Paste the contents of `server/db/schema.sql` and click **Run**.
4. Copy your Database Connection String (`DATABASE_URL`) from **Project Settings → Database**.
5. Add `DATABASE_URL` to your environment variables on Koyeb.

---

## 5. Activating Real Deal Data & API Keys

### Google Gemini API (Free)
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API Key** → Create Key in New Project.
3. Copy the key and set `GEMINI_API_KEY` in `.env`.

### RapidAPI Real Amazon India API (Free)
1. Visit [RapidAPI — Real Time Amazon Data](https://rapidapi.com/letscrape-6bef/api/real-time-amazon-data).
2. Click **Subscribe to Test** → Choose **Basic Free Plan**.
3. Copy your `x-rapidapi-key` and set `RAPIDAPI_KEY` in `.env`.

---

## 6. How to Verify Active Real Data

Once `RAPIDAPI_KEY` is set, the server log will show:
```
[RapidAPI Connector] Fetching live real-time Amazon.in data for query: "Sony wireless headphones deals"...
[RapidAPI Connector] Retrieved 18 live product listings from Amazon India.
[Pipeline] HOT | Score: 78.4 | Sony WH-1000XM5 | ₹21,990 (37% real discount) | 18ms
```
All deals fetched directly from Amazon.in will be processed through the LOOT 95 pipeline, scored, evaluated by Gemini AI, and pushed in real-time to your Vercel frontend!
