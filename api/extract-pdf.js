import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/extract-pdf', async (req, res) => {
    try {
        const { pdfBase64 } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ error: 'PDF base64 data is required' });
        }

        console.log('Extracting PDF text...');

        // Convert base64 to buffer
        const pdfData = pdfBase64.split(',')[1] || pdfBase64;
        const pdfBuffer = Buffer.from(pdfData, 'base64');

        // Parse PDF using serverless-safe method
        const data = await pdf(pdfBuffer);

        let fullText = data.text;
        const numPages = data.numpages;
        let hasText = fullText && fullText.trim().length > 0;

        // If no text found, return helpful message
        if (!hasText || fullText.trim().length < 50) {
            console.log('No text found in PDF');
            fullText = '[This PDF appears to be a scan or contains only images. Please use a PDF with selectable text, or try uploading the image directly using the vision model (GPT-4o Mini or Qwen 2.5 VL).]';
        }

        console.log(`PDF extraction completed: ${numPages} pages, ${fullText.length} characters`);

        res.json({
            text: fullText.trim(),
            pages: numPages,
            info: data.info || {},
            usedOCR: false,
            message: !hasText ? 'PDF contains no selectable text. Try using vision model with image upload instead.' : undefined
        });

    } catch (error) {
        console.error('PDF extraction error:', error);
        res.status(500).json({
            error: 'Failed to extract PDF',
            message: error.message,
            suggestion: 'Make sure the PDF contains selectable text (not a scan). For scanned PDFs, try uploading as an image with a vision model instead.'
        });
    }
});

export default app;
