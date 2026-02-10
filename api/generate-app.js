import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

export default app;
