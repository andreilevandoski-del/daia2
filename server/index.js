/**
 * Servidor Daia: arquivos estáticos + POST /api/analyze-meal.
 * Provedores: Gemini (AI Studio + chave API; faturação Cloud = cotas pagas), Groq, Claude — MEAL_ANALYSIS_PROVIDER no .env.
 * Uso: npm run dev  →  http://localhost:3000
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '..');

/** Carrega .env: primeiro na raiz do repo (pasta pai de server/), depois cwd, depois padrão do dotenv. */
function loadEnvFiles() {
  const envInProject = path.join(ROOT, '.env');
  const envInCwd = path.resolve(process.cwd(), '.env');

  if (fs.existsSync(envInProject)) {
    dotenv.config({ path: envInProject, override: true });
  }
  if (!String(process.env.GEMINI_API_KEY || '').trim() && fs.existsSync(envInCwd)) {
    dotenv.config({ path: envInCwd, override: true });
  }
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    dotenv.config({ override: true });
  }
}

loadEnvFiles();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

app.use(express.json({ limit: '35mb' }));

const ANALYSIS_PROMPT = `Você é um assistente nutricional para estimativa educacional de carboidratos (não é conselho médico).
Analise a imagem da refeição e responda com um JSON no formato:
{"items":[{"name":"string em português","carbs_g":number}],"total_carbs_g":number,"confidence_percent":number,"notes_pt":"string curta opcional"}

Regras:
- carbs_g por item: gramas totais de carboidrato estimadas para a porção visível.
- total_carbs_g: soma dos itens (número).
- confidence_percent: inteiro 0-100.
- Se não houver comida: items [], total_carbs_g 0, notes_pt explicando.
- Números JSON válidos (ponto decimal se preciso).`;

function extractJsonFromModelText(text) {
  const trimmed = String(text || '').trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Modelo não retornou JSON reconhecível.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function parseAnalysisJson(text) {
  const t = String(text || '').trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    return extractJsonFromModelText(t);
  }
}

function normalizeAnalysis(raw) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = items.map(function (it) {
    return {
      name: String(it.name || 'Item').trim() || 'Item',
      carbs_g: Math.max(0, Number(it.carbs_g) || 0),
    };
  });
  let total = Number(raw.total_carbs_g);
  if (!Number.isFinite(total)) {
    total = normalizedItems.reduce(function (s, it) {
      return s + it.carbs_g;
    }, 0);
  }
  total = Math.round(total * 10) / 10;
  let conf = Math.round(Number(raw.confidence_percent));
  if (!Number.isFinite(conf)) conf = 50;
  conf = Math.min(100, Math.max(0, conf));
  return {
    items: normalizedItems,
    total_carbs_g: total,
    confidence_percent: conf,
    notes_pt: raw.notes_pt ? String(raw.notes_pt).trim() : '',
  };
}

function getResponseText(response) {
  if (!response) {
    throw new Error('Resposta vazia do modelo.');
  }
  const pf = response.promptFeedback;
  if (pf && pf.blockReason) {
    throw new Error(
      'A imagem não foi aceita (' + pf.blockReason + '). Experimente outra foto ou outro ângulo.',
    );
  }
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('O modelo não devolveu resultado. Tente outra imagem.');
  }
  const first = candidates[0];
  const reason = first.finishReason;
  if (reason && reason !== 'STOP') {
    const labels = {
      SAFETY: 'bloqueada por políticas de segurança',
      RECITATION: 'bloqueada (conteúdo protegido)',
      MAX_TOKENS: 'resposta incompleta (limite de tokens)',
      OTHER: 'interrompida (' + reason + ')',
    };
    throw new Error(
      'Análise ' + (labels[reason] || labels.OTHER) + '. Use outra foto ou simplifique a cena.',
    );
  }
  try {
    return response.text();
  } catch (e) {
    const parts = first.content && first.content.parts;
    if (parts && parts.length) {
      const joined = parts
        .map(function (p) {
          return p.text || '';
        })
        .join('');
      if (joined.trim()) return joined;
    }
    throw new Error(
      e.message ||
        'Não foi possível ler a resposta do modelo. Tente formato JPEG ou PNG.',
    );
  }
}

function modelListToTry() {
  const raw = process.env.GEMINI_MODEL;
  const trimmed = raw && String(raw).trim();
  if (trimmed && trimmed.includes(',')) {
    return trimmed.split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }
  const primary = trimmed || null;
  const fallbacks = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
  ];
  if (primary) {
    return [primary].concat(
      fallbacks.filter(function (m) {
        return m !== primary;
      }),
    );
  }
  return fallbacks;
}

function isRetryableModelError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not_found') ||
    msg.includes('is not found') ||
    msg.includes('invalid model') ||
    (msg.includes('model') && msg.includes('does not exist'))
  );
}

function isJsonMimeUnsupportedError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return (
    msg.includes('responsemimetype') ||
    msg.includes('response mime') ||
    msg.includes('unknown field') ||
    msg.includes('invalid argument') ||
    msg.includes('json mode')
  );
}

/**
 * Gera texto: tenta saída JSON forçada; se a API rejeitar, repete sem responseMimeType.
 */
async function generateMealAnalysisText(genAI, modelName, parts) {
  const configs = [
    { temperature: 0.35, responseMimeType: 'application/json' },
    { temperature: 0.35 },
  ];
  let lastErr = null;
  for (let c = 0; c < configs.length; c++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: configs[c],
      });
      const result = await model.generateContent(parts);
      return getResponseText(result.response);
    } catch (err) {
      lastErr = err;
      const useJson = !!configs[c].responseMimeType;
      if (useJson && isJsonMimeUnsupportedError(err)) {
        console.warn('[analyze-meal] responseMimeType JSON não suportado, repetindo sem:', modelName);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Falha ao gerar análise.');
}

function isQuotaOrRateLimitError(err) {
  const parts = [
    String((err && err.message) || ''),
    String((err && err.status) || ''),
    String((err && err.statusText) || ''),
  ];
  try {
    parts.push(JSON.stringify(err));
  } catch (e) {
    /* ignore */
  }
  const s = parts.join(' ').toLowerCase();
  const st = Number((err && err.status) || 0);
  return (
    st === 429 ||
    st === 529 ||
    s.includes('429') ||
    s.includes('529') ||
    s.includes('resource_exhausted') ||
    s.includes('resource exhausted') ||
    s.includes('quota') ||
    s.includes('rate limit') ||
    s.includes('rate_limit') ||
    s.includes('too many requests') ||
    s.includes('exhausted') ||
    s.includes('overloaded')
  );
}

async function analyzeWithGemini(genAI, parts) {
  const models = modelListToTry();
  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      const text = await generateMealAnalysisText(genAI, modelName, parts);
      const parsed = parseAnalysisJson(text);
      if (i > 0) {
        console.log('[analyze-meal] Gemini OK com modelo:', modelName);
      }
      return normalizeAnalysis(parsed);
    } catch (err) {
      lastError = err;
      console.error('[analyze-meal] Gemini', modelName, err.message || err);
      if (isRetryableModelError(err) && i < models.length - 1) {
        continue;
      }
      if (!isRetryableModelError(err)) {
        throw err;
      }
      break;
    }
  }
  throw lastError || new Error('Falha ao analisar com Gemini.');
}

/** Groq: camada gratuita com visão (Llama 4 Scout). Limite ~4 MB por pedido em base64. */
async function analyzeWithGroq(apiKey, base64Data, mimeType) {
  const approxBytes = Math.floor((base64Data.length * 3) / 4);
  const maxB = 4 * 1024 * 1024;
  if (approxBytes > maxB) {
    throw new Error(
      'Imagem grande demais para o Groq (máx. ~4 MB). Use foto mais pequena ou JPEG com menor qualidade.',
    );
  }
  const model =
    String(process.env.GROQ_VISION_MODEL || '').trim() ||
    'meta-llama/llama-4-scout-17b-16e-instruct';
  const dataUrl = 'data:' + mimeType + ';base64,' + base64Data;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.35,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  const body = await groqRes.json().catch(function () {
    return {};
  });
  if (!groqRes.ok) {
    const errMsg = (body.error && body.error.message) || groqRes.statusText || 'Erro na API Groq';
    throw new Error(errMsg);
  }
  const choice = body.choices && body.choices[0];
  const txt = choice && choice.message && choice.message.content;
  if (!txt) {
    throw new Error('Groq não devolveu conteúdo. Tente outra imagem.');
  }
  const parsed = parseAnalysisJson(txt);
  return normalizeAnalysis(parsed);
}

/** Claude: JPEG, PNG, GIF, WebP (não HEIC). */
function claudeImageMediaType(mimeType) {
  const m = String(mimeType || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (m === 'image/jpg') return 'image/jpeg';
  if (m === 'image/heic' || m === 'image/heif') {
    throw new Error(
      'Claude não suporta HEIC/HEIF. Exporte a foto como JPEG ou WebP, ou use outro formato.',
    );
  }
  if (/^image\/(jpeg|png|gif|webp)$/.test(m)) return m;
  throw new Error('Para Claude use imagem JPEG, PNG, GIF ou WebP.');
}

async function analyzeWithClaude(apiKey, base64Data, mimeType) {
  const mediaType = claudeImageMediaType(mimeType);
  const model =
    String(process.env.CLAUDE_MODEL || '').trim() || 'claude-sonnet-4-6';

  const client = new Anthropic({ apiKey: apiKey });
  const message = await client.messages.create({
    model: model,
    max_tokens: 2048,
    temperature: 0.35,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text:
              ANALYSIS_PROMPT +
              '\n\nResponda apenas com JSON válido (um objeto), sem markdown e sem texto fora do JSON.',
          },
        ],
      },
    ],
  });

  const blocks = message.content || [];
  let text = '';
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'text') {
      text += blocks[i].text || '';
    }
  }
  if (!String(text).trim()) {
    throw new Error('Claude não devolveu texto. Tente outra imagem.');
  }
  const parsed = parseAnalysisJson(text);
  return normalizeAnalysis(parsed);
}

app.post('/api/analyze-meal', async function (req, res) {
  try {
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const groqKey = String(process.env.GROQ_API_KEY || '').trim();
    const anthropicKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
    const provider = String(process.env.MEAL_ANALYSIS_PROVIDER || 'auto').toLowerCase();

    const imageBase64 = req.body && req.body.imageBase64;
    let mimeType = (req.body && req.body.mimeType) || 'image/jpeg';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Envie imageBase64 (data URL ou base64 puro).' });
    }

    let base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;
    base64Data = String(base64Data).replace(/\s/g, '');

    if (!base64Data || base64Data.length < 50) {
      return res.status(400).json({ error: 'Imagem inválida ou vazia.' });
    }

    if (mimeType.indexOf('/') === -1) {
      mimeType = 'image/jpeg';
    }
    const supportedMime = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (!supportedMime.test(mimeType)) {
      mimeType = 'image/jpeg';
    }

    const parts = [
      { text: ANALYSIS_PROMPT },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
    ];

    let analysis;
    let usedProvider = '';

    try {
      if (provider === 'groq') {
        if (!groqKey) {
          return res.status(503).json({
            error:
              'GROQ_API_KEY ausente. Crie chave gratuita em https://console.groq.com/keys e adicione ao .env',
          });
        }
        analysis = await analyzeWithGroq(groqKey, base64Data, mimeType);
        usedProvider = 'groq';
      } else if (provider === 'gemini') {
        if (!geminiKey) {
          return res.status(503).json({
            error:
              'MEAL_ANALYSIS_PROVIDER=gemini exige GEMINI_API_KEY no .env, ou use auto, groq ou claude.',
          });
        }
        const genAI = new GoogleGenerativeAI(geminiKey);
        analysis = await analyzeWithGemini(genAI, parts);
        usedProvider = 'gemini';
      } else if (provider === 'claude') {
        if (!anthropicKey) {
          return res.status(503).json({
            error:
              'MEAL_ANALYSIS_PROVIDER=claude exige ANTHROPIC_API_KEY no .env (https://console.anthropic.com/).',
          });
        }
        analysis = await analyzeWithClaude(anthropicKey, base64Data, mimeType);
        usedProvider = 'claude';
      } else {
        if (!geminiKey && !groqKey && !anthropicKey) {
          return res.status(503).json({
            error:
              'Defina pelo menos uma chave no .env: GEMINI_API_KEY, GROQ_API_KEY ou ANTHROPIC_API_KEY. MEAL_ANALYSIS_PROVIDER=auto|gemini|groq|claude',
          });
        }
        if (geminiKey) {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            analysis = await analyzeWithGemini(genAI, parts);
            usedProvider = 'gemini';
          } catch (gemErr) {
            if (isQuotaOrRateLimitError(gemErr)) {
              if (groqKey) {
                console.warn('[analyze-meal] Cota ou limite Gemini; a usar Groq.');
                analysis = await analyzeWithGroq(groqKey, base64Data, mimeType);
                usedProvider = 'groq';
              } else if (anthropicKey) {
                console.warn('[analyze-meal] Cota ou limite Gemini; a usar Claude.');
                analysis = await analyzeWithClaude(anthropicKey, base64Data, mimeType);
                usedProvider = 'claude';
              } else {
                throw gemErr;
              }
            } else {
              throw gemErr;
            }
          }
        } else if (groqKey) {
          analysis = await analyzeWithGroq(groqKey, base64Data, mimeType);
          usedProvider = 'groq';
        } else {
          analysis = await analyzeWithClaude(anthropicKey, base64Data, mimeType);
          usedProvider = 'claude';
        }
      }
    } catch (err) {
      let msg = (err && err.message) || 'Falha ao analisar a imagem.';
      const low = msg.toLowerCase();
      if (low.includes('api key') || low.includes('api_key') || low.includes('permission')) {
        msg =
          'Chave de API inválida ou sem permissão. Verifique GEMINI_API_KEY, GROQ_API_KEY ou ANTHROPIC_API_KEY no .env.';
      } else if (
        low.includes('quota') ||
        low.includes('resource_exhausted') ||
        low.includes('429')
      ) {
        msg =
          'Cota ou limite de pedidos. Em modo auto: adicione GROQ_API_KEY (fallback gratuito) ou ANTHROPIC_API_KEY (Claude), ou defina MEAL_ANALYSIS_PROVIDER=groq ou claude.';
        if ((groqKey || anthropicKey) && usedProvider === 'gemini') {
          msg += ' Reinicie o servidor após alterar o .env.';
        }
      } else if (low.includes('billing')) {
        msg = 'A API pediu faturação ativa. Verifique o projeto no Google AI Studio ou na Anthropic.';
      }
      return res.status(500).json({ error: msg });
    }

    return res.json({ ok: true, analysis: analysis, provider: usedProvider });
  } catch (err) {
    console.error('[analyze-meal]', err.message || err);
    res.status(500).json({ error: err.message || 'Falha ao analisar a imagem.' });
  }
});

app.get('/scan', function (_req, res) {
  res.redirect(302, '/scan.html');
});

app.get('/audio', function (_req, res) {
  res.redirect(302, '/audio.html');
});

app.use(express.static(ROOT));

app.use(function (err, req, res, next) {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error:
        'Imagem ou pedido demasiado grande. Escolha uma foto mais pequena (até ~12 MB) ou tire outra com menos megapixels.',
    });
  }
  if (err && err.type === 'entity.parse.failed' && req.path && String(req.path).indexOf('/api/') === 0) {
    return res.status(400).json({ error: 'Corpo do pedido inválido (esperado JSON).' });
  }
  console.error('[express]', err && err.stack ? err.stack : err);
  if (!res.headersSent) {
    res.status(500).json({ error: (err && err.message) || 'Erro interno do servidor.' });
  }
});

app.listen(PORT, function () {
  console.log('Daia — http://localhost:' + PORT);
  console.log('API: POST /api/analyze-meal');
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
