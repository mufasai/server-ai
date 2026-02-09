# 🚀 MUZ AI Backend Server

Backend API server untuk MUZ AI Chat application.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **AI Provider**: OpenRouter API
- **PDF Processing**: pdfjs-dist
- **OCR**: Tesseract.js (optional)
- **Deployment**: Vercel

## Features

- ✅ AI Chat streaming (SSE)
- ✅ HTML/CSS code generation
- ✅ React app generation
- ✅ PDF text extraction
- ✅ OCR for scanned PDFs
- ✅ Multi-model support

## Environment Variables

Create `.env` file:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=3001
```

## Local Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

Server will run on `http://localhost:3001`

### Test Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Expected: {"status":"ok","message":"Agent Router Proxy is running"}
```

## API Endpoints

### 1. Health Check
```
GET /health
```

### 2. Chat Completion (Streaming)
```
POST /api/chat
Content-Type: application/json

{
  "model": "deepseek/deepseek-chat",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

### 3. Generate HTML/CSS
```
POST /api/generate-html
Content-Type: application/json

{
  "prompt": "Create a landing page",
  "model": "deepseek/deepseek-chat"
}
```

### 4. Generate React App
```
POST /api/generate-app
Content-Type: application/json

{
  "prompt": "Create a todo app",
  "model": "deepseek/deepseek-chat"
}
```

### 5. Extract PDF Text
```
POST /api/extract-pdf
Content-Type: application/json

{
  "pdfBase64": "data:application/pdf;base64,..."
}
```

## Deployment to Vercel

### Prerequisites
- Vercel account
- Vercel CLI installed: `npm i -g vercel`

### Step 1: Login to Vercel
```bash
vercel login
```

### Step 2: Deploy
```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

### Step 3: Set Environment Variables

Via Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key

Or via CLI:
```bash
vercel env add OPENROUTER_API_KEY
```

### Step 4: Get Deployment URL

After deployment, you'll get a URL like:
```
https://your-project-name.vercel.app
```

### Step 5: Update Frontend

Update frontend `.env`:
```env
VITE_PROXY_URL=https://your-project-name.vercel.app
```

## Vercel Configuration

The `vercel.json` file configures:
- Build settings
- Routes
- Environment

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

## CORS Configuration

Server allows all origins by default. For production, update CORS:

```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

## Performance

### Timeouts
- Request timeout: 5 minutes
- Keep-alive timeout: 5 minutes
- Headers timeout: 5.1 minutes

### Limits
- JSON body: 50MB (for PDF uploads)
- URL encoded: 50MB

## Troubleshooting

### Error: "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "Port already in use"
```bash
lsof -ti:3001 | xargs kill -9
npm run dev
```

### Error: "OpenRouter API error"
- Check API key is valid
- Check credit balance
- Check model availability

### Vercel Deployment Issues

1. **Build fails**:
   - Check Node.js version (use 18.x or 20.x)
   - Verify all dependencies in package.json

2. **Function timeout**:
   - Vercel free tier: 10s timeout
   - Upgrade to Pro for 60s timeout
   - Or optimize long-running operations

3. **Environment variables not working**:
   - Redeploy after adding env vars
   - Check variable names (case-sensitive)

## Monitoring

### Logs
```bash
# Vercel logs
vercel logs

# Follow logs
vercel logs --follow
```

### Analytics
Check Vercel dashboard for:
- Request count
- Response times
- Error rates
- Bandwidth usage

## Security

### Best Practices
- ✅ Use environment variables for secrets
- ✅ Enable CORS only for trusted domains
- ✅ Validate all inputs
- ✅ Rate limit API endpoints
- ✅ Monitor API usage

### Rate Limiting (Optional)
```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Scaling

### Vercel Serverless
- Auto-scales based on traffic
- No server management needed
- Pay per execution

### Alternative Deployments
- **Railway**: `railway up`
- **Render**: Connect GitHub repo
- **Heroku**: `git push heroku main`
- **DigitalOcean**: App Platform

## Support

For issues or questions:
1. Check logs: `vercel logs`
2. Review documentation
3. Check OpenRouter status
4. Contact support

## License

MIT

---

**Ready to deploy!** 🚀
