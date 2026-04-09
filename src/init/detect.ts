// src/init/detect.ts — Project detection and SDK installation

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { select } from '@inquirer/prompts';

export interface ProjectInfo {
  language: 'typescript' | 'python' | null;
  packageManager: string | null;
  llmProviders: string[];
}

const LOCKFILE_TO_PM: Record<string, string> = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
  'poetry.lock': 'poetry',
  'uv.lock': 'uv',
};

const INSTALL_COMMANDS: Record<string, string> = {
  npm: 'npm install moda-ai',
  yarn: 'yarn add moda-ai',
  pnpm: 'pnpm add moda-ai',
  bun: 'bun add moda-ai',
  pip: 'pip install moda-ai',
  poetry: 'poetry add moda-ai',
  uv: 'uv add moda-ai',
};

const LLM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /from openai|import openai|require\(['"]openai['"]\)/i, name: 'OpenAI' },
  { pattern: /from anthropic|import.*@anthropic-ai\/sdk|require\(['"]@anthropic-ai\/sdk['"]\)/i, name: 'Anthropic' },
  { pattern: /from ai |import.*@ai-sdk|require\(['"](ai|@ai-sdk)/i, name: 'Vercel AI SDK' },
  { pattern: /from langchain|import.*langchain/i, name: 'LangChain' },
  { pattern: /from claude_agent_sdk|import.*claude.agent/i, name: 'Claude Agent SDK' },
];

export async function detectProject(): Promise<ProjectInfo> {
  const cwd = process.cwd();
  const hasPackageJson = existsSync(join(cwd, 'package.json'));
  const hasPython =
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'requirements.txt')) ||
    existsSync(join(cwd, 'Pipfile'));

  let language: ProjectInfo['language'] = null;

  if (hasPackageJson && hasPython) {
    language = await select({
      message: 'Both TypeScript and Python detected. Which to configure?',
      choices: [
        { name: 'TypeScript / JavaScript', value: 'typescript' as const },
        { name: 'Python', value: 'python' as const },
      ],
    });
  } else if (hasPackageJson) {
    language = 'typescript';
  } else if (hasPython) {
    language = 'python';
  }

  // Detect package manager
  let packageManager: string | null = null;
  if (language === 'typescript') {
    for (const [lockfile, pm] of Object.entries(LOCKFILE_TO_PM)) {
      if (existsSync(join(cwd, lockfile))) {
        packageManager = pm;
        break;
      }
    }
    if (!packageManager) packageManager = 'npm';
  } else if (language === 'python') {
    if (existsSync(join(cwd, 'poetry.lock'))) {
      packageManager = 'poetry';
    } else if (existsSync(join(cwd, 'uv.lock'))) {
      packageManager = 'uv';
    } else {
      packageManager = 'pip';
    }
  }

  // Detect LLM providers (shallow scan)
  const llmProviders = detectLLMProviders(cwd, language);

  return { language, packageManager, llmProviders };
}

function detectLLMProviders(
  cwd: string,
  language: 'typescript' | 'python' | null,
): string[] {
  if (!language) return [];

  const providers = new Set<string>();
  const extensions = language === 'typescript' ? ['.ts', '.tsx', '.js', '.jsx', '.mjs'] : ['.py'];
  const dirs = ['src', 'app', 'lib', '.'];

  for (const dir of dirs) {
    const dirPath = join(cwd, dir);
    if (!existsSync(dirPath)) continue;

    try {
      const files = readdirSync(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        if (!extensions.some((ext) => file.name.endsWith(ext))) continue;

        try {
          const content = readFileSync(join(dirPath, file.name), 'utf8');
          for (const { pattern, name } of LLM_PATTERNS) {
            if (pattern.test(content)) {
              providers.add(name);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Skip unreadable dirs
    }
  }

  return Array.from(providers);
}

export async function installSDK(project: ProjectInfo): Promise<void> {
  if (!project.packageManager) return;

  const command = INSTALL_COMMANDS[project.packageManager];
  if (!command) return;

  console.log(`  Installing moda-ai (${project.packageManager})...`);
  try {
    execSync(command, { cwd: process.cwd(), stdio: 'pipe' });
    console.log('  Installed moda-ai');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Warning: SDK install failed: ${message}`);
    console.error(`  Run manually: ${command}`);
  }
}

export function getInitSnippet(project: ProjectInfo): string {
  if (project.language === 'typescript') {
    return `
    import { Moda } from 'moda-ai';

    await Moda.init(process.env.MODA_API_KEY!);
    // Moda.conversationId = 'your-session-id';
    // ... your LLM calls are auto-instrumented ...
    await Moda.flush();
`;
  }

  if (project.language === 'python') {
    return `
    import moda

    moda.init()  # reads MODA_API_KEY from env
    # moda.conversation_id = 'your-session-id'
    # ... your LLM calls are auto-instrumented ...
    moda.flush()
`;
  }

  return '';
}
