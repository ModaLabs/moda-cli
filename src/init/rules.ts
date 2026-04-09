// src/init/rules.ts — Agent rules file installation

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { confirm } from '@inquirer/prompts';

const MODA_RULES_CONTENT = `

## Moda SDK

Moda is integrated in this project for LLM observability. The \`moda-ai\` SDK
auto-instruments OpenAI and Anthropic calls via OpenTelemetry.

### Initialization

- TypeScript: \`import { Moda } from 'moda-ai'; await Moda.init(process.env.MODA_API_KEY!);\`
- Python: \`import moda; moda.init()\` (reads MODA_API_KEY from env)

### Conversation Tracking

Set conversation ID before LLM calls to group multi-turn conversations:
- TypeScript: \`Moda.conversationId = 'session-id';\`
- Python: \`moda.conversation_id = 'session-id'\`

### Before Exit

Flush pending traces before the process exits:
- TypeScript: \`await Moda.flush();\`
- Python: \`moda.flush()\`
`;

const AGENT_RULES_FILES: Record<string, string> = {
  'Claude Code': 'CLAUDE.md',
  'Cursor': '.cursor/rules/moda.mdc',
};

export async function installRules(
  detectedAgents: string[],
  autoYes = false,
): Promise<void> {
  const applicable = detectedAgents.filter((a) => a in AGENT_RULES_FILES);
  if (applicable.length === 0) {
    console.log('  No supported agents detected for rules files');
    return;
  }

  let shouldInstall = autoYes;
  if (!shouldInstall) {
    shouldInstall = await confirm({
      message: 'Install agent rules for coding assistants?',
      default: true,
    });
  }

  if (!shouldInstall) return;

  for (const agent of applicable) {
    const filePath = join(process.cwd(), AGENT_RULES_FILES[agent]);
    try {
      const dir = dirname(filePath);
      mkdirSync(dir, { recursive: true });

      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('## Moda SDK')) {
          console.log(`  ${agent}: Moda SDK section already exists in ${AGENT_RULES_FILES[agent]}`);
          continue;
        }
        appendFileSync(filePath, MODA_RULES_CONTENT);
      } else {
        writeFileSync(filePath, MODA_RULES_CONTENT.trimStart());
      }
      console.log(`  Added Moda SDK reference to ${AGENT_RULES_FILES[agent]}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Warning: Failed to write ${AGENT_RULES_FILES[agent]}: ${message}`);
    }
  }
}
