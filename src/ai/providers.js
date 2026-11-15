// AI providers VoiceVerse can use for story analysis, story writing and voice casting.
// Each provider knows how to: recognise its API keys, list the models a key can use,
// pick a suitable model from that list, and send one prompt.
//
// Models are never hard-coded: the app asks the provider which models exist and picks one,
// so a retired model name can't break it.

/** Read a useful error message from any provider's error reply. */
export async function readError(res) {
  try {
    const j = await res.json();
    const e = j.error || j.detail || j;
    return (typeof e === 'string' ? e : e.message || e.msg || JSON.stringify(e)).slice(0, 300);
  } catch {
    return res.statusText || 'unknown error';
  }
}

const version = (id, re) => parseFloat((id.match(re) || [])[1] || 0);
const isSnapshot = (id) => /\d{4}-?\d{2}-?\d{2}|\d{4}$/.test(id);

/** Sort ids by score (highest first) and return the best, or '' if none. */
const best = (ids, score) => [...ids].sort((a, b) => score(b) - score(a))[0] || '';

/* ---------------- Google Gemini ---------------- */

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

const gemini = {
  id: 'gemini',
  label: 'Gemini',
  keyUrl: 'aistudio.google.com/apikey',
  detect: (key) => key.startsWith('AIza'),
  async models(key, signal) {
    const res = await fetch(`${GEMINI}?pageSize=1000`, { headers: { 'x-goog-api-key': key }, signal });
    if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status });
    return ((await res.json()).models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  },
  // newest stable full Flash model: fast, cheap and good at structured output
  pick: (ids) =>
    best(
      ids.filter((n) => /^gemini-.*flash/.test(n) && !/image|tts|audio|live|embed|vision|thinking/.test(n)),
      (n) =>
        (/preview|exp/.test(n) ? 0 : 1000) +
        (/lite/.test(n) ? 0 : 100) +
        version(n, /gemini-(\d+(?:\.\d+)?)/) * 10 +
        (isSnapshot(n) ? 0 : 1),
    ),
  async send({ model, key, prompt, json, signal, opts }) {
    return fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          ...(opts.temperature ? { temperature: json ? 0.3 : 0.9 } : {}),
          ...(json && opts.json ? { responseMimeType: 'application/json' } : {}),
          // "thinking" makes newer models far slower on long stories; switch it off when allowed
          ...(opts.thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
  },
  text: (body) => body.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '',
};

/* ---------------- Anthropic Claude ---------------- */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const anthropicHeaders = (key) => ({
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true', // allows calls straight from the browser
  'Content-Type': 'application/json',
});

const anthropic = {
  id: 'anthropic',
  label: 'Claude',
  keyUrl: 'console.anthropic.com',
  detect: (key) => key.startsWith('sk-ant-'),
  async models(key, signal) {
    const res = await fetch(`${ANTHROPIC}/models?limit=100`, { headers: anthropicHeaders(key), signal });
    if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status });
    return ((await res.json()).data || []).map((m) => m.id); // newest first
  },
  // newest Haiku (fastest), else newest Sonnet, else the newest model
  pick: (ids) => ids.find((n) => /haiku/.test(n)) || ids.find((n) => /sonnet/.test(n)) || ids[0] || '',
  async send({ model, key, prompt, json, signal, opts }) {
    return fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      signal,
      headers: anthropicHeaders(key),
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens,
        ...(opts.temperature ? { temperature: json ? 0.3 : 0.9 } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  },
  text: (body) => (body.content || []).map((c) => c.text || '').join(''),
};

/* ---------------- OpenAI-compatible providers ---------------- */

function openAICompatible({ id, label, base, keyUrl, detect, pick, fixedModel, headers = {} }) {
  const auth = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers });
  return {
    id,
    label,
    keyUrl,
    detect,
    fixedModel,
    base,
    async models(key, signal, baseUrl = base) {
      const res = await fetch(`${baseUrl}/models`, { headers: auth(key), signal });
      if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status });
      const j = await res.json();
      return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean);
    },
    pick,
    async send({ model, key, prompt, json, signal, opts, baseUrl = base }) {
      return fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: auth(key),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          ...(opts.temperature ? { temperature: json ? 0.3 : 0.9 } : {}),
          ...(json && opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    },
    text: (body) => body.choices?.[0]?.message?.content || '',
  };
}

const NOT_CHAT =
  /audio|realtime|transcribe|tts|whisper|speech|search|image|imagine|vision|video|embed|moderation|guard|dall|instruct|codex|computer|ocr/;

const openai = openAICompatible({
  id: 'openai',
  label: 'OpenAI',
  base: 'https://api.openai.com/v1',
  keyUrl: 'platform.openai.com/api-keys',
  detect: (key) => key.startsWith('sk-') && !key.startsWith('sk-ant-') && !key.startsWith('sk-or-'),
  // newest GPT "mini" model (fast and cheap), preferring the plain alias over dated snapshots
  pick: (ids) =>
    best(
      ids.filter((n) => /^(gpt|chatgpt)-/.test(n) && !NOT_CHAT.test(n)),
      (n) =>
        version(n, /gpt-(\d+(?:\.\d+)?)/) * 10 + (/mini/.test(n) ? 5 : 0) - (/nano/.test(n) ? 3 : 0) + (isSnapshot(n) ? 0 : 1),
    ),
});

const xai = openAICompatible({
  id: 'xai',
  label: 'Grok',
  base: 'https://api.x.ai/v1',
  keyUrl: 'console.x.ai',
  detect: (key) => key.startsWith('xai-'),
  // newest Grok, preferring fast non-reasoning variants for speed
  pick: (ids) =>
    best(
      ids.filter((n) => /^grok/.test(n) && !NOT_CHAT.test(n)),
      (n) =>
        version(n, /grok-(\d+(?:\.\d+)?)/) * 10 +
        (/fast/.test(n) ? 3 : 0) +
        (/non-reasoning/.test(n) ? 2 : 0) +
        (isSnapshot(n) ? 0 : 1),
    ),
});

const groq = openAICompatible({
  id: 'groq',
  label: 'Groq',
  base: 'https://api.groq.com/openai/v1',
  keyUrl: 'console.groq.com/keys',
  detect: (key) => key.startsWith('gsk_'),
  // a large general-purpose model: bigger parameter counts score higher
  pick: (ids) =>
    best(
      ids.filter((n) => !NOT_CHAT.test(n) && !/compound|playai|distil/.test(n)),
      (n) => parseFloat((n.match(/(\d+)b/) || [])[1] || 0) + (/gpt-oss|llama|qwen|kimi|deepseek/.test(n) ? 50 : 0),
    ),
});

const openrouter = openAICompatible({
  id: 'openrouter',
  label: 'OpenRouter',
  base: 'https://openrouter.ai/api/v1',
  keyUrl: 'openrouter.ai/keys',
  detect: (key) => key.startsWith('sk-or-'),
  fixedModel: 'openrouter/auto', // OpenRouter's own router chooses a suitable model per request
  pick: () => 'openrouter/auto',
  headers: { 'X-Title': 'VoiceVerse' },
});

const mistral = openAICompatible({
  id: 'mistral',
  label: 'Mistral',
  base: 'https://api.mistral.ai/v1',
  keyUrl: 'console.mistral.ai/api-keys',
  detect: () => false, // Mistral keys have no recognisable prefix: choose it in settings
  pick: (ids) =>
    ids.find((n) => n === 'mistral-medium-latest') || ids.find((n) => /mistral-(small|large)-latest/.test(n)) || ids[0] || '',
});

const deepseek = openAICompatible({
  id: 'deepseek',
  label: 'DeepSeek',
  base: 'https://api.deepseek.com/v1',
  keyUrl: 'platform.deepseek.com/api_keys',
  detect: () => false, // DeepSeek keys look like OpenAI keys: choose it in settings
  pick: (ids) => ids.find((n) => /chat/.test(n)) || ids[0] || '',
});

const custom = openAICompatible({
  id: 'custom',
  label: 'Custom',
  base: '',
  keyUrl: '',
  detect: () => false,
  pick: (ids) =>
    best(
      ids.filter((n) => !NOT_CHAT.test(n)),
      () => 0,
    ),
});

export const PROVIDERS = [gemini, openai, anthropic, xai, groq, openrouter, mistral, deepseek, custom];
export const providerById = (id) => PROVIDERS.find((p) => p.id === id) || null;

/** Work out the provider from the key's prefix (Gemini, OpenAI, Claude, Grok, Groq and OpenRouter keys are recognisable). */
export const detectProvider = (key) => (key ? PROVIDERS.find((p) => p.detect(key.trim())) || null : null);
