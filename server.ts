import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Administrator identity & salted scrypt credential storage (server-side only)
const rawEnvAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEnvAdminEmail)
  ? rawEnvAdminEmail
  : 'admin@vijaya.com';

const ADMIN_LOGIN_PATH = '/admin/login';
const MAX_CONCURRENT_SESSIONS = 25;

interface SaltedCredential {
  salt: string;
  hash: string;
}

interface AdminSession {
  id: string;
  token: string;
  email: string;
  role: 'Administrator';
  deviceLabel: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
}

function hashPassword(password: string, saltHex?: string): SaltedCredential {
  const salt = saltHex ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, stored: SaltedCredential): boolean {
  const derived = crypto.scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function parseDeviceLabel(userAgentHeader: string | undefined): string {
  const ua = (userAgentHeader || '').slice(0, 300);
  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let os = 'Desktop';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

// If ADMIN_PASSWORD is provided via environment secrets, hash it at startup and lock setup
const envAdminCredential: SaltedCredential | null =
  process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0
    ? hashPassword(process.env.ADMIN_PASSWORD)
    : null;

// One-time first-run claimed credential (used only when ADMIN_PASSWORD env var is unset)
let claimedAdminCredential: SaltedCredential | null = null;

function getAuthMode(): 'env' | 'claimed' | 'unconfigured' {
  if (envAdminCredential) return 'env';
  if (claimedAdminCredential) return 'claimed';
  return 'unconfigured';
}

function getActiveCredential(): SaltedCredential | null {
  return envAdminCredential ?? claimedAdminCredential;
}

// In-memory opaque Bearer session registry supporting multiple simultaneous admin logins
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, AdminSession>();

function pruneExpiredSessions(now = Date.now()): void {
  for (const [key, sess] of sessions.entries()) {
    if (sess.expiresAt <= now) {
      sessions.delete(key);
    }
  }
}

function createAdminSession(email: string, userAgent?: string): AdminSession {
  const now = Date.now();
  pruneExpiredSessions(now);

  // Enforce upper bound without displacing recent concurrent sessions
  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    let oldestKey: string | null = null;
    let oldestActivity = Infinity;
    for (const [key, sess] of sessions.entries()) {
      if (sess.lastActiveAt < oldestActivity) {
        oldestActivity = sess.lastActiveAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      sessions.delete(oldestKey);
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const id = `sess_${crypto.randomBytes(6).toString('hex')}`;
  const session: AdminSession = {
    id,
    token,
    email,
    role: 'Administrator',
    deviceLabel: parseDeviceLabel(userAgent),
    createdAt: now,
    lastActiveAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  return session;
}

function getValidSession(token: string | null | undefined): AdminSession | null {
  if (!token || typeof token !== 'string' || token.length < 32) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt <= now) {
    sessions.delete(token);
    return null;
  }
  session.lastActiveAt = now;
  return session;
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

// Simple per-IP rate limiter for auth endpoints
const AUTH_WINDOW_MS = 5 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 20;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = extractBearerToken(req);
  const session = getValidSession(token);
  if (!session) {
    res.status(401).json({ error: 'Authentication required. Please sign in again.' });
    return;
  }
  res.locals.adminSession = session;
  next();
}

function createGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface MapsGroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeId?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{
        uri?: string;
        title?: string;
        reviewId?: string;
        content?: string;
      }>;
    };
  };
}

interface GroundedPlaceLink {
  title: string;
  uri: string;
  reviewSnippets: Array<{ title: string; uri: string; content?: string }>;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Baseline security headers for API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth status (non-sensitive bootstrap state)
  app.get('/api/auth/status', (_req, res) => {
    res.json({
      mode: getAuthMode(),
      adminEmail: ADMIN_EMAIL,
      loginPath: ADMIN_LOGIN_PATH,
      concurrentLoginsAllowed: true,
      maxConcurrentSessions: MAX_CONCURRENT_SESSIONS,
    });
  });

  // One-time first-run admin password setup (locked once claimed or if ADMIN_PASSWORD env var is set)
  app.post('/api/auth/setup', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkAuthRateLimit(clientIp)) {
      res.status(429).json({
        error: 'Too many authentication attempts. Please wait a few minutes and try again.',
      });
      return;
    }

    if (getAuthMode() !== 'unconfigured') {
      res.status(409).json({
        error: 'Administrator password is already configured. Please sign in.',
      });
      return;
    }

    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Administrator User ID and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== ADMIN_EMAIL) {
      res.status(400).json({
        error: `Administrator User ID must match ${ADMIN_EMAIL}.`,
      });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        error: 'Password must be between 8 and 128 characters.',
      });
      return;
    }

    claimedAdminCredential = hashPassword(password);
    const session = createAdminSession(ADMIN_EMAIL, req.headers['user-agent']);

    res.status(201).json({
      token: session.token,
      sessionId: session.id,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  });

  // Administrator login (allows multiple concurrent sessions simultaneously)
  app.post('/api/auth/login', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkAuthRateLimit(clientIp)) {
      res.status(429).json({
        error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      });
      return;
    }

    const activeCredential = getActiveCredential();
    if (!activeCredential) {
      res.status(409).json({
        error: 'Administrator password has not been initialized yet. Complete first-run setup.',
      });
      return;
    }

    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      password.length === 0 ||
      password.length > 128
    ) {
      res.status(400).json({ error: 'Please enter your User ID and password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailMatches = normalizedEmail === ADMIN_EMAIL;
    const passwordMatches = verifyPassword(password, activeCredential);

    if (!emailMatches || !passwordMatches) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const session = createAdminSession(ADMIN_EMAIL, req.headers['user-agent']);
    res.json({
      token: session.token,
      sessionId: session.id,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  });

  // Verify current bearer session
  app.get('/api/auth/me', requireAdminAuth, (_req, res) => {
    const session = res.locals.adminSession as AdminSession;
    res.json({
      sessionId: session.id,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  });

  // List active concurrent administrator sessions (never exposes raw Bearer tokens)
  app.get('/api/auth/sessions', requireAdminAuth, (_req, res) => {
    const current = res.locals.adminSession as AdminSession;
    pruneExpiredSessions();

    const activeSessions = Array.from(sessions.values())
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((s) => ({
        id: s.id,
        email: s.email,
        role: s.role,
        deviceLabel: s.deviceLabel,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        expiresAt: s.expiresAt,
        isCurrent: s.id === current.id,
      }));

    res.json({
      loginPath: ADMIN_LOGIN_PATH,
      concurrentLoginsAllowed: true,
      maxConcurrentSessions: MAX_CONCURRENT_SESSIONS,
      activeCount: activeSessions.length,
      sessions: activeSessions,
    });
  });

  // Revoke a specific concurrent session by its non-secret session ID
  app.delete('/api/auth/sessions/:sessionId', requireAdminAuth, (req, res) => {
    const current = res.locals.adminSession as AdminSession;
    const { sessionId } = req.params;

    if (!/^sess_[a-f0-9]{12}$/.test(sessionId)) {
      res.status(400).json({ error: 'Invalid session identifier.' });
      return;
    }

    let removedToken: string | null = null;
    for (const [tok, sess] of sessions.entries()) {
      if (sess.id === sessionId) {
        removedToken = tok;
        break;
      }
    }

    if (!removedToken) {
      res.status(404).json({ error: 'Session not found or already signed out.' });
      return;
    }

    sessions.delete(removedToken);
    res.json({
      ok: true,
      revokedCurrent: sessionId === current.id,
    });
  });

  // Revoke all other concurrent sessions while keeping the current session signed in
  app.post('/api/auth/sessions/revoke-others', requireAdminAuth, (_req, res) => {
    const current = res.locals.adminSession as AdminSession;
    let revokedCount = 0;

    for (const [tok, sess] of sessions.entries()) {
      if (sess.id !== current.id) {
        sessions.delete(tok);
        revokedCount += 1;
      }
    }

    res.json({ ok: true, revokedCount });
  });

  // Revoke only the caller's bearer session on sign out (preserves other concurrent logins)
  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      sessions.delete(token);
    }
    res.json({ ok: true });
  });

  // Google Maps Grounding via gemini-4-hydrogen (authenticated server-side route)
  app.post('/api/maps-grounding', requireAdminAuth, async (req, res) => {
    try {
      const { query, latLng, accountContext } = req.body as {
        query?: string;
        latLng?: { latitude: number; longitude: number };
        accountContext?: string;
      };

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'A territory or location query is required.' });
        return;
      }

      if (query.length > 1000) {
        res.status(400).json({ error: 'Query exceeds maximum length of 1,000 characters.' });
        return;
      }

      const ai = createGenAIClient();
      const safeContext =
        typeof accountContext === 'string' ? accountContext.slice(0, 300) : '';
      const fullPrompt = safeContext
        ? `Enterprise B2B Field Sales Context: ${safeContext}\n\nRequest: ${query.trim()}\n\nProvide a concise, executive-ready briefing with verified locations, practical proximity details, and recommendations.`
        : query.trim();

      const config: {
        tools: Array<{ googleMaps: Record<string, never> }>;
        toolConfig?: {
          retrievalConfig: {
            latLng: { latitude: number; longitude: number };
          };
        };
      } = {
        tools: [{ googleMaps: {} }],
      };

      if (
        latLng &&
        typeof latLng.latitude === 'number' &&
        typeof latLng.longitude === 'number' &&
        Number.isFinite(latLng.latitude) &&
        Number.isFinite(latLng.longitude) &&
        latLng.latitude >= -90 &&
        latLng.latitude <= 90 &&
        latLng.longitude >= -180 &&
        latLng.longitude <= 180
      ) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: latLng.latitude,
              longitude: latLng.longitude,
            },
          },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: fullPrompt,
        config,
      });

      const rawChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ??
        []) as MapsGroundingChunk[];

      const places: GroundedPlaceLink[] = [];
      const seenUris = new Set<string>();

      for (const chunk of rawChunks) {
        if (chunk.maps?.uri) {
          const uri = chunk.maps.uri;
          if (!seenUris.has(uri)) {
            seenUris.add(uri);
            const reviewSnippets = (
              chunk.maps.placeAnswerSources?.reviewSnippets ?? []
            )
              .filter((r) => Boolean(r.uri || r.title || r.content))
              .map((r) => ({
                title: r.title || 'Google Maps Review',
                uri: r.uri || uri,
                content: r.content,
              }));

            places.push({
              title: chunk.maps.title || 'Google Maps Location',
              uri,
              reviewSnippets,
            });
          }
        }
      }

      res.json({
        text: response.text ?? 'No location details were returned for this query.',
        places,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to run Google Maps grounding query.';
      console.error('[maps-grounding error]', message);
      res.status(500).json({ error: message });
    }
  });

  const server = http.createServer(app);

  // WebSocket server for Gemini Live API (gemini-3.8-live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    if (pathname === '/api/live-voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (isProduction) {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;
    let isAuthenticated = false;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const connectLiveSession = async (
      voiceName: string,
      crmSummary: string
    ) => {
      try {
        const ai = createGenAIClient();
        const validVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
        const chosenVoice = validVoices.has(voiceName) ? voiceName : 'Zephyr';

        const safeSummary = crmSummary.slice(0, 6000);
        const systemInstruction = [
          'You are the VijayaEle_CRM Executive Revenue Advisor speaking live with a VP of Enterprise Sales.',
          'Keep spoken answers crisp, analytical, and executive-ready (2 to 4 sentences unless asked for deeper breakdown).',
          'Reference exact deal values, account names, stages, and quota gaps from the live pipeline context below.',
          safeSummary ? `\nLive Pipeline Context:\n${safeSummary}` : '',
        ].join(' ');

        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              safeSend({ type: 'ready', voiceName: chosenVoice });
            },
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                safeSend({
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                });
              }
              if (content?.outputTranscription?.text) {
                safeSend({
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                });
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  safeSend({
                    type: 'audio',
                    audio: part.inlineData.data,
                  });
                }
              }
              if (content?.interrupted) {
                safeSend({ type: 'interrupted' });
              }
              if (content?.turnComplete) {
                safeSend({ type: 'turnComplete' });
              }
            },
            onerror: (err: unknown) => {
              const errMsg =
                err instanceof Error ? err.message : 'Live voice session encountered an error.';
              safeSend({ type: 'error', error: errMsg });
            },
            onclose: () => {
              if (!isClosing) {
                safeSend({ type: 'closed' });
              }
            },
          },
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to connect to Gemini Live voice session.';
        console.error('[live-voice connect error]', message);
        safeSend({ type: 'error', error: message });
      }
    };

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          token?: string;
          voiceName?: string;
          crmSummary?: string;
          audio?: string;
          text?: string;
        };

        if (msg.type === 'init') {
          const session = getValidSession(msg.token);
          if (!session) {
            safeSend({
              type: 'error',
              error: 'Authentication required. Please sign in again.',
            });
            clientWs.close(4401, 'Unauthorized');
            return;
          }
          isAuthenticated = true;

          if (liveSession) {
            try {
              liveSession.close();
            } catch {
              // ignore
            }
            liveSession = null;
          }
          await connectLiveSession(msg.voiceName || 'Zephyr', msg.crmSummary || '');
          return;
        }

        if (!isAuthenticated || !liveSession) return;

        if (msg.type === 'audio' && typeof msg.audio === 'string' && msg.audio.length > 0) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
          liveSession.sendRealtimeInput({
            text: msg.text.slice(0, 2000),
          });
        }
      } catch (err) {
        console.error('[live-voice message error]', err);
      }
    });

    clientWs.on('close', () => {
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`VijayaEle_CRM server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VijayaEle_CRM server:', err);
  process.exit(1);
});
