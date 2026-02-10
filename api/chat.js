import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

export default app;
