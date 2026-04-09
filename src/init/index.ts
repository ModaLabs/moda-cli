// src/init/index.ts — Full moda init wizard orchestrator

import { login, loadToken } from '../auth.js';
import { selectTenantAndCreateKey } from './tenant.js';
import { detectProject, installSDK, getInitSnippet } from './detect.js';
import { detectAgents, configureMCP } from './mcp.js';
import { installRules } from './rules.js';

export async function runInit(flags: Record<string, unknown>): Promise<void> {
  const yes = flags.yes === true || flags.y === true;
  const skipSdk = flags.skip_sdk === true;
  const skipMcp = flags.skip_mcp === true;

  console.log('\n  Moda — LLM Observability for Agents\n');

  // Step 1: Authentication
  console.log('  Step 1/5: Authentication');
  let token = loadToken();
  if (!token) {
    console.log('  Opening browser for login...');
    token = await login();
    console.log('  Login successful');
  } else {
    console.log('  Already authenticated (cached token)');
  }

  // Step 2: Tenant + API Key
  console.log('\n  Step 2/5: Select Organization');
  const { apiKey, tenantName } = await selectTenantAndCreateKey();

  // Step 3: SDK
  if (!skipSdk) {
    console.log('\n  Step 3/5: Install SDK');
    const project = await detectProject();
    if (project.language) {
      const parts: string[] = [project.language];
      if (project.packageManager) parts.push(project.packageManager);
      if (project.llmProviders.length > 0) {
        parts.push(project.llmProviders.join(', '));
      }
      console.log(`  Detected: ${parts.join(' / ')}`);

      await installSDK(project);

      const snippet = getInitSnippet(project);
      if (snippet) {
        console.log('\n  Add this to your entry file:');
        console.log(snippet);
      }
    } else {
      console.log('  No project detected, skipping SDK installation');
      console.log('  Install manually: npm install moda-ai (or pip install moda-ai)');
    }
  } else {
    console.log('\n  Step 3/5: Install SDK (skipped)');
  }

  // Step 4: MCP
  if (!skipMcp) {
    console.log('\n  Step 4/5: Configure MCP Server');
    const agents = detectAgents();
    if (agents.length > 0) {
      console.log(`  Detected: ${agents.map((a) => a.name).join(', ')}`);
      const configured = await configureMCP(agents, apiKey, yes);
      if (configured.length > 0) {
        console.log(`  Configured ${configured.length} agent(s): ${configured.join(', ')}`);
      }
    } else {
      console.log('  No coding agents detected');
      console.log('  Manual setup: claude mcp add moda -- npx -y @moda-ai/cli');
    }
  } else {
    console.log('\n  Step 4/5: Configure MCP Server (skipped)');
  }

  // Step 5: Rules
  console.log('\n  Step 5/5: Agent Rules (optional)');
  const agentNames = detectAgents().map((a) => a.name);
  if (agentNames.length > 0) {
    await installRules(agentNames, yes);
  } else {
    console.log('  Skipped (no agents detected)');
  }

  // Done
  console.log(`\n  Setup complete for ${tenantName}!`);
  console.log('  Dashboard: https://app.modaflows.com');
  console.log('');
}
