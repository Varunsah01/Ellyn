import { createServiceRoleClient } from '@/lib/supabase/server';

export interface PatternLearning {
  domain: string;
  pattern: string;
  successCount: number;
  totalAttempts: number;
  successRate: number;
}

/**
 * Record pattern feedback.
 * @param {string} domain - Domain input.
 * @param {string} pattern - Pattern input.
 * @param {boolean} worked - Worked input.
 * @returns {Promise<void>} Computed Promise<void>.
 * @throws {Error} If the operation fails.
 * @example
 * recordPatternFeedback('domain', 'pattern', true)
 */
export async function recordPatternFeedback(
  domain: string,
  pattern: string,
  worked: boolean
): Promise<void> {
  try {
    const supabase = await createServiceRoleClient();
    // Check if record exists
    const { data: existing } = await supabase
      .from('pattern_learning')
      .select('*')
      .eq('domain', domain)
      .eq('pattern', pattern)
      .single();

    if (existing) {
      // Update existing record
      const newSuccessCount = existing.success_count + (worked ? 1 : 0);
      const newTotalAttempts = existing.total_attempts + 1;

      await supabase
        .from('pattern_learning')
        .update({
          success_count: newSuccessCount,
          total_attempts: newTotalAttempts,
          last_success_at: worked ? new Date().toISOString() : existing.last_success_at
        })
        .eq('id', existing.id);

      console.log('[Learning] Updated pattern:', domain, pattern, `${newSuccessCount}/${newTotalAttempts}`);
    } else {
      // Create new record
      await supabase
        .from('pattern_learning')
        .insert({
          domain,
          pattern,
          success_count: worked ? 1 : 0,
          total_attempts: 1,
          last_success_at: worked ? new Date().toISOString() : null
        });

      console.log('[Learning] New pattern tracked:', domain, pattern);
    }
  } catch (error) {
    console.error('[Learning] Failed to record feedback:', error);
  }
}

/**
 * Get learned patterns.
 * @param {string} domain - Domain input.
 * @returns {Promise<PatternLearning[]>} Computed Promise<PatternLearning[]>.
 * @throws {Error} If the operation fails.
 * @example
 * getLearnedPatterns('domain')
 */
export async function getLearnedPatterns(domain: string): Promise<PatternLearning[]> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('pattern_learning')
      .select('*')
      .eq('domain', domain)
      .gte('total_attempts', 2) // Only patterns tried 2+ times
      .order('success_rate', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      domain: d.domain,
      pattern: d.pattern,
      successCount: d.success_count,
      totalAttempts: d.total_attempts,
      successRate: parseFloat(d.success_rate)
    }));
  } catch (error) {
    console.error('[Learning] Failed to get learned patterns:', error);
    return [];
  }
}

/**
 * Apply learning.
 * @param {any[]} patterns - Patterns input.
 * @param {PatternLearning[]} learnedPatterns - Learned patterns input.
 * @returns {any[]} Computed any[].
 * @example
 * applyLearning([], [])
 */
export function applyLearning(
  patterns: any[],
  learnedPatterns: PatternLearning[]
): any[] {
  if (learnedPatterns.length === 0) return patterns;

  return patterns.map(p => {
    const learned = learnedPatterns.find(l => l.pattern === p.pattern);

    if (learned && learned.totalAttempts >= 3) {
      // Apply learning boost
      // If success rate is 100%, boost by +25
      // If success rate is 50%, no change (neutral)
      // If success rate is 0%, reduce by -25
      const boost = (learned.successRate - 50) / 2; // -25 to +25
      const newConfidence = Math.max(5, Math.min(95, p.confidence + boost));

      return {
        ...p,
        confidence: Math.round(newConfidence),
        learned: true,
        learnedData: {
          attempts: learned.totalAttempts,
          successRate: learned.successRate
        }
      };
    }

    return p;
  }).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get top performing patterns.
 * @param {number} limit - Limit input.
 * @returns {Promise<PatternLearning[]>} Computed Promise<PatternLearning[]>.
 * @throws {Error} If the operation fails.
 * @example
 * getTopPerformingPatterns(0)
 */
export async function getTopPerformingPatterns(limit: number = 10): Promise<PatternLearning[]> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('pattern_learning')
      .select('*')
      .gte('total_attempts', 5) // Only patterns with 5+ attempts
      .order('success_rate', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(d => ({
      domain: d.domain,
      pattern: d.pattern,
      successCount: d.success_count,
      totalAttempts: d.total_attempts,
      successRate: parseFloat(d.success_rate)
    }));
  } catch (error) {
    console.error('[Learning] Failed to get top patterns:', error);
    return [];
  }
}

/**
 * Get domain statistics.
 * @param {string} domain - Domain input.
 * @returns {Promise<{
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
  bestPattern: string | null;
}>} Computed Promise<{ totalAttempts: number; successfulAttempts: number; successRate: number; bestPattern: string | null; }>.
 * @throws {Error} If the operation fails.
 * @example
 * getDomainStatistics('domain')
 */
export async function getDomainStatistics(domain: string): Promise<{
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
  bestPattern: string | null;
}> {
  try {
    const patterns = await getLearnedPatterns(domain);

    if (patterns.length === 0) {
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        successRate: 0,
        bestPattern: null
      };
    }

    const totalAttempts = patterns.reduce((sum, p) => sum + p.totalAttempts, 0);
    const successfulAttempts = patterns.reduce((sum, p) => sum + p.successCount, 0);
    const successRate = (successfulAttempts / totalAttempts) * 100;
    const bestPattern = patterns[0]?.pattern || null;

    return {
      totalAttempts,
      successfulAttempts,
      successRate: Math.round(successRate * 100) / 100,
      bestPattern
    };
  } catch (error) {
    console.error('[Learning] Failed to get domain statistics:', error);
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      successRate: 0,
      bestPattern: null
    };
  }
}
