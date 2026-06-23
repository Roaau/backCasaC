const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export const getStatus = (req, res) => {
  res.json({ tieneKey: !!process.env.CLAUDE_API_KEY });
};

export const consultar = async (req, res) => {
  try {
    const key = process.env.CLAUDE_API_KEY;
    if (!key) return res.status(402).json({ error: 'IA no disponible en este servidor.' });

    const { system: sistemaPrompt, prompt, max_tokens = 1200 } = req.body;

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens,
        system: sistemaPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      return res.status(response.status).json({ error: `Error Anthropic: ${txt}` });
    }

    const data = await response.json();
    res.json({ texto: data.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
