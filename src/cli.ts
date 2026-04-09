#!/usr/bin/env node

import { z } from 'zod';
import { validateConfig, VERSION } from './config.js';
import { callDataAPI, ApiError } from './api-client.js';
import {
  OverviewSchema,
  ClustersSchema,
  ClusterConversationsSchema,
  ConversationsSchema,
  ContextSchema,
  FrustrationsSchema,
  ToolFailuresSchema,
  ToolFailureDetailSchema,
} from './schemas.js';

// --- Argument Parsing ---

interface ParsedArgs {
  command: string;
  positional: string | undefined;
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] || '';
  const flags: Record<string, string> = {};
  let positional: string | undefined;
  let i = 1;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // --key=value
        const key = arg.slice(2, eqIndex);
        flags[key] = arg.slice(eqIndex + 1);
      } else {
        // --key value
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = 'true';
        }
      }
    } else if (positional === undefined) {
      positional = arg;
    }
    i++;
  }

  return { command, positional, flags };
}

// Convert kebab-case flags to snake_case for Zod schema compatibility
export function flagsToArgs(
  flags: Record<string, string>,
  positionalKey?: string,
  positionalValue?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (positionalKey && positionalValue) {
    result[positionalKey] = positionalValue;
  }

  for (const [key, value] of Object.entries(flags)) {
    const snakeKey = key.replace(/-/g, '_');
    // Try to parse as number for numeric fields
    const num = Number(value);
    result[snakeKey] = isNaN(num) || value === 'true' ? value : num;
  }

  return result;
}

// --- Help ---

function printHelp(): void {
  console.error(`Usage: moda <command> [options]

Commands:
  init                             Set up Moda in your project
  overview                         Dashboard overview with KPIs
  clusters                         Browse topic cluster hierarchy
  cluster-conversations <node_id>  List conversations in a cluster
  conversations                    Search and filter conversations
  context <conversation_id>        Get windowed conversation context
  frustrations                     Get user frustration detections
  tool-failures                    Get tool failure overview
  tool-failure-detail <tool_name>  Get per-tool failure detail

Options:
  --help                           Show this help message
  --version                        Show version number

Common flags:
  --days-back=N                    Number of days to look back (1-90)
  --limit=N                        Maximum results to return
  --offset=N                       Number of results to skip
  --time-range=RANGE               Time range filter (all|1h|3d|7d|24h|30d|90d)

Init flags:
  --yes                            Accept all defaults (non-interactive)
  --skip-sdk                       Skip SDK installation
  --skip-mcp                       Skip MCP server configuration

Examples:
  moda init
  moda init --yes
  moda overview
  moda overview --days-back=30
  moda clusters --time-range=7d
  moda conversations --search="error" --limit=5
  moda frustrations --days-back=14 --limit=20
  moda context <conversation_id> --window=3`);
}

// --- Command Handlers ---
// Each handler replicates the URL construction from src/handlers.ts
// but outputs JSON directly instead of wrapping in MCP envelope.

async function runCommand(command: string, positional: string | undefined, flags: Record<string, string>): Promise<void> {
  switch (command) {
    case 'overview': {
      const args = flagsToArgs(flags);
      const params = OverviewSchema.parse(args);
      const queryString = params.days_back ? `?days_back=${params.days_back}` : '';
      const data = await callDataAPI(`/overview${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'clusters': {
      const args = flagsToArgs(flags);
      const params = ClustersSchema.parse(args);
      const query = new URLSearchParams();
      if (params.parent_id) query.set('parent_id', params.parent_id);
      if (params.time_range) query.set('time_range', params.time_range);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/clusters${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'cluster-conversations': {
      if (!positional) {
        console.error('Error: <node_id> is required');
        console.error('Usage: moda cluster-conversations <node_id> [--limit=N] [--offset=N]');
        process.exit(1);
      }
      const args = flagsToArgs(flags, 'node_id', positional);
      const params = ClusterConversationsSchema.parse(args);
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset !== undefined) query.set('offset', params.offset.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/clusters/${params.node_id}/conversations${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'conversations': {
      const args = flagsToArgs(flags);
      const params = ConversationsSchema.parse(args);
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.cluster_id) query.set('cluster_id', params.cluster_id);
      if (params.user_id) query.set('user_id', params.user_id);
      if (params.time_range) query.set('time_range', params.time_range);
      if (params.environment) query.set('environment', params.environment);
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset !== undefined) query.set('offset', params.offset.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/conversations${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'context': {
      if (!positional) {
        console.error('Error: <conversation_id> is required');
        console.error('Usage: moda context <conversation_id> [--msg-index=N] [--window=N]');
        process.exit(1);
      }
      const args = flagsToArgs(flags, 'conversation_id', positional);
      const params = ContextSchema.parse(args);
      const query = new URLSearchParams();
      if (params.msg_index !== undefined) query.set('msg_index', params.msg_index.toString());
      if (params.window) query.set('window', params.window.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/conversations/${params.conversation_id}/context${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'frustrations': {
      const args = flagsToArgs(flags);
      const params = FrustrationsSchema.parse(args);
      const query = new URLSearchParams();
      if (params.days_back) query.set('days_back', params.days_back.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset !== undefined) query.set('offset', params.offset.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/frustrations${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'tool-failures': {
      const args = flagsToArgs(flags);
      const params = ToolFailuresSchema.parse(args);
      const queryString = params.days_back ? `?days_back=${params.days_back}` : '';
      const data = await callDataAPI(`/tool-failures${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'tool-failure-detail': {
      if (!positional) {
        console.error('Error: <tool_name> is required');
        console.error('Usage: moda tool-failure-detail <tool_name> [--subtype=S] [--days-back=N] [--limit=N] [--offset=N]');
        process.exit(1);
      }
      const args = flagsToArgs(flags, 'tool_name', positional);
      const params = ToolFailureDetailSchema.parse(args);
      const query = new URLSearchParams();
      if (params.subtype) query.set('subtype', params.subtype);
      if (params.days_back) query.set('days_back', params.days_back.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset !== undefined) query.set('offset', params.offset.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const data = await callDataAPI(`/tool-failures/${params.tool_name}${queryString}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    default:
      console.error(`Error: Unknown command '${command}'`);
      console.error('Run "moda --help" for usage information.');
      process.exit(1);
  }
}

// --- Main ---

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  if (command === '--version' || command === '-V' || flags.version === 'true') {
    console.log(`moda-cli ${VERSION}`);
    process.exit(0);
  }

  if (!command || command === '--help' || command === '-h' || flags.help === 'true') {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  // init does NOT require MODA_API_KEY — that's what it creates
  if (command === 'init') {
    const { runInit } = await import('./init/index.js');
    const initFlags = flagsToArgs(flags);
    await runInit(initFlags);
    return;
  }

  validateConfig();
  await runCommand(command, positional, flags);
}

// Only run main() when this file is executed directly (not when imported as a module).
// In ESM, import.meta.url is the file URL of the current module; process.argv[1] is
// the path of the entry-point script. Comparing them lets tests import parseArgs /
// flagsToArgs without triggering the CLI bootstrap.
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((error) => {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((e) => {
        const field = e.path.length ? e.path.join('.') : 'input';
        return `  ${field}: ${e.message}`;
      });
      console.error(`Validation error:\n${issues.join('\n')}`);
    } else if (error instanceof ApiError) {
      console.error(`API error (HTTP ${error.statusCode}): ${error.responseBody || error.message}`);
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  });
}
