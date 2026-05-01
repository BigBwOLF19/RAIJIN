const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';
const PUBLIC_ROOT = __dirname;
const MAX_RETRIES = 3;
const DEFAULT_COOLDOWN_MS = (Number(process.env.KEY_COOLDOWN_SECONDS) || 60) * 1000;

// ===================== KEY POOL =====================
// Round-robin rotation with automatic cooldown on 429s.

class KeyPool {
  constructor(keys, defaultCooldownMs) {
    if (!keys || keys.length === 0) {
      throw new Error(
        'No Gemini API keys found. Set GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY in .env'
      );
    }
    this.keys = keys.map((k, i) => ({
      key: k,
      index: i,
      cooledUntil: 0,        // timestamp when cooldown expires
      label: `Key#${i + 1}`, // safe log label (never prints full key)
    }));
    this.defaultCooldownMs = defaultCooldownMs;
    this.nextIndex = 0;
  }

  /**
   * Returns the next available (non-cooled-down) key entry, or null if all
   * keys are currently cooling down.
   */
  getNext() {
    const now = Date.now();
    const total = this.keys.length;

    // Try each key starting from the round-robin pointer.
    for (let attempt = 0; attempt < total; attempt++) {
      const idx = (this.nextIndex + attempt) % total;
      const entry = this.keys[idx];
      if (now >= entry.cooledUntil) {
        // Advance pointer past this key for next call.
        this.nextIndex = (idx + 1) % total;
        return entry;
      }
    }

    // All keys are cooling down — return null.
    return null;
  }

  /**
   * Marks a key as exhausted (429). It will be skipped until cooldown expires.
   * @param {object} entry  - Key entry from getNext()
   * @param {string} errorMessage - Raw error message (may contain 'retry in Xs')
   */
  markExhausted(entry, errorMessage, reason = 'quota') {
    const cooldownMs = reason === 'overloaded'
      ? Math.min(this._parseRetryDelay(errorMessage) || 15000, 30000)
      : (this._parseRetryDelay(errorMessage) || this.defaultCooldownMs);
    entry.cooledUntil = Date.now() + cooldownMs;
    const cooldownSec = Math.round(cooldownMs / 1000);
    console.warn(
      `⚡ ${entry.label} ${reason === 'overloaded' ? 'overloaded (503)' : 'hit quota limit'} — cooling down for ${cooldownSec}s.`
    );
  }

  /** How many keys are currently available (not cooling down). */
  availableCount() {
    const now = Date.now();
    return this.keys.filter((k) => now >= k.cooledUntil).length;
  }

  /** Total number of keys in the pool. */
  totalCount() {
    return this.keys.length;
  }

  /** Parse 'retry in 42s' from Gemini error messages. */
  _parseRetryDelay(message) {
    const match = String(message || '').match(/retry in\s+([\d.]+)s/i);
    if (!match) return null;
    return Math.max(5000, Math.ceil(Number(match[1]) * 1000));
  }

  /** Human-readable status for logging. */
  status() {
    const now = Date.now();
    return this.keys
      .map((k) => {
        if (now >= k.cooledUntil) return `${k.label}: ready`;
        const remaining = Math.round((k.cooledUntil - now) / 1000);
        return `${k.label}: cooling (${remaining}s left)`;
      })
      .join(' | ');
  }
}

// Parse keys: GEMINI_API_KEYS (comma-separated) with fallback to GEMINI_API_KEY (singular).
function loadApiKeys() {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) {
    const keys = multi
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length > 0) return keys;
  }
  // Fallback to singular key.
  const single = process.env.GEMINI_API_KEY;
  if (single && single.trim()) return [single.trim()];
  return [];
}

const keyPool = new KeyPool(loadApiKeys(), DEFAULT_COOLDOWN_MS);

// ===================== HELPERS =====================

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end('Server error');
    }
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
}

function buildGeminiPrompt(messages) {
  const systemMessage = messages.find((m) => m.role === 'system');
  let prompt = '';
  if (systemMessage) {
    prompt += `${systemMessage.content.trim()}\n\n`;
  }
  messages.forEach((m) => {
    if (m.role === 'user') {
      prompt += `User: ${m.content.trim()}\n\n`;
    } else if (m.role === 'assistant') {
      prompt += `Assistant: ${m.content.trim()}\n\n`;
    }
  });
  prompt += 'Assistant:';
  return prompt;
}

function extractGeminiText(parsed) {
  const parts = parsed?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) => part?.text || '')
      .join('')
      .trim();
    if (text) {
      return text;
    }
  }

  const legacyText =
    parsed?.candidates?.[0]?.output ||
    parsed?.output?.text ||
    parsed?.text ||
    '';

  return typeof legacyText === 'string' ? legacyText.trim() : '';
}

function makeHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getClientErrorCode(error) {
  if (error.statusCode === 429) return 'quota_exceeded';
  if (error.statusCode === 503) return 'overloaded';
  if (error.statusCode === 401 || error.statusCode === 403) return 'auth_failed';
  if (error.statusCode === 502) return 'network_error';
  return 'api_error';
}

// ===================== GEMINI API =====================

/**
 * Single request to Gemini using a specific API key.
 * @param {object[]} messages  - Conversation messages
 * @param {string}   apiKey    - The Gemini API key to use
 * @param {string}   keyLabel  - Safe label for logging (e.g. "Key#2")
 */
function requestGemini(messages, apiKey, keyLabel, modelOverride) {
  return new Promise((resolve, reject) => {
    const model = modelOverride || MODEL;
    const prompt = buildGeminiPrompt(messages);
    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2,
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    console.log(`→ Sending request via ${keyLabel} (model: ${model})`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = extractGeminiText(parsed);
            if (!text) {
              console.error('Gemini success response did not contain text:', JSON.stringify(parsed, null, 2));
            }
            console.log(`✓ ${keyLabel} responded successfully (model: ${model}).`);
            resolve({ text, raw: parsed });
          } else {
            const detail = parsed.error?.message || parsed.message || `Gemini API error ${res.statusCode}`;
            console.error(`✗ ${keyLabel} error (${res.statusCode}):`, detail);
            reject(makeHttpError(detail, res.statusCode));
          }
        } catch (err) {
          console.error('Gemini raw response:', data);
          reject(makeHttpError('Failed to parse Gemini response', 502));
        }
      });
    });

    req.on('error', (err) => reject(makeHttpError(err.message || 'Network error while contacting Gemini', 502)));
    req.write(body);
    req.end();
  });
}

/**
 * Proxy a chat request through the key pool with automatic rotation and retry.
 *
 * Strategy:
 *  - Pick the next available key from the pool (round-robin).
 *  - If the request succeeds, return the result.
 *  - If a 429 is returned, mark that key as exhausted and try the next key.
 *  - If a 503 is returned, retry on the same key (up to MAX_RETRIES).
 *  - If all keys are exhausted, return the 429 error to the client.
 */
async function proxyGemini(messages) {
  // Try the primary model first, then fallback model.
  const modelsToTry = [MODEL];
  if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
    modelsToTry.push(FALLBACK_MODEL);
  }

  let lastError;

  for (const currentModel of modelsToTry) {
    const keysTotal = keyPool.totalCount();
    let keysTried = 0;

    // Reset cooldowns when switching to fallback model (the overload is model-specific).
    if (currentModel !== MODEL) {
      console.log(`⚡ Primary model failed. Trying fallback model: ${currentModel}`);
    }

    // Outer loop: try different keys on 429/503.
    while (keysTried < keysTotal) {
      const entry = keyPool.getNext();

      if (!entry) {
        // All keys are cooling down — break to try fallback model.
        break;
      }

      // Inner loop: one retry on 503, then rotate key.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await requestGemini(messages, entry.key, entry.label, currentModel);
        } catch (error) {
          lastError = error;

          // 429: Quota exhausted for this key — mark it and try the next key.
          if (error.statusCode === 429) {
            keyPool.markExhausted(entry, error.message, 'quota');
            keysTried++;
            console.log(`   Pool status: ${keyPool.status()}`);
            break; // break inner loop, continue outer loop to try next key
          }

          // 503: Overloaded — retry once, then rotate to next key.
          if (error.statusCode === 503) {
            if (attempt < 2) {
              const delayMs = 800;
              console.warn(`   ${entry.label} overloaded (attempt ${attempt}/2). Retrying in ${delayMs}ms.`);
              await wait(delayMs);
              continue;
            }
            // After 1 retry, mark this key with a short cooldown and move on.
            keyPool.markExhausted(entry, error.message, 'overloaded');
            keysTried++;
            console.log(`   Pool status: ${keyPool.status()}`);
            break;
          }

          // Any other error (auth, network, etc.) — don't rotate, just throw.
          throw error;
        }
      }
    }
  }

  // All keys and models have been tried.
  const err = lastError || makeHttpError('All API keys are currently rate-limited. Please wait.', 429);
  err.statusCode = err.statusCode || 429;
  throw err;
}

// ===================== HTTP SERVER =====================

function createServer() {
  return http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${DEFAULT_PORT}`}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'POST' && pathname === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const messages = payload.messages;
        if (!Array.isArray(messages)) {
          return sendJson(res, 400, {error: 'Invalid request payload: messages must be an array.'});
        }
        const result = await proxyGemini(messages);
        sendJson(res, 200, result);
      } catch (error) {
        console.error('Chat proxy failed:', error);
        const statusCode = error.statusCode || 500;
        sendJson(res, statusCode, {
          error: {
            code: getClientErrorCode(error),
            message: error.message || 'Unknown error',
          },
        });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      model: MODEL,
      keys: {
        total: keyPool.totalCount(),
        available: keyPool.availableCount(),
      },
    });
  }

  if (req.method === 'GET' && (pathname === '/' || pathname === '/Raijin.html')) {
    return sendFile(res, path.join(PUBLIC_ROOT, 'Raijin.html'), 'text/html');
  }

  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not found');
  });
}

function startServer(port) {
  const server = createServer();

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on http://localhost:${nextPort}`);
      startServer(nextPort);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log('');
    console.log('⚡ ═══════════════════════════════════════════');
    console.log('⚡  RAIJIN SERVER');
    console.log('⚡ ═══════════════════════════════════════════');
    console.log(`⚡  URL:    http://localhost:${port}`);
    console.log(`⚡  Model:  ${MODEL}`);
    console.log(`⚡  Keys:   ${keyPool.totalCount()} loaded for rotation`);
    console.log(`⚡  Cooldown: ${Math.round(DEFAULT_COOLDOWN_MS / 1000)}s per exhausted key`);
    console.log('⚡ ═══════════════════════════════════════════');
    console.log('');
  });
}

startServer(DEFAULT_PORT);
