/**
 * End-to-end test for the /api/templates CRUD flow.
 *
 * Run with:
 *   npx tsx scripts/test-templates.ts
 *
 * Required env vars (copy from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_USER_EMAIL      — a real account in your Supabase project
 *   TEST_USER_PASSWORD
 *   TEST_BASE_URL        — defaults to http://localhost:3000
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? '';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

let token = '';
let passCount = 0;
let failCount = 0;

function pass(label: string, detail?: string) {
  passCount++;
  console.log(`  ✓  ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail?: string) {
  failCount++;
  console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function step1_signIn() {
  console.log('\nStep 1 — Sign in');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('Supabase env vars missing', 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    fail('Test credentials missing', 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error || !data.session) {
    fail('Sign in', error?.message ?? 'No session returned');
    process.exit(1);
  }

  token = data.session.access_token;
  pass('Sign in', `user=${data.user.email}`);
}

async function step2_getDefaults() {
  console.log('\nStep 2 — GET /api/v1/templates (should seed 4 defaults for new user)');

  const { status, data } = await api('GET', '/api/v1/templates') as {
    status: number;
    data: { success?: boolean; templates?: { id: string; name: string; is_default: boolean }[] };
  };

  if (status !== 200) {
    fail('GET /api/v1/templates', `status=${status}, body=${JSON.stringify(data)}`);
    return null;
  }

  const templates = (data as any).templates ?? [];

  if ((data as any).success !== true) {
    fail('Response has success:true', `got ${JSON.stringify(data)}`);
  } else {
    pass('Response has success:true');
  }

  if (templates.length >= 4) {
    pass(`At least 4 templates returned`, `count=${templates.length}`);
  } else {
    fail(`Expected >=4 templates`, `got ${templates.length}`);
  }

  const defaultCount = templates.filter((t: any) => t.is_default).length;
  if (defaultCount >= 4) {
    pass(`At least 4 have is_default=true`, `count=${defaultCount}`);
  } else {
    fail(`Expected >=4 default templates`, `got ${defaultCount}`);
  }

  // Return first default template id for later use
  return templates.find((t: any) => t.is_default) ?? null;
}

async function step3_createTemplate() {
  console.log('\nStep 3 — POST /api/v1/templates');

  const { status, data } = await api('POST', '/api/v1/templates', {
    name: 'Test Template',
    subject: 'Test Subject',
    body: 'Test body content',
  }) as { status: number; data: any };

  if (status !== 201) {
    fail('POST /api/v1/templates', `status=${status}, body=${JSON.stringify(data)}`);
    return null;
  }

  if (data.success !== true) {
    fail('Response has success:true', JSON.stringify(data));
    return null;
  }
  pass('Response has success:true');

  const t = data.template;
  if (!t?.id) {
    fail('Response has template.id', JSON.stringify(t));
    return null;
  }
  pass('Response has template.id', t.id);

  if (t.name === 'Test Template') {
    pass('template.name is correct');
  } else {
    fail('template.name', `expected "Test Template", got "${t.name}"`);
  }

  if (t.is_default === false) {
    pass('template.is_default=false (user template)');
  } else {
    fail('template.is_default should be false', `got ${t.is_default}`);
  }

  return t.id as string;
}

async function step4_patchTemplate(id: string) {
  console.log('\nStep 4 — PATCH /api/v1/templates/' + id);

  const { status, data } = await api('PATCH', `/api/v1/templates/${id}`, {
    name: 'Updated Template',
  }) as { status: number; data: any };

  if (status !== 200) {
    fail('PATCH /api/v1/templates/:id', `status=${status}, body=${JSON.stringify(data)}`);
    return;
  }

  if (data.success !== true) {
    fail('Response has success:true', JSON.stringify(data));
    return;
  }
  pass('Response has success:true');

  if (data.template?.name === 'Updated Template') {
    pass('template.name updated correctly');
  } else {
    fail('template.name', `expected "Updated Template", got "${data.template?.name}"`);
  }
}

async function step5_deleteTemplate(id: string) {
  console.log('\nStep 5 — DELETE /api/v1/templates/' + id);

  const { status, data } = await api('DELETE', `/api/v1/templates/${id}`) as {
    status: number;
    data: any;
  };

  if (status !== 200) {
    fail('DELETE /api/v1/templates/:id', `status=${status}, body=${JSON.stringify(data)}`);
    return;
  }

  if (data.success === true) {
    pass('DELETE returned success:true');
  } else {
    fail('DELETE response', JSON.stringify(data));
  }
}

async function step6_deleteDefaultFails(defaultTemplateId: string) {
  console.log('\nStep 6 — DELETE a default template (expect 403)');

  const { status, data } = await api('DELETE', `/api/v1/templates/${defaultTemplateId}`) as {
    status: number;
    data: any;
  };

  if (status === 403) {
    pass('DELETE default template → 403 Forbidden');
    if ((data as any).error?.includes('cannot be deleted')) {
      pass('Error message is correct', (data as any).error);
    } else {
      fail('Error message', `expected "cannot be deleted", got "${(data as any).error}"`);
    }
  } else {
    fail('DELETE default template', `expected 403, got ${status}: ${JSON.stringify(data)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Template API end-to-end test');
  console.log(`  ${BASE_URL}`);
  console.log('─'.repeat(60));

  await step1_signIn();

  const defaultTemplate = await step2_getDefaults();
  const newId = await step3_createTemplate();

  if (newId) {
    await step4_patchTemplate(newId);
    await step5_deleteTemplate(newId);
  } else {
    fail('Steps 4 & 5 skipped', 'POST failed to return an id');
  }

  if (defaultTemplate?.id) {
    await step6_deleteDefaultFails(defaultTemplate.id);
  } else {
    fail('Step 6 skipped', 'No default template id available');
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${passCount} passed  /  ${failCount} failed`);
  console.log(`${'─'.repeat(60)}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
