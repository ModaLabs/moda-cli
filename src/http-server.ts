#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { validateConfig, PORT, VERSION } from './config.js';
import { getToolDefinitions } from './tools.js';
import { handleToolCall } from './handlers.js';

validateConfig();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) =>
  o.trim(),
);

app.use(
  cors(
    allowedOrigins
      ? { origin: allowedOrigins }
      : undefined,
  ),
);
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'moda-cli', version: VERSION });
});

app.get('/mcp/sse', async (req, res) => {
  console.log('Client connected to SSE endpoint');

  const transport = new SSEServerTransport('/mcp/messages', res);
  transports.set(transport.sessionId, transport);

  const server = new Server(
    { name: 'moda-data-api', version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args);
  });

  await server.connect(transport);

  req.on('close', () => {
    console.log('Client disconnected');
    transports.delete(transport.sessionId);
    server.close();
  });
});

app.post('/mcp/messages', express.text(), async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).end('Session not found');
    return;
  }
  await transport.handlePostMessage(req, res);
});

const server = app.listen(PORT, () => {
  console.log(
    `Moda MCP Server (HTTP) running on http://localhost:${PORT}`,
  );
  console.log(`  SSE endpoint: http://localhost:${PORT}/mcp/sse`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
});

function shutdown() {
  console.log('Shutting down...');
  for (const [id, transport] of transports) {
    try {
      transport.close?.();
    } catch {
      // ignore close errors during shutdown
    }
    transports.delete(id);
  }
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
