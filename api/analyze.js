export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });

  const { keyword, focusKeyword, language, mode, options, customPrompt, systemPrompt } = req.body || {};
  if (!keyword) return res.status(400).json({ error: 'Keyword is required.' });

  const focus = (focusKeyword || keyword).trim();
  const lang = language || 'English';

  const sysPrompt = systemPrompt ||
    `You are a world-class SEO strategist with 10+ years of experience ranking content on Google. You produce precise, actionable, copy-ready SEO blueprints. Always respond with valid JSON only — no markdown fences, no explanation outside the JSON object.`;

  const userPrompt = customPrompt || buildDefaultPrompt(keyword, focus, lang);

  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4000,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const e = await geminiRes.json();
      return res.status(geminiRes.status).json({ error: e.error?.message || 'Gemini API error' });
    }

    const data = await geminiRes.json();
    const text = data.candidates[0].content.parts[0].text.trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function buildDefaultPrompt(keyword, focus, lang) {
  return `Generate a complete professional SEO content blueprint for:
Keyword: "${keyword}"
Focus Keyword: "${focus}"
Language: "${lang}"
Return ONLY valid JSON with these fields: keyword, focusKeyword, intent, difficulty, volumeTier, contentType, wordCount, writingTone, titles (array of 5), h1s (array of 3), metaDescription, metaDescriptionB, slug, keywords (object with primary/secondary/lsi/longtail/questions/avoid), outline (object with intro/sections/conclusion/cta), altTexts (array of 5), snippets (object with paragraph/table/faqs), schema (object with type/code), openGraph (title/description), twitter (title/description), internalLinks (anchors/hubTopics/strategy), checklist (array of 40 items with id/cat/task/priority).`;
}
