// Shared setup for the local test scripts (security audit + app flow).
// Reads the project URL from .env and the service-role key from the
// SUPABASE_SERVICE_ROLE_KEY environment variable. The service key is NEVER
// read from a file and NEVER written anywhere — paste it into your shell
// for the run only:
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "..."; npm run audit:security
//   bash:        SUPABASE_SERVICE_ROLE_KEY="..." npm run audit:security
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..', '..');

function parseEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = parseEnvFile(join(projectRoot, '.env'));

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL;
export const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_KEY;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function requireConfig({ needService } = {}) {
  const missing = [];
  if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL (in .env)');
  if (!ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_KEY (in .env)');
  if (needService && !SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (environment variable, not a file)');
  }
  if (missing.length) {
    console.error('\nMissing configuration:\n  - ' + missing.join('\n  - '));
    console.error(
      '\nGet the service-role key from the Supabase dashboard:' +
        '\n  Project Settings > API > Project API keys > service_role (secret).' +
        '\nThen run, e.g. in PowerShell:' +
        '\n  $env:SUPABASE_SERVICE_ROLE_KEY = "<the key>"; npm run audit:security\n'
    );
    process.exit(2);
  }
}

// Short, unique, obviously-fake identities so leftover rows are easy to spot.
export function makeTestEmail(tag) {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `goalguess.test+${tag}.${stamp}@example.com`;
}

export const TEST_PASSWORD = 'Test!' + Math.random().toString(36).slice(2, 10) + 'Aa1';
