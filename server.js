import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for image uploads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Increase timeout for long streaming responses
app.use((req, res, next) => {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Agent Router Proxy is running' });
});

// PDF extraction endpoint (Vercel-compatible, no OCR)
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

        // Use pdfjs-dist with Node.js canvas for serverless compatibility
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        // Configure for Node.js environment
        const NodeCanvasFactory = (await import('canvas')).default;

        // Create a custom canvas factory for Node.js
        class NodeCanvasFactoryImpl {
            create(width, height) {
                const { createCanvas } = NodeCanvasFactory;
                const canvas = createCanvas(width, height);
                return {
                    canvas,
                    context: canvas.getContext('2d')
                };
            }

            reset(canvasAndContext, width, height) {
                canvasAndContext.canvas.width = width;
                canvasAndContext.canvas.height = height;
            }

            destroy(canvasAndContext) {
                canvasAndContext.canvas.width = 0;
                canvasAndContext.canvas.height = 0;
                canvasAndContext.canvas = null;
                canvasAndContext.context = null;
            }
        }

        // Load PDF with Node.js configuration
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/standard_fonts/',
            canvasFactory: new NodeCanvasFactoryImpl(),
            isEvalSupported: false,
        });

        const pdf = await loadingTask.promise;

        let fullText = '';
        const numPages = pdf.numPages;
        let hasText = false;

        // Extract text from each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');

            if (pageText.trim().length > 0) {
                hasText = true;
                fullText += pageText + '\n\n';
            }
        }

        // If no text found, return helpful message
        if (!hasText || fullText.trim().length < 50) {
            console.log('No text found in PDF');
            fullText = '[This PDF appears to be a scan or contains only images. Please use a PDF with selectable text, or try uploading the image directly using the vision model (GPT-4o Mini or Qwen 2.5 VL).]';
        }

        console.log(`PDF extraction completed: ${numPages} pages, ${fullText.length} characters`);

        res.json({
            text: fullText.trim(),
            pages: numPages,
            info: {},
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

// Generate HTML/CSS endpoint for inline preview
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
                'HTTP-Referer': 'http://localhost:5173',
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
                // Keep default error message
            }

            return res.status(response.status).json({
                error: errorMessage,
                details: errorText
            });
        }

        const data = await response.json();
        const generatedContent = data.choices[0].message.content;

        console.log('Generated HTML/CSS:', generatedContent.substring(0, 200));

        // Parse JSON response
        let parsedCode;
        try {
            let jsonContent = generatedContent;

            // Remove markdown code blocks
            jsonContent = jsonContent.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/\n```/g, '').replace(/```/g, '');

            // Try to find JSON object
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

// App Builder endpoint - Generate full React app
app.post('/api/generate-app', async (req, res) => {
    try {
        const { prompt, model } = req.body;

        console.log('Generating app with prompt:', prompt);

        // System prompt untuk generate React app structure
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

        // Call OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:5173',
                'X-Title': 'MUZ AI App Builder'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 3000  // Reduced from 4000 to avoid credit issues
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);

            // Parse error untuk user-friendly message
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
                // Keep default error message
            }

            return res.status(response.status).json({
                error: errorMessage,
                details: errorText
            });
        }

        const data = await response.json();
        const generatedContent = data.choices[0].message.content;

        console.log('Generated content:', generatedContent.substring(0, 200));

        // Parse JSON response
        let parsedFiles;
        try {
            // Try to extract JSON from markdown code blocks if present
            let jsonContent = generatedContent;

            // Remove markdown code blocks
            jsonContent = jsonContent.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/\n```/g, '').replace(/```/g, '');

            // Try to find JSON object
            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            }

            parsedFiles = JSON.parse(jsonContent);

            // Post-process: Remove invalid CSS imports from component files
            if (parsedFiles.files) {
                Object.keys(parsedFiles.files).forEach(filename => {
                    if (filename.endsWith('.js') && filename !== '/App.js') {
                        // Remove CSS imports from component files (except App.js)
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

// Proxy endpoint untuk chat completions
app.post('/api/chat', async (req, res) => {
    try {
        const { model, messages } = req.body;

        console.log('Received request:', { model, messageCount: messages?.length });

        // Validasi input
        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request. Required: model (string) and messages (array)'
            });
        }

        // Kirim request ke OpenRouter (alternatif yang lebih cocok untuk web apps)
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:5173',
                'X-Title': 'MUZ AI'
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true
            })
            // Removed timeout - let it run as long as needed
        });

        console.log('Agent Router response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Agent Router error:', errorText);
            return res.status(response.status).json({
                error: `Agent Router API error: ${response.status}`,
                details: errorText
            });
        }

        // Set headers untuk streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Stream response dari Agent Router ke client
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Handle client disconnect
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

                // Log first chunk to see what we're getting
                if (chunkCount === 1) {
                    console.log('First chunk received:', chunk.substring(0, 100));
                }

                // Filter out OPENROUTER PROCESSING messages
                if (chunk.includes('OPENROUTER PROCESSING')) {
                    console.log('Skipping OPENROUTER PROCESSING message');
                    continue;
                }

                // Check if client is still connected
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

// Start server with extended timeouts
const server = app.listen(PORT, () => {
    console.log(`🚀 Agent Router Proxy running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
});

// Set server timeout for long streaming responses
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000; // 5 minutes
server.headersTimeout = 310000; // Slightly more than keepAliveTimeout
