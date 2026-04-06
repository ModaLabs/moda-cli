import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-client
vi.mock('../api-client.js', () => ({
  callDataAPI: vi.fn().mockResolvedValue({ mock: true }),
}));

import { handleToolCall } from '../handlers.js';
import { callDataAPI } from '../api-client.js';

const mockCallDataAPI = vi.mocked(callDataAPI);

describe('handleToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moda_get_overview calls correct endpoint', async () => {
    await handleToolCall('moda_get_overview', { days_back: 14 });
    expect(mockCallDataAPI).toHaveBeenCalledWith('/overview?days_back=14');
  });

  it('moda_get_overview with no args omits query string', async () => {
    await handleToolCall('moda_get_overview', {});
    expect(mockCallDataAPI).toHaveBeenCalledWith('/overview');
  });

  it('moda_get_clusters passes parent_id and time_range', async () => {
    await handleToolCall('moda_get_clusters', { parent_id: 'node-1', time_range: '7d' });
    expect(mockCallDataAPI).toHaveBeenCalledWith(expect.stringContaining('parent_id=node-1'));
    expect(mockCallDataAPI).toHaveBeenCalledWith(expect.stringContaining('time_range=7d'));
  });

  it('moda_get_cluster_conversations includes offset=0', async () => {
    await handleToolCall('moda_get_cluster_conversations', { node_id: 'c-1', offset: 0 });
    const calledUrl = mockCallDataAPI.mock.calls[0][0];
    expect(calledUrl).toContain('offset=0');
  });

  it('moda_search_conversations includes offset=0', async () => {
    await handleToolCall('moda_search_conversations', { offset: 0 });
    const calledUrl = mockCallDataAPI.mock.calls[0][0];
    expect(calledUrl).toContain('offset=0');
  });

  it('moda_get_frustrations includes offset=0', async () => {
    await handleToolCall('moda_get_frustrations', { offset: 0 });
    const calledUrl = mockCallDataAPI.mock.calls[0][0];
    expect(calledUrl).toContain('offset=0');
  });

  it('moda_get_tool_failure_detail includes offset=0', async () => {
    await handleToolCall('moda_get_tool_failure_detail', { tool_name: 'search', offset: 0 });
    const calledUrl = mockCallDataAPI.mock.calls[0][0];
    expect(calledUrl).toContain('offset=0');
  });

  it('moda_get_conversation_context uses conversation_id in path', async () => {
    await handleToolCall('moda_get_conversation_context', { conversation_id: 'conv-abc' });
    expect(mockCallDataAPI).toHaveBeenCalledWith(expect.stringContaining('/conversations/conv-abc/context'));
  });

  it('moda_get_tool_failures calls correct endpoint', async () => {
    await handleToolCall('moda_get_tool_failures', { days_back: 30 });
    expect(mockCallDataAPI).toHaveBeenCalledWith('/tool-failures?days_back=30');
  });

  it('moda_get_tool_failure_detail uses tool_name in path', async () => {
    await handleToolCall('moda_get_tool_failure_detail', { tool_name: 'compose' });
    expect(mockCallDataAPI).toHaveBeenCalledWith(expect.stringContaining('/tool-failures/compose'));
  });

  it('throws on unknown tool', async () => {
    await expect(handleToolCall('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
  });

  it('throws on invalid arguments', async () => {
    await expect(handleToolCall('moda_get_overview', { days_back: 'invalid' })).rejects.toThrow('Invalid arguments');
  });

  it('returns content array with JSON text', async () => {
    const result = await handleToolCall('moda_get_overview', {});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ mock: true });
  });
});
