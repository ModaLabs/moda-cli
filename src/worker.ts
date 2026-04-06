// src/worker.ts
// Cloudflare Workers entry point for the MCP HTTP/SSE transport.
//
// NOTE: The MCP SDK's SSEServerTransport expects an Express Response object,
// which is incompatible with the Cloudflare Workers fetch handler model.
// Full SSE support requires either the MCP SDK's StreamableHTTPServerTransport
// or a custom adapter. This file provides the skeleton and a /health endpoint
// that works today; SSE transport implementation is tracked as a follow-up.

import { getToolDefinitions } from './tools.js';
import { handleToolCall } from './handlers.js';

export interface Env {
  MODA_API_KEY: string;
  MODA_BASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'moda-mcp' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/tools' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ tools: getToolDefinitions() }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // SSE/MCP streaming transport handling is deferred pending SDK compatibility
    // investigation. See Phase 3 open question in implementation plan.
    return new Response('Not Found', { status: 404 });
  },
};
