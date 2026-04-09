// src/auth.ts — Browser-based PKCE authentication for moda init

import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { MODA_BASE_URL } from './config.js';

const AUTH0_DOMAIN = 'dev-6kukcoznniv30wau.us.auth0.com';
const AUTH0_CLIENT_ID = 'JuqWjslalOwI9TXLeU2KkF0NTZab3qgC';
const AUTH0_AUDIENCE = 'https://moda-api';
const CALLBACK_PORT = 8432;
const AUTH_TIMEOUT_MS = 120_000;

const MODA_DIR = join(homedir(), '.moda');
const TOKEN_PATH = join(MODA_DIR, 'auth.json');

// --- PKCE ---

function generateVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// --- Token Storage ---

interface StoredAuth {
  access_token: string;
  expires_at: number; // Unix timestamp in seconds
}

export function loadToken(): string | null {
  try {
    if (!existsSync(TOKEN_PATH)) return null;
    const data: StoredAuth = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    if (data.expires_at && Date.now() / 1000 > data.expires_at - 60) {
      return null; // Expired or about to expire
    }
    return data.access_token || null;
  } catch {
    return null;
  }
}

function saveToken(accessToken: string, expiresIn: number): void {
  mkdirSync(MODA_DIR, { recursive: true });
  const data: StoredAuth = {
    access_token: accessToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    chmodSync(TOKEN_PATH, 0o600);
  } catch {
    // chmod may fail on some systems, the mode flag above handles it
  }
}

// --- Login Flow ---

const SUCCESS_HTML = `<!DOCTYPE html>
<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fafafa">
<div style="text-align:center">
<h2>Authenticated</h2>
<p>You can close this tab and return to your terminal.</p>
</div>
<script>setTimeout(()=>window.close(),2000)</script>
</body></html>`;

export async function login(): Promise<string> {
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (settled) return;
      const url = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h2>Error</h2><p>${errorDescription || error}</p></body></html>`);
        settled = true;
        server.close();
        reject(new Error(`Auth0 error: ${errorDescription || error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Error</h2><p>No authorization code received.</p></body></html>');
        settled = true;
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      // Exchange code for tokens
      try {
        const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: AUTH0_CLIENT_ID,
            code,
            redirect_uri: `http://localhost:${CALLBACK_PORT}/callback`,
            code_verifier: verifier,
          }),
        });

        if (!tokenResponse.ok) {
          const errBody = await tokenResponse.text();
          throw new Error(`Token exchange failed (${tokenResponse.status}): ${errBody}`);
        }

        const tokens = (await tokenResponse.json()) as {
          access_token: string;
          expires_in: number;
        };

        saveToken(tokens.access_token, tokens.expires_in);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(SUCCESS_HTML);

        settled = true;
        server.close();
        resolve(tokens.access_token);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Error</h2><p>Token exchange failed.</p></body></html>');
        settled = true;
        server.close();
        reject(err);
      }
    });

    // Timeout
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        server.close();
        reject(new Error('Authentication timed out. Please try again.'));
      }
    }, AUTH_TIMEOUT_MS);

    server.on('close', () => clearTimeout(timeout));

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${CALLBACK_PORT} is in use. Close the process using it and try again.`,
        ));
      } else {
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, async () => {
      const authUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', AUTH0_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', `http://localhost:${CALLBACK_PORT}/callback`);
      authUrl.searchParams.set('audience', AUTH0_AUDIENCE);
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      try {
        const open = (await import('open')).default;
        await open(authUrl.toString());
      } catch {
        console.error(`  Open this URL in your browser:\n  ${authUrl.toString()}`);
      }
    });

    // Clean up on process exit
    const cleanup = () => {
      if (!settled) {
        settled = true;
        server.close();
      }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

// --- Authenticated Fetch ---

export async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = loadToken();
  if (!token) {
    throw new Error('Not authenticated. Run "moda init" to log in.');
  }

  const url = `${MODA_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
