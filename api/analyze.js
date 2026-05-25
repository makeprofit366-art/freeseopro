export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ─── YOUR GROQ API KEY GOES HERE (set in Vercel → Settings → Environment Variables) ───
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server.' });

  const { keyword, focusKeyword } = req.body || {};
  if (!keyword) return res.status(400).json({ error: 'Keyword is required.' });
  const focus = (focusKeyword || keyword).trim();

  const systemPrompt = `You are a world-class SEO strategist with 10+ years of experience ranking content on Google. You produce precise, actionable, copy-ready SEO blueprints. Always respond with valid JSON only — no markdown fences, no explanation outside the JSON object.`;

  const userPrompt = `Generate a complete professional SEO content blueprint for:
Keyword: "${keyword}"
Focus Keyword: "${focus}"

Return ONLY this JSON (no extra text, no code blocks):
{
  "keyword": "${keyword}",
  "focusKeyword": "${focus}",
  "intent": "Informational|Commercial|Transactional|Navigational",
  "difficulty": "Easy|Medium|Hard",
  "volumeTier": "Low (<1k)|Medium (1k-10k)|High (10k-100k)|Very High (100k+)",
  "contentType": "Blog Post|Pillar Page|How-To Guide|Listicle|Product Page",
  "wordCount": "e.g. 1800-2500 words",
  "writingTone": "Conversational|Professional|Educational|Technical",

  "titles": [
    "Title with power word + number + keyword, under 60 chars",
    "Question format title, under 60 chars",
    "How-to format title, under 60 chars",
    "Listicle format with benefit, under 60 chars",
    "Emotional + urgency title, under 60 chars"
  ],

  "h1s": [
    "H1 option 1 - contains focus keyword, can be longer than title",
    "H1 option 2 - different angle",
    "H1 option 3 - conversational"
  ],

  "metaDescription": "150-158 char meta with focus keyword + CTA",
  "metaDescriptionB": "Alternative meta description, different angle, 150-158 chars",
  "slug": "url-friendly-slug-with-focus-keyword",

  "keywords": {
    "primary": "${focus}",
    "secondary": ["kw2","kw3","kw4","kw5","kw6"],
    "lsi": ["lsi1","lsi2","lsi3","lsi4","lsi5","lsi6"],
    "longtail": ["long tail phrase 1","long tail phrase 2","long tail phrase 3","long tail phrase 4","long tail phrase 5"],
    "questions": ["People also ask question 1?","question 2?","question 3?","question 4?","question 5?"],
    "avoid": ["negative keyword 1","negative keyword 2","negative keyword 3"]
  },

  "outline": {
    "intro": "Full 3-sentence hook intro paragraph, states problem, promises solution. Copy-ready.",
    "sections": [
      { "h2": "H2 with secondary keyword", "h3s": ["H3 subheading","H3 subheading","H3 subheading"], "tip": "What to cover in this section" },
      { "h2": "H2 heading", "h3s": ["H3","H3"], "tip": "Writing tip" },
      { "h2": "H2 heading", "h3s": ["H3","H3","H3"], "tip": "Writing tip" },
      { "h2": "H2 heading", "h3s": ["H3","H3"], "tip": "Writing tip" },
      { "h2": "FAQ: Common Questions About [topic]", "h3s": ["H3 faq q1","H3 faq q2","H3 faq q3"], "tip": "Answer each FAQ concisely" }
    ],
    "conclusion": "Full 3-sentence conclusion paragraph — summarizes, restates focus keyword, clear CTA. Copy-ready.",
    "cta": "Specific call-to-action recommendation"
  },

  "altTexts": [
    "Feature image alt text with focus keyword - descriptive",
    "Section image 1 alt text - descriptive with secondary keyword",
    "Infographic or diagram alt text",
    "Supporting image alt text",
    "Closing image alt text"
  ],

  "snippets": {
    "paragraph": "40-50 word direct-answer paragraph to win featured snippet. Starts with direct answer.",
    "table": {
      "caption": "Comparison table title",
      "headers": ["Column 1","Column 2","Column 3"],
      "rows": [["r1c1","r1c2","r1c3"],["r2c1","r2c2","r2c3"],["r3c1","r3c2","r3c3"],["r4c1","r4c2","r4c3"]]
    },
    "faqs": [
      {"q": "FAQ question 1?","a": "40-word direct answer."},
      {"q": "FAQ question 2?","a": "40-word direct answer."},
      {"q": "FAQ question 3?","a": "40-word direct answer."},
      {"q": "FAQ question 4?","a": "40-word direct answer."}
    ]
  },

  "schema": {
    "type": "Article|BlogPosting|HowTo|FAQPage",
    "code": "{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":\"TITLE\",\"description\":\"META\",\"author\":{\"@type\":\"Person\",\"name\":\"Author Name\"},\"datePublished\":\"2025-01-01\"}"
  },

  "openGraph": {
    "title": "OG title",
    "description": "OG description under 200 chars"
  },
  "twitter": {
    "title": "Twitter title",
    "description": "Twitter description"
  },

  "internalLinks": {
    "anchors": ["anchor text 1","anchor text 2","anchor text 3","anchor text 4"],
    "hubTopics": ["related topic 1","related topic 2","related topic 3"],
    "strategy": "One sentence internal linking advice"
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
    {"id":"k2","cat":"Keywords","task":"Focus keyword density is 1-2% (not stuffed)","priority":"high"},
    {"id":"k3","cat":"Keywords","task":"At least 3 LSI keywords used naturally","priority":"high"},
    {"id":"k4","cat":"Keywords","task":"Long-tail keywords used in at least 2 H2/H3 headings","priority":"medium"},
    {"id":"k5","cat":"Keywords","task":"Questions keywords used in FAQ section","priority":"medium"},
    {"id":"c1","cat":"Content","task":"Word count meets recommended target for this topic","priority":"high"},
    {"id":"c2","cat":"Content","task":"Intro hooks the reader within the first 2 sentences","priority":"high"},
    {"id":"c3","cat":"Content","task":"Every H2 section has at least one keyword variant","priority":"medium"},
    {"id":"c4","cat":"Content","task":"Conclusion restates focus keyword and has CTA","priority":"high"},
    {"id":"c5","cat":"Content","task":"Content fully satisfies the search intent","priority":"critical"},
    {"id":"c6","cat":"Content","task":"Paragraphs are max 3-4 lines (no walls of text)","priority":"medium"},
    {"id":"c7","cat":"Content","task":"Sentences average under 20 words","priority":"medium"},
    {"id":"i1","cat":"Images","task":"Feature image added with focus keyword in filename","priority":"high"},
    {"id":"i2","cat":"Images","task":"All images have descriptive alt text with keywords","priority":"critical"},
    {"id":"i3","cat":"Images","task":"Images compressed to WebP or optimized JPEG","priority":"medium"},
    {"id":"i4","cat":"Images","task":"At least one image per H2 section","priority":"low"},
    {"id":"s1","cat":"Snippets","task":"Featured snippet paragraph added (40-50 words, direct answer)","priority":"high"},
    {"id":"s2","cat":"Snippets","task":"FAQ section with 4+ questions added to post","priority":"medium"},
    {"id":"s3","cat":"Snippets","task":"At least one table or bullet list added","priority":"medium"},
    {"id":"sc1","cat":"Schema","task":"JSON-LD schema markup pasted into page head","priority":"critical"},
    {"id":"sc2","cat":"Schema","task":"Schema type matches content (Article/HowTo/FAQ)","priority":"high"},
    {"id":"og1","cat":"Social","task":"Open Graph title and description set","priority":"high"},
    {"id":"og2","cat":"Social","task":"Twitter Card meta tags added","priority":"medium"},
    {"id":"og3","cat":"Social","task":"Social share image uploaded (1200×630px)","priority":"high"},
    {"id":"l1","cat":"Links","task":"2-3 internal links added with keyword-rich anchor text","priority":"high"},
    {"id":"l2","cat":"Links","task":"1-2 external links to authority sources added","priority":"medium"},
    {"id":"l3","cat":"Links","task":"No broken links anywhere in the post","priority":"critical"},
    {"id":"te1","cat":"Technical","task":"Canonical tag set to the correct URL","priority":"high"},
    {"id":"te2","cat":"Technical","task":"Page is set to index, follow in robots/CMS","priority":"critical"},
    {"id":"te3","cat":"Technical","task":"Page loads under 3 seconds on mobile (test GTmetrix)","priority":"high"},
    {"id":"pub","cat":"Publish","task":"URL submitted to Google Search Console after publishing","priority":"high"}
  ]
}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!groqRes.ok) {
      const e = await groqRes.json();
      return res.status(groqRes.status).json({ error: e.error?.message || 'Groq API error' });
    }

    const data = await groqRes.json();
    const text = data.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
