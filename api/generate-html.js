import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

export default app;
