// src/init/mcp.ts — MCP server auto-configuration for coding agents

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { checkbox } from '@inquirer/prompts';

export interface DetectedAgent {
  name: string;
  configPath: string;
  configKey: string;
}

function isOnPath(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function detectAgents(): DetectedAgent[] {
  const cwd = process.cwd();
  const agents: DetectedAgent[] = [];

  // Claude Code
  if (existsSync(join(cwd, '.claude')) || isOnPath('claude')) {
    agents.push({
      name: 'Claude Code',
      configPath: join(cwd, '.claude', 'settings.local.json'),
      configKey: 'mcpServers',
    });
  }

  // Cursor
  if (existsSync(join(cwd, '.cursor'))) {
    agents.push({
      name: 'Cursor',
      configPath: join(cwd, '.cursor', 'mcp.json'),
      configKey: 'mcpServers',
    });
  }

  // VS Code
  if (existsSync(join(cwd, '.vscode'))) {
    agents.push({
      name: 'VS Code',
      configPath: join(cwd, '.vscode', 'mcp.json'),
      configKey: 'servers',
    });
  }

  return agents;
}

export async function configureMCP(
  agents: DetectedAgent[],
  apiKey: string,
  autoYes = false,
): Promise<string[]> {
  if (agents.length === 0) return [];

  let selected: DetectedAgent[];

  if (autoYes) {
    selected = agents;
  } else {
    const choices = agents.map((a) => ({
      name: a.name,
      value: a,
      checked: true,
    }));
    selected = await checkbox({
      message: 'Configure MCP server for:',
      choices,
    });
  }

  const configured: string[] = [];

  for (const agent of selected) {
    try {
      writeAgentConfig(agent, apiKey);
      configured.push(agent.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Warning: Failed to configure ${agent.name}: ${message}`);
    }
  }

  // Show manual instructions for skipped agents
  const skipped = agents.filter((a) => !selected.includes(a));
  if (skipped.length > 0) {
    console.log('\n  Manual setup for skipped agents:');
    for (const agent of skipped) {
      console.log(`    ${agent.name}: Add moda server to ${agent.configPath}`);
    }
  }

  return configured;
}

function writeAgentConfig(agent: DetectedAgent, apiKey: string): void {
  // Ensure directory exists
  const dir = dirname(agent.configPath);
  mkdirSync(dir, { recursive: true });

  // Read existing config
  let config: Record<string, unknown> = {};
  if (existsSync(agent.configPath)) {
    try {
      config = JSON.parse(readFileSync(agent.configPath, 'utf8'));
    } catch {
      config = {};
    }
  }

  // Merge moda server entry
  const servers = (config[agent.configKey] as Record<string, unknown>) || {};
  servers['moda'] = {
    command: 'npx',
    args: ['-y', '@moda-ai/cli'],
    env: {
      MODA_API_KEY: apiKey,
    },
  };
  config[agent.configKey] = servers;

  // Write back
  writeFileSync(agent.configPath, JSON.stringify(config, null, 2) + '\n');
}
