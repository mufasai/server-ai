// Local development server only
// Vercel uses serverless functions in /api folder
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Agent Router Proxy is running' });
});

// PDF extraction
app.post('/api/extract-pdf', async (req, res) => {
    try {
        const { pdfBase64 } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ error: 'PDF base64 data is required' });
        }

        console.log('Extracting PDF text...');

        const pdfData = pdfBase64.split(',')[1] || pdfBase64;
        const pdfBuffer = Buffer.from(pdfData, 'base64');

        const data = await pdf(pdfBuffer);

        let fullText = data.text;
        const numPages = data.numpages;
        let hasText = fullText && fullText.trim().length > 0;

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

// Generate HTML/CSS
app.post('/api/generate-html', async (req, res) => {
    try {
        const { prompt, model } = req.body;

        console.log('Generating HTML/CSS with prompt:', prompt);

        const systemPrompt = `You are an expert web developer. Generate beautiful, modern HTML and CSS code based on user requirements.

RESPONSE FORMAT (STRICTLY ENFORCE):
Return ONLY valid JSON:
{
  "html": "<div>HTML code here</div>",
  "css": "CSS code here",
  "js": "JavaScript code here (optional)"
}

REQUIREMENTS:
- Generate clean, semantic HTML
- Include modern, beautiful CSS styling
- Make it responsive
- Add appropriate spacing, colors, and typography
- Include hover effects and transitions
- NO markdown, NO explanations, ONLY JSON
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags in HTML (only the content)
- Do NOT include <style> or <script> tags (separate them into css and js fields)

EXAMPLE:
{
  "html": "<div class=\\"hero\\">\\n  <h1>Welcome</h1>\\n  <p>Beautiful landing page</p>\\n</div>",
  "css": ".hero { padding: 80px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }\\n.hero h1 { font-size: 48px; margin-bottom: 16px; }",
  "js": ""
}

NOW: Generate beautiful HTML/CSS code for the user's request.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:5173',
                'X-Title': 'MUZ AI Chat'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);

            let errorMessage = 'Failed to generate code';
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.code === 402) {
                    errorMessage = 'Credit OpenRouter habis!';
                } else if (errorData.error?.code === 429) {
                    errorMessage = 'Model sedang rate limited.';
                } else {
                    errorMessage = errorData.error?.message || errorMessage;
                }
            } catch (e) {
                // Keep default
            }

            return res.status(response.status).json({
                error: errorMessage,
                details: errorText
            });
        }

        const data = await response.json();
        const generatedContent = data.choices[0].message.content;

        console.log('Generated HTML/CSS:', generatedContent.substring(0, 200));

        let parsedCode;
        try {
            let jsonContent = generatedContent;
            jsonContent = jsonContent.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/\n```/g, '').replace(/```/g, '');

            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            }

            parsedCode = JSON.parse(jsonContent);

        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse generated code',
                details: generatedContent.substring(0, 500)
            });
        }

        res.json(parsedCode);

    } catch (error) {
        console.error('Generate HTML error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Generate React app
app.post('/api/generate-app', async (req, res) => {
    try {
        const { prompt, model } = req.body;

        console.log('Generating app with prompt:', prompt);

        const systemPrompt = `You are an expert React developer and modern UI/UX designer. Generate beautiful, production-ready React applications.

DESIGN PHILOSOPHY:
Create visually appealing, modern interfaces with:
- Clean, intuitive layouts
- Thoughtful use of colors, spacing, and typography
- Smooth interactions and animations where appropriate
- Responsive design that works on all devices

TECHNICAL REQUIREMENTS:
- Use functional React components with hooks
- Create separate component files for better organization
- Include comprehensive CSS styling
- Make it responsive and accessible
- Add proper imports and exports

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown, no explanations):
{
  "files": {
    "/App.js": "component code here",
    "/components/ComponentName.js": "component code here",
    "/styles.css": "CSS code here"
  }
}

STYLING APPROACH:
- Use modern CSS (flexbox, grid, CSS variables)
- Add appropriate spacing, shadows, and border-radius
- Include hover effects for interactive elements
- Use a cohesive color scheme
- Make typography clear and readable

Be creative and adapt your design to match the user's requirements. Focus on creating something that looks professional and feels polished, but don't be overly rigid about specific measurements or styles.

NOW: Generate a beautiful React app based on the user's request.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:5173',
                'X-Title': 'MUZ AI App Builder'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 3000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);

            let errorMessage = 'Failed to generate app';
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.code === 402) {
                    errorMessage = 'Credit OpenRouter habis! Silakan top up di https://openrouter.ai/settings/credits atau gunakan model lain.';
                } else if (errorData.error?.code === 429) {
                    errorMessage = 'Model sedang rate limited. Coba lagi dalam beberapa menit atau gunakan model lain.';
                } else {
                    errorMessage = errorData.error?.message || errorMessage;
                }
            } catch (e) {
                // Keep default
            }

            return res.status(response.status).json({
                error: errorMessage,
                details: errorText
            });
        }

        const data = await response.json();
        const generatedContent = data.choices[0].message.content;

        console.log('Generated content:', generatedContent.substring(0, 200));

        let parsedFiles;
        try {
            let jsonContent = generatedContent;
            jsonContent = jsonContent.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/\n```/g, '').replace(/```/g, '');

            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            }

            parsedFiles = JSON.parse(jsonContent);

            if (parsedFiles.files) {
                Object.keys(parsedFiles.files).forEach(filename => {
                    if (filename.endsWith('.js') && filename !== '/App.js') {
                        parsedFiles.files[filename] = parsedFiles.files[filename]
                            .replace(/import\s+['"]\.\/[^'"]*\.css['"];?\n?/g, '')
                            .replace(/import\s+['"]\.\.\/[^'"]*\.css['"];?\n?/g, '');
                    }
                });
            }

        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse generated code. AI mungkin return format yang salah. Coba lagi atau gunakan model lain.',
                details: generatedContent.substring(0, 500)
            });
        }

        res.json(parsedFiles);

    } catch (error) {
        console.error('Generate app error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Chat streaming
app.post('/api/chat', async (req, res) => {
    try {
        const { model, messages } = req.body;

        console.log('Received request:', { model, messageCount: messages?.length });

        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request. Required: model (string) and messages (array)'
            });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:5173',
                'X-Title': 'MUZ AI'
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true
            })
        });

        console.log('OpenRouter response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);
            return res.status(response.status).json({
                error: `OpenRouter API error: ${response.status}`,
                details: errorText
            });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        req.on('close', () => {
            console.log('Client disconnected, closing stream');
            reader.cancel();
        });

        let chunkCount = 0;
        let totalBytes = 0;
        const startTime = Date.now();

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    const duration = Date.now() - startTime;
                    console.log(`Stream completed - Chunks: ${chunkCount}, Bytes: ${totalBytes}, Duration: ${duration}ms`);
                    res.end();
                    break;
                }

                chunkCount++;
                totalBytes += value.length;

                const chunk = decoder.decode(value, { stream: true });

                if (chunkCount === 1) {
                    console.log('First chunk received:', chunk.substring(0, 100));
                }

                if (chunk.includes('OPENROUTER PROCESSING')) {
                    console.log('Skipping OPENROUTER PROCESSING message');
                    continue;
                }

                if (res.writableEnded) {
                    console.log('Response already ended');
                    break;
                }

                res.write(chunk);
            }
        } catch (streamError) {
            console.error('Stream error:', streamError);
            if (!res.writableEnded) {
                res.end();
            }
        }

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Internal proxy error',
            message: error.message
        });
    }
});

// Local development only
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Agent Router Proxy running on http://localhost:${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/health`);
        console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
    });
}

export default app;
