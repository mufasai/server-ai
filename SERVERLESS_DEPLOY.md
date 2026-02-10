# Vercel Serverless Deployment Guide

## Structure

```
server/
├── api/
│   ├── extract-pdf.js      # PDF extraction serverless function
│   ├── chat.js              # Chat streaming serverless function
│   ├── generate-html.js     # HTML/CSS generator serverless function
│   ├── generate-app.js      # React app generator serverless function
│   └── health.js            # Health check serverless function
├── server.js                # Local development server only
├── package.json             # Node 24.x, pdf-parse 1.1.1
├── vercel.json              # Serverless routing config
└── .env                     # Environment variables
```

## Key Changes

### 1. Serverless Functions
Each API route is now an independent serverless function in `/api` folder.

### 2. PDF Parsing
Using `pdf-parse@1.1.1` with direct buffer parsing:
```javascript
import pdf from 'pdf-parse';
const data = await pdf(buffer);
```

### 3. No Server Lifecycle
- Removed `app.listen()`
- Removed server timeout configurations
- Each function exports `export default app`

### 4. Node.js Version
Locked to `24.x` in package.json engines field.

## Deploy

```bash
cd server
npm install
git add .
git commit -m "refactor: Convert to Vercel serverless functions"
git push origin main
```

Vercel will auto-deploy.

## Test Locally

```bash
cd server
npm install
npm run dev
```

Server runs on http://localhost:3001

## Environment Variables

Set in Vercel dashboard:
- `OPENROUTER_API_KEY`
- `HTTP_REFERER` (optional, defaults to localhost:5173)

## Endpoints

- `GET /health` - Health check
- `POST /api/extract-pdf` - PDF text extraction
- `POST /api/chat` - Chat streaming
- `POST /api/generate-html` - HTML/CSS generation
- `POST /api/generate-app` - React app generation
