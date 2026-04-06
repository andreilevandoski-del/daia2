/**
 * Arranque local: npm run dev  →  http://localhost:PORT
 * Deploy: Vercel (api/index.js) ou Render/Railway (npm start).
 */
const path = require('path');
const fs = require('fs');
const { app, PORT } = require('./app');

app.listen(PORT, function () {
  console.log('Daia — http://localhost:' + PORT);
  console.log('API: POST /api/analyze-meal | POST /api/analyze-meal-audio');
  const ROOT = path.resolve(__dirname, '..');
  const envPath = path.join(ROOT, '.env');
  const g = String(process.env.GEMINI_API_KEY || '').trim();
  const q = String(process.env.GROQ_API_KEY || '').trim();
  const a = String(process.env.ANTHROPIC_API_KEY || '').trim();
  const prov = String(process.env.MEAL_ANALYSIS_PROVIDER || 'auto').toLowerCase();
  if (!g && !q && !a) {
    console.warn('[daia] Nenhuma chave: GEMINI_API_KEY, GROQ_API_KEY ou ANTHROPIC_API_KEY.');
    console.warn('[daia] Raiz do projeto:', ROOT);
    console.warn('[daia] .env esperado em:', envPath, 'existe:', fs.existsSync(envPath));
  } else {
    if (prov === 'claude') {
      console.log('[daia] Provedor: Claude (ANTHROPIC_API_KEY).');
    } else if (g && q) {
      console.log('[daia] Gemini + Groq: modo auto usa Groq se a cota do Gemini esgotar.');
      if (a) console.log('[daia] Com ANTHROPIC_API_KEY: sem Groq no fallback, usa Claude.');
    } else if (q) {
      console.log('[daia] Apenas Groq (MEAL_ANALYSIS_PROVIDER pode ser groq ou auto).');
    } else if (a && !g) {
      console.log('[daia] Apenas Claude no modo auto (sem Gemini).');
    } else if (g && a) {
      console.log('[daia] Gemini + Claude: modo auto usa Claude se a cota do Gemini esgotar (sem Groq).');
    } else if (g) {
      console.log('[daia] Gemini (Google AI Studio). Cotas maiores: ative faturação no projeto Cloud associado à chave.');
    }
  }
});
