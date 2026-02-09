// Analytics Insights Engine
// Analyzes patterns and provides actionable suggestions

class AnalyticsInsights {
  constructor() {
    this.minDataPoints = 5; // Minimum emails to show insights
  }

  /**
   * Generate all insights
   */
  async generateInsights() {
    const summary = await analyticsTracker.getSummary();
    const history = await analyticsTracker.getHistory();

    if (history.length < this.minDataPoints) {
      return [{
        icon: '📊',
        type: 'info',
        message: `Send ${this.minDataPoints - history.length} more emails to unlock personalized insights`,
        action: null,
        priority: 1
      }];
    }

    const insights = [];

    // Response rate insights
    const responseInsights = await this.analyzeResponseRate(summary);
    insights.push(...responseInsights);

    // Template performance
    const templateInsights = await this.analyzeTemplates();
    insights.push(...templateInsights);

    // Email length insights
    const lengthInsights = await this.analyzeEmailLength(summary);
    insights.push(...lengthInsights);

    // Send timing insights
    const timingInsights = await this.analyzeTiming();
    insights.push(...timingInsights);

    // Personalization insights
    const personalizationInsights = await this.analyzePersonalization();
    insights.push(...personalizationInsights);

    // AI usage insights
    const aiInsights = await this.analyzeAIUsage(summary);
    insights.push(...aiInsights);

    // Sort by priority (higher = more important)
    insights.sort((a, b) => b.priority - a.priority);

    return insights.slice(0, 5); // Top 5 insights
  }

  /**
   * Analyze response rate
   */
  async analyzeResponseRate(summary) {
    const insights = [];
    const rate = summary.responseRate;

    if (rate < 20) {
      insights.push({
        icon: '📝',
        type: 'warning',
        message: `Your ${rate}% response rate is below average. Try personalizing more - mention shared connections or interests.`,
        action: 'Learn how',
        actionLink: '#personalization-tips',
        priority: 10
      });
    } else if (rate >= 20 && rate < 35) {
      insights.push({
        icon: '📈',
        type: 'info',
        message: `Your ${rate}% response rate is good! Keep personalizing and you can reach 40%+.`,
        action: 'See tips',
        actionLink: '#improvement-tips',
        priority: 5
      });
    } else if (rate >= 35) {
      insights.push({
        icon: '🎉',
        type: 'success',
        message: `Amazing ${rate}% response rate! You're in the top 10% of recruiters.`,
        action: null,
        priority: 8
      });
    }

    // Week over week
    if (summary.thisWeek.sent >= 5) {
      const weekRate = parseFloat(summary.thisWeek.responseRate);
      const overallRate = summary.responseRate;

      if (weekRate > overallRate + 5) {
        insights.push({
          icon: '🚀',
          type: 'success',
          message: `You're on fire this week! ${weekRate}% response rate vs ${overallRate}% overall.`,
          action: null,
          priority: 7
        });
      }
    }

    return insights;
  }

  /**
   * Analyze template performance
   */
  async analyzeTemplates() {
    const insights = [];
    const templates = await analyticsTracker.getTemplatePerformance();

    // Find best and worst templates (with at least 3 sends)
    const qualified = Object.entries(templates).filter(([_, stats]) => stats.sent >= 3);

    if (qualified.length === 0) return insights;

    // Sort by response rate
    qualified.sort((a, b) => parseFloat(b[1].rate) - parseFloat(a[1].rate));

    const best = qualified[0];
    const worst = qualified[qualified.length - 1];

    if (best && parseFloat(best[1].rate) > 30) {
      insights.push({
        icon: '🎯',
        type: 'success',
        message: `Your "${best[0]}" template has a ${best[1].rate}% response rate - use it more!`,
        action: 'Use template',
        actionLink: '#template-' + best[0].toLowerCase().replace(/\s+/g, '-'),
        priority: 9
      });
    }

    if (worst && qualified.length > 1 && parseFloat(worst[1].rate) < 15) {
      insights.push({
        icon: '⚠️',
        type: 'warning',
        message: `Your "${worst[0]}" template only has ${worst[1].rate}% response rate. Consider revising it.`,
        action: 'Edit template',
        actionLink: '#template-' + worst[0].toLowerCase().replace(/\s+/g, '-'),
        priority: 6
      });
    }

    return insights;
  }

  /**
   * Analyze email length
   */
  async analyzeEmailLength(summary) {
    const insights = [];
    const avgWords = summary.avgWordCount;

    if (avgWords > 150) {
      insights.push({
        icon: '✂️',
        type: 'warning',
        message: `Your emails average ${avgWords} words. Shorter emails (<100 words) get 30% better responses.`,
        action: 'See examples',
        actionLink: '#short-email-examples',
        priority: 8
      });
    } else if (avgWords < 50) {
      insights.push({
        icon: '📝',
        type: 'info',
        message: `Your emails average ${avgWords} words. That's good, but make sure you're including enough context.`,
        action: null,
        priority: 4
      });
    } else {
      insights.push({
        icon: '✅',
        type: 'success',
        message: `Perfect! Your ${avgWords}-word average is in the sweet spot for response rates.`,
        action: null,
        priority: 3
      });
    }

    return insights;
  }

  /**
   * Analyze send timing
   */
  async analyzeTiming() {
    const insights = [];
    const bestTimes = await analyticsTracker.getBestSendTimes();

    if (!bestTimes) return insights;

    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    insights.push({
      icon: '⏰',
      type: 'info',
      message: `Your best response time is ${bestTimes.bestDay}s at ${bestTimes.bestHourFormatted}. Try sending then!`,
      action: null,
      priority: 6
    });

    // Check if current time is a good time
    if (dayNames[currentDay] === bestTimes.bestDay &&
        Math.abs(currentHour - bestTimes.bestHour) <= 2) {
      insights.push({
        icon: '🎯',
        type: 'success',
        message: `Perfect timing! This is one of your best response windows. Send those emails now!`,
        action: null,
        priority: 10
      });
    }

    return insights;
  }

  /**
   * Analyze personalization
   */
  async analyzePersonalization() {
    const insights = [];
    const history = await analyticsTracker.getHistory();

    const withIcebreaker = history.filter(e => e.hasIcebreaker);
    const responded = history.filter(e => e.status === 'responded');
    const respondedWithIcebreaker = withIcebreaker.filter(e => e.status === 'responded');

    if (withIcebreaker.length >= 5 && responded.length >= 3) {
      const icebreakerRate = (respondedWithIcebreaker.length / withIcebreaker.length) * 100;
      const overallRate = (responded.length / history.length) * 100;

      if (icebreakerRate > overallRate + 10) {
        insights.push({
          icon: '💡',
          type: 'success',
          message: `Emails with personalized icebreakers get ${Math.round(icebreakerRate - overallRate)}% better responses!`,
          action: 'Use icebreakers',
          actionLink: '#icebreaker-tips',
          priority: 9
        });
      }
    }

    // Check personalization score
    const avgPersonalization = history.reduce((sum, e) => sum + (e.personalizationScore || 0), 0) / history.length;

    if (avgPersonalization < 50) {
      insights.push({
        icon: '🎨',
        type: 'warning',
        message: `Your emails could be more personalized. Mention shared connections, schools, or interests.`,
        action: 'Learn more',
        actionLink: '#personalization-guide',
        priority: 7
      });
    }

    return insights;
  }

  /**
   * Analyze AI usage
   */
  async analyzeAIUsage(summary) {
    const insights = [];
    const stats = await analyticsTracker.getStats();

    // Cost insights
    const avgCost = parseFloat(summary.avgCostPerEmail);
    const totalCost = parseFloat(summary.totalAICost);

    if (stats.totalSent >= 10) {
      insights.push({
        icon: '💰',
        type: 'info',
        message: `AI drafts cost you $${totalCost} total ($${avgCost.toFixed(3)} per email). That's ${(avgCost * 1000).toFixed(1)}¢ per 1000 words!`,
        action: null,
        priority: 2
      });
    }

    // Compare AI vs manual performance
    const history = await analyticsTracker.getHistory();
    const aiEmails = history.filter(e => e.isAI);
    const manualEmails = history.filter(e => !e.isAI);

    if (aiEmails.length >= 5 && manualEmails.length >= 5) {
      const aiRate = (aiEmails.filter(e => e.status === 'responded').length / aiEmails.length) * 100;
      const manualRate = (manualEmails.filter(e => e.status === 'responded').length / manualEmails.length) * 100;

      if (aiRate > manualRate + 5) {
        insights.push({
          icon: '🤖',
          type: 'success',
          message: `AI-generated emails get ${Math.round(aiRate - manualRate)}% better responses than manual ones!`,
          action: 'Use AI more',
          actionLink: '#ai-setup',
          priority: 8
        });
      } else if (manualRate > aiRate + 5) {
        insights.push({
          icon: '✍️',
          type: 'info',
          message: `Your manual emails perform ${Math.round(manualRate - aiRate)}% better. The personal touch matters!`,
          action: null,
          priority: 5
        });
      }
    }

    return insights;
  }

  /**
   * Get weekly report
   */
  async getWeeklyReport() {
    const summary = await analyticsTracker.getSummary();
    const thisWeek = summary.thisWeek;
    const history = await analyticsTracker.getHistory();

    // Get previous week
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const lastWeek = history.filter(e => e.sentAt >= twoWeeksAgo && e.sentAt < oneWeekAgo);

    const lastWeekResponded = lastWeek.filter(e => e.status === 'responded');
    const lastWeekRate = lastWeek.length > 0
      ? ((lastWeekResponded.length / lastWeek.length) * 100).toFixed(1)
      : 0;

    return {
      thisWeek: {
        sent: thisWeek.sent,
        responses: thisWeek.responses,
        rate: thisWeek.responseRate
      },
      lastWeek: {
        sent: lastWeek.length,
        responses: lastWeekResponded.length,
        rate: parseFloat(lastWeekRate)
      },
      change: {
        sent: thisWeek.sent - lastWeek.length,
        responses: thisWeek.responses - lastWeekResponded.length,
        rate: (parseFloat(thisWeek.responseRate) - parseFloat(lastWeekRate)).toFixed(1)
      }
    };
  }

  /**
   * Get achievement badges
   */
  async getAchievements() {
    const summary = await analyticsTracker.getSummary();
    const stats = await analyticsTracker.getStats();
    const history = await analyticsTracker.getHistory();

    const achievements = [];

    // Volume achievements
    if (stats.totalSent >= 1) achievements.push({ icon: '📧', name: 'First Email', desc: 'Sent your first email' });
    if (stats.totalSent >= 10) achievements.push({ icon: '✉️', name: 'Getting Started', desc: 'Sent 10 emails' });
    if (stats.totalSent >= 50) achievements.push({ icon: '📮', name: 'Email Pro', desc: 'Sent 50 emails' });
    if (stats.totalSent >= 100) achievements.push({ icon: '🏆', name: 'Century Club', desc: 'Sent 100 emails' });
    if (stats.totalSent >= 500) achievements.push({ icon: '🚀', name: 'Email Master', desc: 'Sent 500 emails' });

    // Response achievements
    if (stats.response_positive >= 1) achievements.push({ icon: '🎉', name: 'First Response', desc: 'Got your first response' });
    if (stats.response_positive >= 10) achievements.push({ icon: '💬', name: 'Conversationalist', desc: '10 positive responses' });
    if (stats.response_referral >= 1) achievements.push({ icon: '🤝', name: 'First Referral', desc: 'Got your first referral' });
    if (stats.response_referral >= 5) achievements.push({ icon: '🌟', name: 'Referral Champion', desc: '5 referrals received' });

    // Rate achievements
    if (summary.responseRate >= 25) achievements.push({ icon: '📈', name: 'Above Average', desc: '25%+ response rate' });
    if (summary.responseRate >= 40) achievements.push({ icon: '🎯', name: 'Elite Recruiter', desc: '40%+ response rate' });
    if (summary.responseRate >= 50) achievements.push({ icon: '👑', name: 'Top 1%', desc: '50%+ response rate' });

    // Streak achievements
    const streak = this.calculateStreak(history);
    if (streak >= 3) achievements.push({ icon: '🔥', name: '3-Day Streak', desc: 'Sent emails 3 days in a row' });
    if (streak >= 7) achievements.push({ icon: '💪', name: 'Week Warrior', desc: 'Sent emails 7 days in a row' });
    if (streak >= 30) achievements.push({ icon: '⭐', name: 'Consistency King', desc: '30-day sending streak' });

    return achievements;
  }

  /**
   * Calculate current sending streak
   */
  calculateStreak(history) {
    if (history.length === 0) return 0;

    // Sort by date (most recent first)
    const sorted = [...history].sort((a, b) => b.sentAt - a.sentAt);

    // Get unique days
    const days = new Set();
    sorted.forEach(email => {
      const day = new Date(email.sentAt).toISOString().split('T')[0];
      days.add(day);
    });

    const dayArray = Array.from(days).sort().reverse();

    // Check for consecutive days
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDay = new Date(today);

    for (let i = 0; i < dayArray.length; i++) {
      const day = dayArray[i];
      const expectedDay = currentDay.toISOString().split('T')[0];

      if (day === expectedDay) {
        streak++;
        currentDay.setDate(currentDay.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }
}

// Export singleton instance
const analyticsInsights = new AnalyticsInsights();
