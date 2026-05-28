export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── DOMAIN CHECK ENDPOINT ───────────────────────────────────────
  if (req.method === 'GET' && req.query?.action === 'domain') {
    const raw = (req.query.domain || '').trim();
    const domain = raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();

    if (!domain) return res.status(400).json({ error: 'Domain required' });

    const result = {
      domain,
      registeredDate: null,
      domainAgeDays: null,
      domainAgeText: 'Not found',
      domainAuthority: null,
      pageRank: null,
      backlinks: null,
      competition: null,
      chance: null,
      verdict: null,
      sources: []
    };

    // ── 1. REAL DOMAIN AGE via RDAP (free, official ICANN data) ──
    try {
      const rdap = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: { 'Accept': 'application/rdap+json' },
        signal: AbortSignal.timeout(6000)
      });
      if (rdap.ok) {
        const data = await rdap.json();
        const events = data.events || [];

        // Try registration date first
        let dateStr = null;
        const regEvent = events.find(e =>
          e.eventAction === 'registration' ||
          e.eventAction === 'Registration'
        );
        if (regEvent?.eventDate) dateStr = regEvent.eventDate;

        // Fallback: expiration minus typical 1yr or 2yr registration
        if (!dateStr) {
          const expEvent = events.find(e => e.eventAction === 'expiration');
          if (expEvent?.eventDate) {
            const expDate = new Date(expEvent.eventDate);
            expDate.setFullYear(expDate.getFullYear() - 1);
            dateStr = expDate.toISOString();
          }
        }

        if (dateStr) {
          const registered = new Date(dateStr);
          const now = new Date();
          result.registeredDate = registered.toISOString().split('T')[0];
          result.domainAgeDays = Math.floor((now - registered) / 86400000);

          const y = Math.floor(result.domainAgeDays / 365);
          const m = Math.floor((result.domainAgeDays % 365) / 30);
          const d = result.domainAgeDays % 30;

          if (y > 0 && m > 0) result.domainAgeText = `${y}y ${m}m`;
          else if (y > 0) result.domainAgeText = `${y} year${y > 1 ? 's' : ''}`;
          else if (m > 0) result.domainAgeText = `${m} month${m > 1 ? 's' : ''} ${d}d`;
          else result.domainAgeText = `${result.domainAgeDays} days`;

          result.sources.push('RDAP (official registry)');
        }
      }
    } catch (_) {
      // RDAP failed — try whois fallback
      try {
        const whois = await fetch(`https://api.whoisfreaks.com/v1.0/whois?whois=live&domainName=${domain}&apiKey=free`, {
          signal: AbortSignal.timeout(4000)
        });
        if (whois.ok) {
          const wdata = await whois.json();
          const created = wdata?.create_date || wdata?.domain_registration?.created;
          if (created) {
            const registered = new Date(created);
            const now = new Date();
            result.registeredDate = registered.toISOString().split('T')[0];
            result.domainAgeDays = Math.floor((now - registered) / 86400000);
            const y = Math.floor(result.domainAgeDays / 365);
            const m = Math.floor((result.domainAgeDays % 365) / 30);
            result.domainAgeText = y > 0 ? `${y}y ${m}m` : `${m}m ${result.domainAgeDays % 30}d`;
            result.sources.push('WhoisFreaks');
          }
        }
      } catch (_) {}
    }

    // ── 2. REAL PAGE RANK via Open PageRank (free API, 500 req/month) ──
    const OPR_KEY = process.env.OPENPAGERANK_API_KEY;
    if (OPR_KEY) {
      try {
        const opr = await fetch(
          `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${domain}`,
          {
            headers: { 'API-OPR': OPR_KEY },
            signal: AbortSignal.timeout(5000)
          }
        );
        if (opr.ok) {
          const oprData = await opr.json();
          const entry = oprData?.response?.[0];
          if (entry && entry.status_code === 200) {
            result.pageRank = entry.page_rank_integer ?? 0;
            result.domainAuthority = Math.min(100, Math.round((result.pageRank / 10) * 100));
            result.sources.push('OpenPageRank API');
          }
        }
      } catch (_) {}
    }

    // ── 3. REAL BACKLINKS via Ahrefs free / CommonCrawl alternative ──
    // Using free Moz API if key available
    const MOZ_TOKEN = process.env.MOZ_ACCESS_TOKEN;
    if (MOZ_TOKEN) {
      try {
        const mozRes = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${MOZ_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ targets: [domain], limit: 1 }),
          signal: AbortSignal.timeout(5000)
        });
        if (mozRes.ok) {
          const mozData = await mozRes.json();
          const entry = mozData?.results?.[0];
          if (entry) {
            result.domainAuthority = Math.round(entry.domain_authority ?? result.domainAuthority ?? 0);
            result.backlinks = entry.linking_root_domains ?? null;
            result.sources.push('Moz API');
          }
        }
      } catch (_) {}
    }

    // ── 4. HONEST DA ESTIMATE if no API keys ──
    // Based purely on real domain age — honest, labeled as estimate
    if (result.domainAuthority === null) {
      const ageDays = result.domainAgeDays;
      if (ageDays === null) {
        result.domainAuthority = null;
        result.daEstimated = false;
      } else if (ageDays < 30)        { result.domainAuthority = 1;  result.daEstimated = true; }
      else if (ageDays < 90)          { result.domainAuthority = 2;  result.daEstimated = true; }
      else if (ageDays < 180)         { result.domainAuthority = 4;  result.daEstimated = true; }
      else if (ageDays < 365)         { result.domainAuthority = 8;  result.daEstimated = true; }
      else if (ageDays < 365 * 2)     { result.domainAuthority = 15; result.daEstimated = true; }
      else if (ageDays < 365 * 4)     { result.domainAuthority = 22; result.daEstimated = true; }
      else if (ageDays < 365 * 7)     { result.domainAuthority = 32; result.daEstimated = true; }
      else if (ageDays < 365 * 12)    { result.domainAuthority = 45; result.daEstimated = true; }
      else                            { result.domainAuthority = 60; result.daEstimated = true; }
    } else {
      result.daEstimated = false;
    }

    // ── 5. COMPETITION & CHANCE based on REAL age + DA ──
    const da = result.domainAuthority || 0;
    const ageDays = result.domainAgeDays || 0;

    if (ageDays < 90) {
      result.competition = 'New Domain';
      result.chance = 'Needs Time';
      result.verdict = '🆕 Brand new domain (under 90 days). Google needs 6-12 months to trust new domains. Start with long-tail keywords, build quality content consistently, and focus on getting your first 10 backlinks.';
    } else if (ageDays < 365) {
      result.competition = 'Low';
      result.chance = 'Building';
      result.verdict = '📈 Young domain (under 1 year). Focus on low-competition, long-tail keywords. Publish 2-3 high-quality articles per week. You can start ranking within 3-6 months with consistent effort.';
    } else if (da <= 15) {
      result.competition = 'Low';
      result.chance = 'High';
      result.verdict = '✅ Low authority niche. Great opportunity! Target low-difficulty keywords (KD < 20), publish quality content regularly, and build topical authority. You can rank within 2-4 months.';
    } else if (da <= 30) {
      result.competition = 'Low–Med';
      result.chance = 'Good';
      result.verdict = '✅ Moderate competition. Target keywords with KD under 30. With 1-2 quality articles per week and some backlinks, you can rank for medium-difficulty keywords in 3-5 months.';
    } else if (da <= 50) {
      result.competition = 'Medium';
      result.chance = 'Medium';
      result.verdict = '⚠️ Competitive niche. Focus on long-tail keywords first to build topical authority. Need 10+ quality backlinks per month and 1500+ word articles. Expect 4-8 months to see rankings.';
    } else if (da <= 70) {
      result.competition = 'High';
      result.chance = 'Hard';
      result.verdict = '⚠️ High competition. You need exceptional content (2500+ words), strong backlink profile (DR 50+), and topical authority. Focus on niche sub-topics where big sites have gaps.';
    } else {
      result.competition = 'Very High';
      result.chance = 'Very Hard';
      result.verdict = '🔴 Extremely competitive. Dominated by high-authority sites. Target very specific micro-niches, use programmatic SEO, and build a unique data-driven content strategy to compete.';
    }

    // ── 6. IS IT WORTH ENTERING? ──
    if (ageDays < 365) {
      result.worthIt = 'Too early to judge — build content first';
    } else if (da <= 30) {
      result.worthIt = 'Yes — worth entering this niche';
    } else if (da <= 55) {
      result.worthIt = 'Yes with strategy — target sub-niches';
    } else {
      result.worthIt = 'Challenging — need strong resources';
    }

    result.dataSource = result.sources.length > 0
      ? result.sources.join(' + ')
      : 'RDAP registry data';

    return res.status(200).json(result);
  }

  // ─── SEO BLUEPRINT ENDPOINT ──────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server.' });

  const { keyword, focusKeyword, language, mode, options, customPrompt, systemPrompt } = req.body || {};
  if (!keyword) return res.status(400).json({ error: 'Keyword is required.' });

  const focus = (focusKeyword || keyword).trim();
  const lang = language || 'English';

  const sysPrompt = systemPrompt ||
    `You are a world-class SEO content strategist with 15+ years ranking content on Google.
STRICT RULES:
1. Return ONLY valid JSON — zero markdown, zero explanation, no code fences.
2. Every string value must be COMPLETE and DETAILED — never use placeholders.
3. metaDescription and metaDescriptionB MUST be fully written 150-158 character sentences with the focus keyword and a CTA.
4. intro and conclusion MUST be full copy-ready paragraphs (3 sentences minimum each).
5. Every title MUST be real, specific, compelling, under 60 characters with a power word or number.
6. All FAQ answers must be full 40-50 word answers, not placeholders.
7. Schema code field must be real valid JSON-LD with actual values filled in.
8. NEVER truncate. NEVER use ellipsis. NEVER leave arrays empty.`;

  const userPrompt = customPrompt || buildDefaultPrompt(keyword, focus, lang);

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
          model: 'llama3-8b-8192',
          temperature: attempt === 0 ? 0.3 : 0.2,
          max_tokens: 6000,
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
      const cleaned = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
      const parsed = JSON.parse(cleaned);
      return res.status(200).json(parsed);

    } catch (err) {
      lastErr = err;
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

Return ONLY valid JSON:
{
  "keyword": "${keyword}",
  "focusKeyword": "${focus}",
  "intent": "Informational",
  "difficulty": "Medium",
  "volumeTier": "Medium (1k-10k)",
  "contentType": "Blog Post",
  "wordCount": "1800-2500 words",
  "writingTone": "Conversational",
  "titles": ["Real title 1 power word number keyword under 60","Real question title under 60","Real how-to title under 60","Real listicle title under 60","Real urgency title under 60"],
  "h1s": ["Real H1 with focus keyword","Real H1 option 2","Real H1 option 3"],
  "metaDescription": "Full real 150-158 char meta with focus keyword and CTA ending with action phrase.",
  "metaDescriptionB": "Full alternative 150-158 char meta different angle with keyword and CTA.",
  "slug": "real-slug-with-keyword",
  "keywords": {
    "primary": "${focus}",
    "secondary": ["kw1","kw2","kw3","kw4","kw5","kw6"],
    "lsi": ["lsi1","lsi2","lsi3","lsi4","lsi5","lsi6"],
    "longtail": ["long tail 1","long tail 2","long tail 3","long tail 4","long tail 5"],
    "questions": ["Question 1?","Question 2?","Question 3?","Question 4?","Question 5?"],
    "avoid": ["avoid1","avoid2","avoid3"]
  },
  "outline": {
    "intro": "Full 3-sentence hook intro. States problem. Promises solution. Contains focus keyword. Copy-ready.",
    "sections": [
      {"h2":"H2 with secondary keyword","h3s":["H3 1","H3 2","H3 3"],"tip":"Detailed writing tip"},
      {"h2":"H2 heading 2","h3s":["H3 a","H3 b"],"tip":"Writing tip"},
      {"h2":"H2 heading 3","h3s":["H3 a","H3 b","H3 c"],"tip":"Writing tip"},
      {"h2":"H2 heading 4","h3s":["H3 a","H3 b"],"tip":"Writing tip"},
      {"h2":"FAQ: Questions About ${keyword}","h3s":["FAQ Q1?","FAQ Q2?","FAQ Q3?"],"tip":"Answer in 40-60 words"}
    ],
    "conclusion": "Full 3-sentence conclusion. Summarizes. Restates keyword. Clear CTA. Copy-ready.",
    "cta": "Specific actionable CTA"
  },
  "altTexts": ["Alt 1 with focus keyword","Alt 2 secondary keyword","Alt 3 infographic","Alt 4 supporting","Alt 5 closing"],
  "snippets": {
    "paragraph": "Full 45-50 word featured snippet paragraph. Direct answer. Contains focus keyword.",
    "table": {"caption":"Table title","headers":["Col1","Col2","Col3"],"rows":[["r1c1","r1c2","r1c3"],["r2c1","r2c2","r2c3"],["r3c1","r3c2","r3c3"],["r4c1","r4c2","r4c3"]]},
    "faqs": [
      {"q":"Real FAQ Q1?","a":"Full 40-50 word answer 1 with focus keyword."},
      {"q":"Real FAQ Q2?","a":"Full 40-50 word answer 2."},
      {"q":"Real FAQ Q3?","a":"Full 40-50 word answer 3."},
      {"q":"Real FAQ Q4?","a":"Full 40-50 word answer 4."}
    ]
  },
  "schema": {
    "type": "Article",
    "code": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Real Title\\",\\"description\\":\\"Real meta description\\",\\"author\\":{\\"@type\\":\\"Person\\",\\"name\\":\\"Author\\"},\\"datePublished\\":\\"2025-01-01\\"}"
  },
  "openGraph": {"title":"Real OG title under 60 chars","description":"Real OG description under 200 chars."},
  "twitter": {"title":"Real Twitter title","description":"Real Twitter description under 200 chars."},
  "internalLinks": {
    "anchors": ["anchor 1","anchor 2","anchor 3","anchor 4"],
    "hubTopics": ["hub topic 1","hub topic 2","hub topic 3"],
    "strategy": "One specific sentence about internal linking strategy."
  },
  "checklist": [
    {"id":"t1","cat":"Title","task":"Title contains focus keyword in first 3 words","priority":"critical"},
    {"id":"t2","cat":"Title","task":"Title tag is under 60 characters","priority":"critical"},
    {"id":"t3","cat":"Title","task":"Title has a power word number or emotion trigger","priority":"high"},
    {"id":"h1","cat":"H1","task":"H1 tag is set and includes focus keyword","priority":"critical"},
    {"id":"h2","cat":"H1","task":"H1 is different wording from the title tag","priority":"medium"},
    {"id":"m1","cat":"Meta","task":"Meta description is written 150-158 chars","priority":"critical"},
    {"id":"m2","cat":"Meta","task":"Meta description includes focus keyword naturally","priority":"critical"},
    {"id":"m3","cat":"Meta","task":"Meta description ends with a clear CTA","priority":"high"},
    {"id":"u1","cat":"URL","task":"Slug uses focus keyword hyphens no stop words","priority":"critical"},
    {"id":"u2","cat":"URL","task":"Slug is under 75 characters total","priority":"medium"},
    {"id":"k1","cat":"Keywords","task":"Focus keyword appears in first 100 words","priority":"critical"},
    {"id":"k2","cat":"Keywords","task":"Focus keyword density is 1-2 percent","priority":"high"},
    {"id":"k3","cat":"Keywords","task":"At least 3 LSI keywords used naturally","priority":"high"},
    {"id":"k4","cat":"Keywords","task":"Long-tail keywords in at least 2 H2 or H3","priority":"medium"},
    {"id":"k5","cat":"Keywords","task":"Questions keywords used in FAQ section","priority":"medium"},
    {"id":"c1","cat":"Content","task":"Word count meets recommended target","priority":"high"},
    {"id":"c2","cat":"Content","task":"Intro hooks reader within first 2 sentences","priority":"high"},
    {"id":"c3","cat":"Content","task":"Every H2 has at least one keyword variant","priority":"medium"},
    {"id":"c4","cat":"Content","task":"Conclusion restates focus keyword and has CTA","priority":"high"},
    {"id":"c5","cat":"Content","task":"Content fully satisfies search intent","priority":"critical"},
    {"id":"c6","cat":"Content","task":"Paragraphs are max 3-4 lines","priority":"medium"},
    {"id":"c7","cat":"Content","task":"Sentences average under 20 words","priority":"medium"},
    {"id":"i1","cat":"Images","task":"Feature image has focus keyword in filename","priority":"high"},
    {"id":"i2","cat":"Images","task":"All images have descriptive alt text","priority":"critical"},
    {"id":"i3","cat":"Images","task":"Images compressed to WebP or optimized JPEG","priority":"medium"},
    {"id":"i4","cat":"Images","task":"At least one image per H2 section","priority":"low"},
    {"id":"s1","cat":"Snippets","task":"Featured snippet paragraph added 40-50 words","priority":"high"},
    {"id":"s2","cat":"Snippets","task":"FAQ section with 4 plus questions added","priority":"medium"},
    {"id":"s3","cat":"Snippets","task":"At least one table or bullet list added","priority":"medium"},
    {"id":"sc1","cat":"Schema","task":"JSON-LD schema markup pasted into page head","priority":"critical"},
    {"id":"sc2","cat":"Schema","task":"Schema type matches content type","priority":"high"},
    {"id":"og1","cat":"Social","task":"Open Graph title and description set","priority":"high"},
    {"id":"og2","cat":"Social","task":"Twitter Card meta tags added","priority":"medium"},
    {"id":"og3","cat":"Social","task":"Social share image uploaded 1200x630px","priority":"high"},
    {"id":"l1","cat":"Links","task":"2-3 internal links with keyword-rich anchor text","priority":"high"},
    {"id":"l2","cat":"Links","task":"1-2 external links to authority sources","priority":"medium"},
    {"id":"l3","cat":"Links","task":"No broken links in the post","priority":"critical"},
    {"id":"te1","cat":"Technical","task":"Canonical tag set to correct URL","priority":"high"},
    {"id":"te2","cat":"Technical","task":"Page set to index follow","priority":"critical"},
    {"id":"te3","cat":"Technical","task":"Page loads under 3 seconds on mobile","priority":"high"},
    {"id":"pub","cat":"Publish","task":"URL submitted to Google Search Console","priority":"high"}
  ]
}`;
}
