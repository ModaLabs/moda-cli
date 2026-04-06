import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../..');

let mockServer: ChildProcess;

function sendJsonRpc(proc: ChildProcess, method: string, params?: any, id = 1): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for response')), 10000);
    let buffer = '';

    const onData = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            clearTimeout(timeout);
            proc.stdout!.off('data', onData);
            resolve(parsed);
          }
        } catch { /* incomplete JSON */ }
      }
    };

    proc.stdout!.on('data', onData);
    const request = JSON.stringify({ jsonrpc: '2.0', method, params, id });
    proc.stdin!.write(request + '\n');
  });
}

beforeAll(async () => {
  // Start mock server
  mockServer = spawn('node', [resolve(ROOT, 'mock-server.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Mock server did not start in time')), 10000);
    // mock-server.js uses console.log which goes to stdout
    mockServer.stdout!.on('data', (data) => {
      if (data.toString().includes('Mock Data API server running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    mockServer.stderr!.on('data', (data) => {
      if (data.toString().includes('Mock Data API server running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}, 15000);

afterAll(() => {
  mockServer?.kill();
});

describe('MCP Server Integration', () => {
  it('lists 8 tools', async () => {
    const mcpServer = spawn('node', [resolve(ROOT, 'dist/index.js')], {
      env: { ...process.env, MODA_API_KEY: 'moda_sk_test', MODA_BASE_URL: 'http://localhost:3002' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      // Wait for server to start
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MCP server did not start in time')), 10000);
        mcpServer.stderr!.on('data', (data) => {
          if (data.toString().includes('running on stdio')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      const response = await sendJsonRpc(mcpServer, 'tools/list');
      expect(response.result.tools).toHaveLength(8);

      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('moda_get_overview');
      expect(toolNames).toContain('moda_get_frustrations');
      expect(toolNames).toContain('moda_get_tool_failures');
    } finally {
      mcpServer.kill();
    }
  }, 20000);

  it('calls moda_get_overview and returns data', async () => {
    const mcpServer = spawn('node', [resolve(ROOT, 'dist/index.js')], {
      env: { ...process.env, MODA_API_KEY: 'moda_sk_test', MODA_BASE_URL: 'http://localhost:3002' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MCP server did not start in time')), 10000);
        mcpServer.stderr!.on('data', (data) => {
          if (data.toString().includes('running on stdio')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      const response = await sendJsonRpc(mcpServer, 'tools/call', {
        name: 'moda_get_overview',
        arguments: { days_back: 7 },
      });

      expect(response.result.content).toHaveLength(1);
      expect(response.result.content[0].type).toBe('text');

      const data = JSON.parse(response.result.content[0].text);
      expect(data.conversations.total).toBe(1011);
    } finally {
      mcpServer.kill();
    }
  }, 20000);
});
