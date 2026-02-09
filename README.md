# MUZ AI - Backend Proxy untuk Agent Router

Backend proxy sederhana untuk menghubungkan frontend dengan Agent Router API.

## Setup

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Konfigurasi environment:**
File `.env` sudah dibuat dengan API key Anda. Jika perlu ubah:
```
AGENT_ROUTER_API_KEY=your-api-key-here
PORT=3001
```

3. **Jalankan server:**
```bash
npm run dev
```

Server akan berjalan di `http://localhost:3001`

## Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Chat completion endpoint

### Request Format (POST /api/chat)

```json
{
  "model": "deepseek-v3.2",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
```

### Response

Server-Sent Events (SSE) stream dengan format OpenAI.

## Testing

Test dengan curl:
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Deploy (Optional)

Backend ini bisa di-deploy ke:
- **Vercel** (gratis)
- **Railway** (gratis)
- **Render** (gratis)
- **Heroku** (berbayar)

Tinggal push ke GitHub dan connect ke platform tersebut.
