/**
 * Pattern Learning Cache System
 * Learns which email patterns work for specific companies
 * Stores user feedback to improve future predictions
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface LearnedPattern {
  id: string;
  company_domain: string;
  pattern: string; // e.g., 'first.last', 'first', 'flast'
  success_count: number;
  failure_count: number;
  confidence_boost: number; // How much to boost this pattern for this company
  last_verified: string;
  created_at: string;
  updated_at: string;
}

export interface PatternFeedback {
  email: string;
  pattern: string;
  company_domain: string;
  worked: boolean;
  contact_id?: string;
}

/**
 * Record user feedback on whether an email pattern worked
 */
export async function recordPatternFeedback(
  feedback: PatternFeedback
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    const { company_domain, pattern, worked } = feedback;

    // Get existing pattern data
    const { data: existing, error: fetchError } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('company_domain', company_domain)
      .eq('pattern', pattern)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (isMissingDbObjectError(fetchError)) {
        console.warn('[Pattern Learning] learned_patterns table is missing; feedback accepted without persistence.');
        return { success: true };
      }
      // PGRST116 = not found, which is OK
      console.error('Error fetching pattern:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Calculate new counts and confidence boost
    let successCount = worked ? 1 : 0;
    let failureCount = worked ? 0 : 1;

    if (existing) {
      successCount += existing.success_count;
      failureCount += existing.failure_count;
    }

    // Calculate confidence boost based on success rate
    // Success rate = successes / (successes + failures)
    const totalAttempts = successCount + failureCount;
    const successRate = successCount / totalAttempts;

    // Boost ranges from -30 (0% success) to +30 (100% success)
    // Only apply boost if we have at least 2 data points
    let confidenceBoost = 0;
    if (totalAttempts >= 2) {
      confidenceBoost = Math.round((successRate - 0.5) * 60);
    }

    // Upsert the pattern
    const { error: upsertError } = await supabase
      .from('learned_patterns')
      .upsert(
        {
          company_domain,
          pattern,
          success_count: successCount,
          failure_count: failureCount,
          confidence_boost: confidenceBoost,
          last_verified: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'company_domain,pattern',
        }
      );

    if (upsertError) {
      if (isMissingDbObjectError(upsertError)) {
        console.warn('[Pattern Learning] learned_patterns table is missing; feedback accepted without persistence.');
        return { success: true };
      }
      console.error('Error upserting pattern:', upsertError);
      return { success: false, error: upsertError.message };
    }

    // Log the feedback for analytics
    const { error: feedbackLogError } = await supabase.from('pattern_feedback_log').insert({
      email: feedback.email,
      pattern,
      company_domain,
      worked,
      contact_id: feedback.contact_id,
      created_at: new Date().toISOString(),
    });

    if (feedbackLogError && !isMissingDbObjectError(feedbackLogError)) {
      console.warn('[Pattern Learning] Could not write pattern_feedback_log entry:', feedbackLogError.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error recording pattern feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get learned patterns for a specific company domain
 * Returns patterns sorted by confidence boost (highest first)
 */
export async function getLearnedPatterns(
  companyDomain: string
): Promise<LearnedPattern[]> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('company_domain', companyDomain)
      .order('confidence_boost', { ascending: false });

    if (error) {
      console.error('Error fetching learned patterns:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getLearnedPatterns:', error);
    return [];
  }
}

/**
 * Apply learned pattern boosts to email pattern list
 */
export function applyLearnedBoosts(
  patterns: Array<{ email: string; pattern: string; confidence: number }>,
  learnedPatterns: LearnedPattern[]
): Array<{ email: string; pattern: string; confidence: number; learned?: boolean }> {
  if (!learnedPatterns || learnedPatterns.length === 0) {
    return patterns;
  }

  // Create a map of pattern -> confidence boost
  const boostMap = new Map<string, number>();
  learnedPatterns.forEach(lp => {
    boostMap.set(lp.pattern, lp.confidence_boost);
  });

  // Apply boosts and mark learned patterns
  const boostedPatterns = patterns.map(p => {
    const boost = boostMap.get(p.pattern) || 0;
    return {
      ...p,
      confidence: Math.min(95, Math.max(5, p.confidence + boost)),
      learned: boost !== 0,
    };
  });

  // Re-sort by confidence
  boostedPatterns.sort((a, b) => b.confidence - a.confidence);

  return boostedPatterns;
}

/**
 * Get pattern statistics for a company
 * Returns aggregate data about which patterns work best
 */
export async function getCompanyPatternStats(
  companyDomain: string
): Promise<{
  totalAttempts: number;
  successRate: number;
  bestPattern: string | null;
  patterns: Array<{ pattern: string; successRate: number; attempts: number }>;
}> {
  try {
    const learned = await getLearnedPatterns(companyDomain);

    if (!learned || learned.length === 0) {
      return {
        totalAttempts: 0,
        successRate: 0,
        bestPattern: null,
        patterns: [],
      };
    }

    // Calculate aggregate stats
    let totalSuccesses = 0;
    let totalFailures = 0;

    const patternStats = learned.map(lp => {
      const attempts = lp.success_count + lp.failure_count;
      const successRate = attempts > 0 ? lp.success_count / attempts : 0;

      totalSuccesses += lp.success_count;
      totalFailures += lp.failure_count;

      return {
        pattern: lp.pattern,
        successRate,
        attempts,
      };
    });

    // Sort by success rate
    patternStats.sort((a, b) => b.successRate - a.successRate);

    const totalAttempts = totalSuccesses + totalFailures;
    const overallSuccessRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;
    const bestPattern = patternStats[0]?.pattern || null;

    return {
      totalAttempts,
      successRate: overallSuccessRate,
      bestPattern,
      patterns: patternStats,
    };
  } catch (error) {
    console.error('Error getting company pattern stats:', error);
    return {
      totalAttempts: 0,
      successRate: 0,
      bestPattern: null,
      patterns: [],
    };
  }
}

/**
 * Get top performing patterns across all companies
 * Useful for understanding global pattern trends
 */
export async function getGlobalPatternStats(): Promise<
  Array<{
    pattern: string;
    totalAttempts: number;
    successRate: number;
    companyCount: number;
  }>
> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('learned_patterns')
      .select('pattern, success_count, failure_count, company_domain');

    if (error) {
      console.error('Error fetching global pattern stats:', error);
      return [];
    }

    // Aggregate by pattern
    const patternMap = new Map<
      string,
      { successes: number; failures: number; companies: Set<string> }
    >();

    data?.forEach(record => {
      if (!patternMap.has(record.pattern)) {
        patternMap.set(record.pattern, {
          successes: 0,
          failures: 0,
          companies: new Set(),
        });
      }

      const stats = patternMap.get(record.pattern)!;
      stats.successes += record.success_count;
      stats.failures += record.failure_count;
      stats.companies.add(record.company_domain);
    });

    // Convert to array and calculate stats
    const results = Array.from(patternMap.entries()).map(([pattern, stats]) => {
      const totalAttempts = stats.successes + stats.failures;
      const successRate = totalAttempts > 0 ? stats.successes / totalAttempts : 0;

      return {
        pattern,
        totalAttempts,
        successRate,
        companyCount: stats.companies.size,
      };
    });

    // Sort by success rate (with minimum attempts threshold)
    results.sort((a, b) => {
      // Prefer patterns with more data
      if (a.totalAttempts < 5 && b.totalAttempts >= 5) return 1;
      if (b.totalAttempts < 5 && a.totalAttempts >= 5) return -1;

      // Otherwise sort by success rate
      return b.successRate - a.successRate;
    });

    return results;
  } catch (error) {
    console.error('Error getting global pattern stats:', error);
    return [];
  }
}

/**
 * Clear learned patterns for a company (admin function)
 */
export async function clearCompanyPatterns(
  companyDomain: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase
      .from('learned_patterns')
      .delete()
      .eq('company_domain', companyDomain);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === '42P01' || code === 'PGRST202' || code === '42883';
}
