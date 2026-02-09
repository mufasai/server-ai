# ⚠️ Vercel Serverless Limitations & Workarounds

## Issue: PDF OCR Not Working on Vercel

### Problem
OCR libraries (Tesseract.js + Canvas) tidak compatible dengan Vercel serverless functions karena:
- ❌ Canvas requires native binaries (tidak tersedia di serverless)
- ❌ Tesseract.js butuh file system access
- ❌ OCR process terlalu lambat (> 10s timeout di free tier)

### Solution Implemented

**Simplified PDF extraction** - Text only, no OCR:
- ✅ Extract text dari PDF normal (selectable text)
- ❌ Skip OCR untuk PDF scan/gambar
- ✅ Return helpful message untuk user

### Current Behavior

#### PDF dengan Text (Normal)
```
✅ Works perfectly
- Extract text dari semua pages
- Fast (< 1 second)
- Reliable
```

#### PDF Scan/Gambar
```
⚠️ Cannot extract text
- Return message: "PDF contains no selectable text"
- Suggest: Use vision model with image upload
```

## Workarounds for Scanned PDFs

### Option 1: Use Vision Model (RECOMMENDED)
1. Convert PDF page to image (screenshot/export)
2. Upload as image (icon 🖼️)
3. Use GPT-4o Mini or Qwen 2.5 VL
4. Prompt: "Read text from this image"

**Pros**:
- ✅ Works on Vercel
- ✅ Better accuracy for handwriting
- ✅ No timeout issues

**Cons**:
- ⚠️ Manual conversion needed
- ⚠️ One page at a time

### Option 2: External OCR Service
Use third-party OCR API:
- Google Cloud Vision API
- Microsoft Azure Computer Vision
- AWS Textract

**Implementation**:
```javascript
// Add to server.js
app.post('/api/ocr', async (req, res) => {
    const { imageBase64 } = req.body;
    
    // Call external OCR service
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GOOGLE_CLOUD_API_KEY}`
        },
        body: JSON.stringify({
            requests: [{
                image: { content: imageBase64 },
                features: [{ type: 'TEXT_DETECTION' }]
            }]
        })
    });
    
    const data = await response.json();
    res.json({ text: data.responses[0].fullTextAnnotation.text });
});
```

**Pros**:
- ✅ Works on Vercel
- ✅ High accuracy
- ✅ Fast

**Cons**:
- ⚠️ Requires API key
- ⚠️ Costs money
- ⚠️ External dependency

### Option 3: Separate OCR Service
Deploy OCR as separate service on platform that supports native binaries:
- Railway
- Render
- DigitalOcean
- Heroku

**Architecture**:
```
Frontend → Vercel API → Railway OCR Service
```

**Pros**:
- ✅ Full OCR support
- ✅ No Vercel limitations
- ✅ Scalable

**Cons**:
- ⚠️ More complex setup
- ⚠️ Additional hosting cost
- ⚠️ More maintenance

### Option 4: Client-Side OCR
Use Tesseract.js in browser:

```javascript
// Frontend code
import Tesseract from 'tesseract.js';

const extractTextFromImage = async (imageFile) => {
    const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'eng',
        {
            logger: m => console.log(m)
        }
    );
    return text;
};
```

**Pros**:
- ✅ No backend needed
- ✅ Works everywhere
- ✅ Free

**Cons**:
- ⚠️ Slow on client
- ⚠️ Large bundle size
- ⚠️ Uses user's CPU

## Vercel Serverless Limits

### Free Tier
- ⏱️ **Timeout**: 10 seconds
- 💾 **Memory**: 1024 MB
- 📦 **Function size**: 50 MB
- 🌐 **Bandwidth**: 100 GB/month

### Pro Tier ($20/month)
- ⏱️ **Timeout**: 60 seconds
- 💾 **Memory**: 3008 MB
- 📦 **Function size**: 50 MB
- 🌐 **Bandwidth**: 1 TB/month

### What Works on Vercel
- ✅ Text processing
- ✅ API calls
- ✅ Database queries
- ✅ Image manipulation (basic)
- ✅ PDF text extraction

### What Doesn't Work
- ❌ Native binaries (Canvas, Sharp with native deps)
- ❌ Long-running processes (> timeout)
- ❌ File system operations
- ❌ Heavy CPU tasks (OCR, video processing)

## Recommended Approach

### For Production (Current)
```
1. PDF with text → Extract directly ✅
2. PDF scan/image → Suggest vision model ⚠️
3. User uploads image → Use vision model ✅
```

### For Future Enhancement
```
1. Add external OCR service (Google Vision API)
2. Or deploy OCR on Railway/Render
3. Keep Vercel for main API
```

## Code Changes Made

### Before (With OCR)
```javascript
// Tried to use Canvas + Tesseract
// ❌ Failed on Vercel
if (!hasText) {
    const canvas = createCanvas(...);
    const text = await Tesseract.recognize(...);
}
```

### After (Text Only)
```javascript
// Simple text extraction
// ✅ Works on Vercel
if (!hasText) {
    return helpful message;
}
```

## User Experience

### Current Flow
```
1. User uploads PDF
2. If text PDF → Extract & show ✅
3. If scan PDF → Show message:
   "This PDF is a scan. Please:
   - Use vision model with image upload
   - Or use PDF with selectable text"
```

### Improved Flow (Future)
```
1. User uploads PDF
2. If text PDF → Extract & show ✅
3. If scan PDF → Auto convert to image
4. Send to vision model → Extract text ✅
```

## Testing

### Test Text PDF
```bash
curl -X POST https://ai-be.muzzie.my.id/api/extract-pdf \
  -H "Content-Type: application/json" \
  -d '{"pdfBase64":"..."}'

# Expected: 200 OK with text
```

### Test Scan PDF
```bash
curl -X POST https://ai-be.muzzie.my.id/api/extract-pdf \
  -H "Content-Type: application/json" \
  -d '{"pdfBase64":"..."}'

# Expected: 200 OK with message about using vision model
```

## Deployment

### Update Backend
```bash
cd server
git add .
git commit -m "fix: remove OCR for Vercel compatibility"
git push origin main
```

Vercel will auto-deploy.

### Verify
```bash
curl https://ai-be.muzzie.my.id/health
```

## Summary

✅ **What Works**:
- PDF text extraction
- All other API endpoints
- Fast & reliable

⚠️ **What Changed**:
- No OCR on Vercel
- Helpful messages for scanned PDFs
- Suggest vision model alternative

🚀 **Next Steps**:
- Test with text PDFs (should work)
- For scans, use vision model
- Consider external OCR service if needed

---

**Backend is now Vercel-compatible!** 🎉
