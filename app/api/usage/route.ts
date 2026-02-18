import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers';
import { getUserQuota } from '@/lib/quota';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const quota = await getUserQuota(user.id);

    return NextResponse.json({
      emailLookups: {
        used: quota.email.used,
        limit: quota.email.limit,
        remaining: quota.email.remaining,
      },
      aiDrafts: {
        used: quota.ai_draft.used,
        limit: quota.ai_draft.limit,
        remaining: quota.ai_draft.remaining,
      },
      resetAt: quota.reset_date,
      planType: quota.plan_type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
