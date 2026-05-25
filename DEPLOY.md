# SEOPro — Deployment Guide

## Your folder structure (upload this to GitHub as-is):
```
seopro/
├── api/
│   └── analyze.js       ← backend (API key lives here, hidden from users)
├── public/
│   └── index.html       ← the tool users see
├── vercel.json
└── package.json
```

---

## STEP 1 — Get Your Groq API Key
1. Go to: https://console.groq.com/keys
2. Click "Create API Key"
3. Copy the key (starts with gsk_...)

---

## STEP 2 — Upload to GitHub
1. Go to https://github.com → "New repository"
2. Name it: seopro (or any name)
3. Set to PUBLIC (required for free Vercel)
4. Upload all 4 files keeping the folder structure above
   (api/analyze.js, public/index.html, vercel.json, package.json)

---

## STEP 3 — Deploy on Vercel (Free)
1. Go to https://vercel.com → Sign up with GitHub
2. Click "Add New Project"
3. Import your seopro GitHub repo
4. Click "Deploy" (no build settings needed)

---

## STEP 4 — Add Your API Key (THIS IS HOW IT STAYS HIDDEN)
1. In Vercel → go to your project
2. Click "Settings" tab
3. Click "Environment Variables" in left sidebar
4. Add:
   - Key:   GROQ_API_KEY
   - Value: paste your gsk_... key here
5. Click "Save"
6. Go to "Deployments" → click 3 dots on latest → "Redeploy"

✅ Done! Your tool is live. Users never see your API key.
   The key is stored on Vercel's server only.

---

## Your live URL will be:
https://seopro.vercel.app  (or whatever Vercel assigns)

## To use a custom domain:
Vercel → Settings → Domains → Add your domain

---

## Troubleshooting:
- "GROQ_API_KEY not configured" → You missed Step 4, add the env variable
- "API error 429" → Groq free tier rate limit hit, wait 1 minute
- Tool not loading → Check Vercel "Functions" tab for error logs
