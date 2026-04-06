import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-client (same pattern as handlers.test.ts)
vi.mock('../api-client.js', () => ({
  callDataAPI: vi.fn().mockResolvedValue({ mock: true }),
}));

// Mock config to prevent process.exit
vi.mock('../config.js', () => ({
  validateConfig: vi.fn(),
  MODA_API_KEY: 'test-key',
  MODA_BASE_URL: 'https://test.example.com',
  PORT: 3003,
}));

// Import after mocks
import { parseArgs, flagsToArgs } from '../cli.js';
import { callDataAPI } from '../api-client.js';

const mockCallDataAPI = vi.mocked(callDataAPI);

describe('parseArgs', () => {
  it('extracts command from argv', () => {
    const result = parseArgs(['node', 'cli.js', 'overview']);
    expect(result.command).toBe('overview');
    expect(result.positional).toBeUndefined();
    expect(result.flags).toEqual({});
  });

  it('extracts positional argument', () => {
    const result = parseArgs(['node', 'cli.js', 'cluster-conversations', 'node-123']);
    expect(result.command).toBe('cluster-conversations');
    expect(result.positional).toBe('node-123');
  });

  it('parses --key=value flags', () => {
    const result = parseArgs(['node', 'cli.js', 'overview', '--days-back=30']);
    expect(result.flags).toEqual({ 'days-back': '30' });
  });

  it('parses --key value flags', () => {
    const result = parseArgs(['node', 'cli.js', 'overview', '--days-back', '30']);
    expect(result.flags).toEqual({ 'days-back': '30' });
  });

  it('parses mixed flag formats', () => {
    const result = parseArgs(['node', 'cli.js', 'conversations', '--search=error', '--limit', '5']);
    expect(result.flags).toEqual({ search: 'error', limit: '5' });
  });

  it('handles boolean flags (no value)', () => {
    const result = parseArgs(['node', 'cli.js', '--help']);
    expect(result.command).toBe('--help');
  });

  it('returns empty command for no args', () => {
    const result = parseArgs(['node', 'cli.js']);
    expect(result.command).toBe('');
  });

  it('handles positional before flags', () => {
    const result = parseArgs(['node', 'cli.js', 'context', 'conv-abc', '--window=3']);
    expect(result.command).toBe('context');
    expect(result.positional).toBe('conv-abc');
    expect(result.flags).toEqual({ window: '3' });
  });
});

describe('flagsToArgs', () => {
  it('converts kebab-case to snake_case', () => {
    const result = flagsToArgs({ 'days-back': '30', 'time-range': '7d' });
    expect(result).toEqual({ days_back: 30, time_range: '7d' });
  });

  it('parses numeric values', () => {
    const result = flagsToArgs({ limit: '10', offset: '0' });
    expect(result).toEqual({ limit: 10, offset: 0 });
  });

  it('keeps string values as strings', () => {
    const result = flagsToArgs({ search: 'error message' });
    expect(result).toEqual({ search: 'error message' });
  });

  it('includes positional key/value', () => {
    const result = flagsToArgs({ limit: '5' }, 'node_id', 'node-123');
    expect(result).toEqual({ node_id: 'node-123', limit: 5 });
  });
});

describe('CLI command dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // We test the commands by dynamically importing and calling runCommand.
  // Since runCommand is not exported, we test indirectly via the module's behavior.
  // The key thing to test is that each command constructs the correct API URL.
  // This is tested at the integration level via handlers.test.ts already.
  // Here we focus on the arg parsing + flag conversion that is unique to the CLI.

  it('overview command builds correct args from flags', () => {
    const args = flagsToArgs({ 'days-back': '14' });
    expect(args).toEqual({ days_back: 14 });
  });

  it('cluster-conversations builds args with positional node_id', () => {
    const args = flagsToArgs({ limit: '5', offset: '0' }, 'node_id', 'cluster-abc');
    expect(args).toEqual({ node_id: 'cluster-abc', limit: 5, offset: 0 });
  });

  it('conversations builds args with multiple flags', () => {
    const args = flagsToArgs({ search: 'error', 'user-id': 'user-1', 'time-range': '7d', limit: '10', offset: '0' });
    expect(args).toEqual({ search: 'error', user_id: 'user-1', time_range: '7d', limit: 10, offset: 0 });
  });

  it('context builds args with positional conversation_id', () => {
    const args = flagsToArgs({ 'msg-index': '5', window: '3' }, 'conversation_id', 'conv-xyz');
    expect(args).toEqual({ conversation_id: 'conv-xyz', msg_index: 5, window: 3 });
  });

  it('tool-failure-detail builds args with positional tool_name', () => {
    const args = flagsToArgs({ subtype: 'timeout', 'days-back': '14' }, 'tool_name', 'search');
    expect(args).toEqual({ tool_name: 'search', subtype: 'timeout', days_back: 14 });
  });

  it('offset=0 is preserved (not dropped as falsy)', () => {
    const args = flagsToArgs({ offset: '0' });
    expect(args.offset).toBe(0);
    expect(args.offset).not.toBeUndefined();
  });
});
