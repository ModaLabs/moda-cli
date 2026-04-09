// src/init/tenant.ts — Tenant selection and API key provisioning

import { select } from '@inquirer/prompts';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { authFetch } from '../auth.js';

interface CliContext {
  user: { email: string; name: string | null };
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

interface BootstrapResult {
  apiKey: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export async function selectTenantAndCreateKey(): Promise<BootstrapResult> {
  // 1. Fetch CLI context
  const contextRes = await authFetch('/api/cli/context');
  if (!contextRes.ok) {
    const body = await contextRes.text();
    throw new Error(`Failed to fetch context (${contextRes.status}): ${body}`);
  }
  const ctx = (await contextRes.json()) as CliContext;
  console.log(`  Authenticated as ${ctx.user.email}`);

  // 2. Select tenant
  if (ctx.tenants.length === 0) {
    console.error('  No organizations found. Create one at https://app.modaflows.com');
    process.exit(1);
  }

  let tenantId: string;
  if (ctx.tenants.length === 1) {
    tenantId = ctx.tenants[0].id;
    console.log(`  Organization: ${ctx.tenants[0].name}`);
  } else {
    tenantId = await select({
      message: 'Select organization',
      choices: ctx.tenants.map((t) => ({
        name: `${t.name} (${t.role})`,
        value: t.id,
      })),
    });
  }

  // 3. Create API key via bootstrap endpoint
  const bootstrapRes = await authFetch('/api/cli/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  });

  if (bootstrapRes.status === 403) {
    console.error('  Error: You need admin or owner access to create API keys.');
    console.error('  Ask your organization owner to upgrade your role.');
    process.exit(1);
  }

  if (!bootstrapRes.ok) {
    const body = await bootstrapRes.text();
    throw new Error(`Failed to create API key (${bootstrapRes.status}): ${body}`);
  }

  const result = (await bootstrapRes.json()) as BootstrapResult;

  // 4. Write .env
  writeEnvFile(result.apiKey);

  // 5. Update .gitignore
  ensureGitignore();

  console.log('  API key created and saved to .env');
  return result;
}

function writeEnvFile(apiKey: string): void {
  const envPath = join(process.cwd(), '.env');
  const line = `MODA_API_KEY=${apiKey}`;

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    if (content.includes('MODA_API_KEY=')) {
      // Replace existing line
      const updated = content.replace(/^MODA_API_KEY=.*$/m, line);
      writeFileSync(envPath, updated);
    } else {
      // Append
      const separator = content.endsWith('\n') ? '' : '\n';
      appendFileSync(envPath, `${separator}${line}\n`);
    }
  } else {
    writeFileSync(envPath, `${line}\n`);
  }
}

function ensureGitignore(): void {
  const gitignorePath = join(process.cwd(), '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map((l) => l.trim());
    if (!lines.includes('.env')) {
      const separator = content.endsWith('\n') ? '' : '\n';
      appendFileSync(gitignorePath, `${separator}.env\n`);
    }
  } else {
    writeFileSync(gitignorePath, '.env\n');
  }
}
