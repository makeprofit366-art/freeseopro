export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server.' });

  const { keyword, focusKeyword, language, mode, options, customPrompt, systemPrompt } = req.body || {};
  if (!keyword) return res.status(400).json({ error: 'Keyword is required.' });

  const focus = (focusKeyword || keyword).trim();
  const lang = language || 'English';

  const sysPrompt = systemPrompt ||
    `You are a world-class SEO content strategist with 15+ years ranking content on Google.
RULES YOU MUST FOLLOW:
1. Return ONLY valid JSON — zero markdown, zero explanation, no code fences.
2. Every string value must be COMPLETE and DETAILED — never use placeholders like "TITLE" or "META".
3. metaDescription and metaDescriptionB MUST be fully written 150-158 character sentences with the focus keyword and a CTA.
4. intro and conclusion MUST be full copy-ready paragraphs (3 sentences minimum each).
5. Every title MUST be a real, specific, compelling title under 60 characters with a power word or number.
6. All FAQ answers must be full 40-50 word answers, not placeholders.
7. Schema "code" field must be real valid JSON-LD string with actual values filled in, not placeholder text.
8. NEVER truncate. NEVER use "..." or leave arrays empty.`;

  const userPrompt = customPrompt || buildDefaultPrompt(keyword, focus, lang);

  // Retry logic — try up to 2 times for JSON parse errors
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: attempt === 0 ? 0.3 : 0.2,  // lower temp on retry
          max_tokens: 6000,                          // increased from 4000
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!groqRes.ok) {
        const e = await groqRes.json();
        return res.status(groqRes.status).json({ error: e.error?.message || 'Groq API error' });
      }

      const data = await groqRes.json();
      const raw = data.choices[0].message.content.trim();

      // Clean up any accidental markdown fences
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      // Quality check — if meta is empty or too short, still return but flag
      if (parsed.metaDescription && parsed.metaDescription.length < 50) {
        parsed._warning = 'Meta description may be incomplete. Try regenerating.';
      }

      return res.status(200).json(parsed);

    } catch (err) {
      lastErr = err;
      // Wait 300ms before retry
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return res.status(500).json({ error: lastErr?.message || 'Failed after 2 attempts. Try again.' });
}

function buildDefaultPrompt(keyword, focus, lang) {
  return `Generate a COMPLETE, DETAILED professional SEO content blueprint.
Keyword: "${keyword}"
Focus Keyword: "${focus}"
Language: "${lang}"

CRITICAL: Every field must have REAL, COMPLETE content. No placeholders. No truncation.

Return ONLY this exact JSON structure with all fields fully filled:
{
  "keyword": "${keyword}",
  "focusKeyword": "${focus}",
  "intent": "one of: Informational, Commercial, Transactional, Navigational",
  "difficulty": "one of: Easy, Medium, Hard",
  "volumeTier": "one of: Low (<1k), Medium (1k-10k), High (10k-100k), Very High (100k+)",
  "contentType": "one of: Blog Post, Pillar Page, How-To Guide, Listicle, Product Page",
  "wordCount": "e.g. 1800-2500 words",
  "writingTone": "one of: Conversational, Professional, Educational, Technical",

  "titles": [
    "Real title with power word + number + ${focus} — under 60 chars",
    "Real question-format title with ${focus} — under 60 chars",
    "Real how-to title with ${focus} — under 60 chars",
    "Real listicle title with benefit — under 60 chars",
    "Real emotional urgency title — under 60 chars"
  ],

  "h1s": [
    "Real H1 with ${focus} — can be longer than title",
    "Real H1 option 2 — different angle",
    "Real H1 option 3 — conversational tone"
  ],

  "metaDescription": "WRITE a full, real 150-158 character meta description. Must contain '${focus}', be compelling, and end with a CTA like 'Read now' or 'Learn more'.",

  "metaDescriptionB": "WRITE a different full 150-158 character meta description. Different angle, must include '${focus}', ends with CTA.",

  "slug": "${focus.toLowerCase().replace(/\s+/g,'-')}-complete-guide",

  "keywords": {
    "primary": "${focus}",
    "secondary": ["real secondary kw 1", "real secondary kw 2", "real secondary kw 3", "real secondary kw 4", "real secondary kw 5", "real secondary kw 6"],
    "lsi": ["real lsi kw 1", "real lsi kw 2", "real lsi kw 3", "real lsi kw 4", "real lsi kw 5", "real lsi kw 6"],
    "longtail": ["real long tail phrase 1", "real long tail phrase 2", "real long tail phrase 3", "real long tail phrase 4", "real long tail phrase 5"],
    "questions": ["Real people also ask question 1?", "Real question 2?", "Real question 3?", "Real question 4?", "Real question 5?"],
    "avoid": ["negative kw 1", "negative kw 2", "negative kw 3"]
  },

  "outline": {
    "intro": "WRITE a full 3-sentence intro paragraph that hooks the reader, identifies the problem they face, and promises a solution. Must contain '${focus}'. Copy-ready to paste into article.",

    "sections": [
      {"h2": "Real H2 with secondary keyword", "h3s": ["Real H3 subheading 1", "Real H3 subheading 2", "Real H3 subheading 3"], "tip": "Detailed writing tip for this section"},
      {"h2": "Real H2 heading 2", "h3s": ["Real H3 a", "Real H3 b"], "tip": "Detailed writing tip"},
      {"h2": "Real H2 heading 3", "h3s": ["Real H3 a", "Real H3 b", "Real H3 c"], "tip": "Detailed writing tip"},
      {"h2": "Real H2 heading 4", "h3s": ["Real H3 a", "Real H3 b"], "tip": "Detailed writing tip"},
      {"h2": "FAQ: Common Questions About ${keyword}", "h3s": ["Real FAQ question 1?", "Real FAQ question 2?", "Real FAQ question 3?"], "tip": "Answer each FAQ concisely in 40-60 words"}
    ],

    "conclusion": "WRITE a full 3-sentence conclusion paragraph. Summarizes the key takeaway. Restates '${focus}'. Ends with a clear call to action. Copy-ready.",

    "cta": "Specific, actionable CTA recommendation for this article"
  },

  "altTexts": [
    "Real feature image alt text with ${focus} and descriptive context",
    "Real section image 1 alt text with secondary keyword",
    "Real infographic alt text describing the visual",
    "Real supporting image alt text",
    "Real closing image alt text with CTA context"
  ],

  "snippets": {
    "paragraph": "WRITE a full 45-50 word direct-answer paragraph targeting featured snippet position. Starts with a direct definition or answer. Contains '${focus}'. Factual and concise.",

    "table": {
      "caption": "Real comparison table title for ${keyword}",
      "headers": ["Real Column 1", "Real Column 2", "Real Column 3"],
      "rows": [
        ["Real r1c1", "Real r1c2", "Real r1c3"],
        ["Real r2c1", "Real r2c2", "Real r2c3"],
        ["Real r3c1", "Real r3c2", "Real r3c3"],
        ["Real r4c1", "Real r4c2", "Real r4c3"]
      ]
    },

    "faqs": [
      {"q": "Real FAQ question 1?", "a": "WRITE a full 40-50 word direct answer to this question. Include ${focus} naturally. Be specific and useful."},
      {"q": "Real FAQ question 2?", "a": "WRITE a full 40-50 word direct answer. Specific and actionable."},
      {"q": "Real FAQ question 3?", "a": "WRITE a full 40-50 word direct answer. Specific and actionable."},
      {"q": "Real FAQ question 4?", "a": "WRITE a full 40-50 word direct answer. Specific and actionable."}
    ]
  },

  "schema": {
    "type": "Article",
    "code": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"REPLACE WITH REAL TITLE\\",\\"description\\":\\"REPLACE WITH REAL META\\",\\"author\\":{\\"@type\\":\\"Person\\",\\"name\\":\\"Author Name\\"},\\"datePublished\\":\\"2025-01-01\\"}"
  },

  "openGraph": {
    "title": "Real OG title under 60 chars with ${focus}",
    "description": "Real OG description under 200 chars. Compelling. Contains ${focus}."
  },

  "twitter": {
    "title": "Real Twitter title with ${focus}",
    "description": "Real Twitter description under 200 chars. Engaging."
  },

  "internalLinks": {
    "anchors": ["real anchor text 1", "real anchor text 2", "real anchor text 3", "real anchor text 4"],
    "hubTopics": ["real related hub topic 1", "real related hub topic 2", "real related hub topic 3"],
    "strategy": "One clear, specific sentence explaining internal linking strategy for this article."
  },

  "checklist": [
    {"id":"t1","cat":"Title","task":"Title contains focus keyword in first 3 words","priority":"critical"},
    {"id":"t2","cat":"Title","task":"Title tag is under 60 characters","priority":"critical"},
    {"id":"t3","cat":"Title","task":"Title has a power word, number, or emotion trigger","priority":"high"},
    {"id":"h1","cat":"H1","task":"H1 tag is set and includes focus keyword","priority":"critical"},
    {"id":"h2","cat":"H1","task":"H1 is different wording from the title tag","priority":"medium"},
    {"id":"m1","cat":"Meta","task":"Meta description is written (150-158 chars)","priority":"critical"},
    {"id":"m2","cat":"Meta","task":"Meta description includes focus keyword naturally","priority":"critical"},
    {"id":"m3","cat":"Meta","task":"Meta description ends with a clear CTA","priority":"high"},
    {"id":"u1","cat":"URL","task":"Slug uses focus keyword, hyphens, no stop words","priority":"critical"},
    {"id":"u2","cat":"URL","task":"Slug is under 75 characters total","priority":"medium"},
    {"id":"k1","cat":"Keywords","task":"Focus keyword appears in first 100 words","priority":"critical"},
    {"id":"k2","cat":"Keywords","task":"Focus keyword density is 1-2% not stuffed","priority":"high"},
    {"id":"k3","cat":"Keywords","task":"At least 3 LSI keywords used naturally","priority":"high"},
    {"id":"k4","cat":"Keywords","task":"Long-tail keywords used in at least 2 H2/H3 headings","priority":"medium"},
    {"id":"k5","cat":"Keywords","task":"Questions keywords used in FAQ section","priority":"medium"},
    {"id":"c1","cat":"Content","task":"Word count meets recommended target for this topic","priority":"high"},
    {"id":"c2","cat":"Content","task":"Intro hooks the reader within the first 2 sentences","priority":"high"},
    {"id":"c3","cat":"Content","task":"Every H2 section has at least one keyword variant","priority":"medium"},
    {"id":"c4","cat":"Content","task":"Conclusion restates focus keyword and has CTA","priority":"high"},
    {"id":"c5","cat":"Content","task":"Content fully satisfies the search intent","priority":"critical"},
    {"id":"c6","cat":"Content","task":"Paragraphs are max 3-4 lines no walls of text","priority":"medium"},
    {"id":"c7","cat":"Content","task":"Sentences average under 20 words","priority":"medium"},
    {"id":"i1","cat":"Images","task":"Feature image with focus keyword in filename","priority":"high"},
    {"id":"i2","cat":"Images","task":"All images have descriptive alt text with keywords","priority":"critical"},
    {"id":"i3","cat":"Images","task":"Images compressed to WebP or optimized JPEG","priority":"medium"},
    {"id":"i4","cat":"Images","task":"At least one image per H2 section","priority":"low"},
    {"id":"s1","cat":"Snippets","task":"Featured snippet paragraph added 40-50 words","priority":"high"},
    {"id":"s2","cat":"Snippets","task":"FAQ section with 4+ questions added","priority":"medium"},
    {"id":"s3","cat":"Snippets","task":"At least one table or bullet list added","priority":"medium"},
    {"id":"sc1","cat":"Schema","task":"JSON-LD schema markup pasted into page head","priority":"critical"},
    {"id":"sc2","cat":"Schema","task":"Schema type matches content type","priority":"high"},
    {"id":"og1","cat":"Social","task":"Open Graph title and description set","priority":"high"},
    {"id":"og2","cat":"Social","task":"Twitter Card meta tags added","priority":"medium"},
    {"id":"og3","cat":"Social","task":"Social share image uploaded 1200x630px","priority":"high"},
    {"id":"l1","cat":"Links","task":"2-3 internal links with keyword-rich anchor text","priority":"high"},
    {"id":"l2","cat":"Links","task":"1-2 external links to authority sources added","priority":"medium"},
    {"id":"l3","cat":"Links","task":"No broken links anywhere in the post","priority":"critical"},
    {"id":"te1","cat":"Technical","task":"Canonical tag set to correct URL","priority":"high"},
    {"id":"te2","cat":"Technical","task":"Page set to index follow in robots","priority":"critical"},
    {"id":"te3","cat":"Technical","task":"Page loads under 3 seconds on mobile","priority":"high"},
    {"id":"pub","cat":"Publish","task":"URL submitted to Google Search Console after publishing","priority":"high"}
  ]
}`;
}
