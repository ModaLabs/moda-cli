import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../dist/index.js');
const MODA_API_KEY = process.env.MODA_API_KEY;

// --- Types ---

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
}

// --- JSON-RPC Helper ---

let nextId = 1;

function sendJsonRpc(
  server: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const id = nextId++;
  return new Promise<JsonRpcResponse>((resolve, reject) => {
    let buffer = '';

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            server.stdout!.removeListener('data', onData);
            resolve(parsed as JsonRpcResponse);
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    };

    server.stdout!.on('data', onData);

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      ...(params && { params }),
      id,
    });
    server.stdin!.write(message + '\n');

    // Timeout after 30s
    setTimeout(() => {
      server.stdout!.removeListener('data', onData);
      reject(new Error(`sendJsonRpc timed out waiting for response id=${id}`));
    }, 30_000);
  });
}

// --- Shared State for Chained Tests ---

let capturedNodeId: string | undefined;
let capturedConversationId: string | undefined;
let capturedToolName: string | undefined;

// --- Test Suite ---

describe.skipIf(!MODA_API_KEY)('E2E: MCP Server against live backend', { timeout: 30_000 }, () => {
  let mcpServer: ChildProcess;

  beforeAll(async () => {
    // Spawn the MCP server process
    mcpServer = spawn('node', [SERVER_PATH], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for the server startup message on stderr
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10_000);
      mcpServer.stderr!.on('data', (data) => {
        if (data.toString().includes('running on stdio')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      mcpServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // MCP protocol: send initialize request
    const initResponse = await sendJsonRpc(mcpServer, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-test', version: '1.0.0' },
    });
    expect(initResponse.result).toBeDefined();

    // MCP protocol: send initialized notification (no id, no response)
    mcpServer.stdin!.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
    );
  });

  afterAll(() => {
    mcpServer?.kill();
  });

  // --- Phase 1: Overview ---

  it('moda_get_overview returns valid overview data', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_overview',
      arguments: { days_back: 7 },
    });

    expect(response.result).toBeDefined();
    expect(response.result!.content).toHaveLength(1);
    expect(response.result!.content[0].type).toBe('text');

    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('conversations');
    expect(data).toHaveProperty('frustrations');
    expect(data).toHaveProperty('tool_failures');
    expect(data).toHaveProperty('top_clusters');
    expect(data).toHaveProperty('recent_activity');
  });

  // --- Phase 2: Independent Tools ---

  it('moda_get_clusters returns cluster hierarchy', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_clusters',
      arguments: {},
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('clusters');
    expect(Array.isArray(data.clusters)).toBe(true);

    if (data.clusters.length > 0) {
      const cluster = data.clusters[0];
      expect(cluster).toHaveProperty('node_id');
      expect(cluster).toHaveProperty('label');
      // Capture for Phase 3
      capturedNodeId = cluster.node_id;
    }
  });

  it('moda_search_conversations returns conversations list', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_search_conversations',
      arguments: {},
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
    expect(data).toHaveProperty('pagination');

    if (data.conversations.length > 0) {
      const convo = data.conversations[0];
      expect(convo).toHaveProperty('conversation_id');
      expect(convo).toHaveProperty('summary');
      // Capture for Phase 3
      capturedConversationId = convo.conversation_id;
    }
  });

  it('moda_get_frustrations returns frustration data', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_frustrations',
      arguments: { days_back: 7 },
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('frustrations');
    expect(Array.isArray(data.frustrations)).toBe(true);

    if (data.frustrations.length > 0) {
      expect(data.frustrations[0]).toHaveProperty('conversation_id');
    }
  });

  it('moda_get_tool_failures returns failure overview', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_tool_failures',
      arguments: { days_back: 7 },
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('tools');
    expect(Array.isArray(data.tools)).toBe(true);

    if (data.tools.length > 0) {
      const tool = data.tools[0];
      expect(tool).toHaveProperty('tool_name');
      expect(tool).toHaveProperty('failure_count');
      // Capture for Phase 3
      capturedToolName = tool.tool_name;
    }
  });

  // --- Phase 3: Chained Tools ---

  it('moda_get_cluster_conversations returns conversations for a cluster', async () => {
    if (!capturedNodeId) {
      console.warn('Skipping: no node_id captured from moda_get_clusters (empty data)');
      return;
    }

    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_cluster_conversations',
      arguments: { node_id: capturedNodeId },
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('cluster');
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
    expect(data).toHaveProperty('pagination');

    if (data.conversations.length > 0) {
      expect(data.conversations[0]).toHaveProperty('conversation_id');
    }
  });

  it('moda_get_conversation_context returns message context', async () => {
    if (!capturedConversationId) {
      console.warn('Skipping: no conversation_id captured from moda_search_conversations (empty data)');
      return;
    }

    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_conversation_context',
      arguments: { conversation_id: capturedConversationId },
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('conversation_id');
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('context');
    expect(data.context).toHaveProperty('messages');
    expect(Array.isArray(data.context.messages)).toBe(true);
  });

  it('moda_get_tool_failure_detail returns failure details', async () => {
    if (!capturedToolName) {
      console.warn('Skipping: no tool_name captured from moda_get_tool_failures (empty data)');
      return;
    }

    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_tool_failure_detail',
      arguments: { tool_name: capturedToolName },
    });

    expect(response.result).toBeDefined();
    const data = JSON.parse(response.result!.content[0].text);
    expect(data).toHaveProperty('tool_name');
    expect(typeof data.tool_name).toBe('string');
    expect(data).toHaveProperty('subtypes');
    expect(Array.isArray(data.subtypes)).toBe(true);
    expect(data).toHaveProperty('examples');
    expect(Array.isArray(data.examples)).toBe(true);
  });

  // --- Error Handling ---

  it('returns error for invalid arguments (Zod validation)', async () => {
    const response = await sendJsonRpc(mcpServer, 'tools/call', {
      name: 'moda_get_overview',
      arguments: { days_back: 999 },
    });

    // The MCP SDK wraps handler errors into an error response
    expect(response.error).toBeDefined();
    expect(response.error!.message).toContain('Invalid arguments');
  });
});
