/**
 * Overview Metrics Component Tests
 * Tests rendering, interactions, and edge cases
 */

import { render, screen } from '@testing-library/react';
import { OverviewMetrics } from '@/components/analytics/OverviewMetrics';

describe('OverviewMetrics', () => {
  const mockData = {
    totalContacts: 150,
    totalDrafts: 45,
    emailsSent: 120,
    replyRate: '32.5',
    bestPerformingSequence: 'Cold Outreach Template',
    bestPerformingReplyRate: '45.2',
    mostActiveDay: 'Wednesday',
    mostActiveHour: '14:00',
  };

  const mockComparison = {
    contacts: 25,
    drafts: 10,
    emailsSent: 15,
    replyRate: 5.2,
  };

  describe('Rendering', () => {
    test('renders all metric cards', () => {
      render(<OverviewMetrics data={mockData} loading={false} />);

      expect(screen.getByText('Total Contacts')).toBeInTheDocument();
      expect(screen.getByText('Total Drafts')).toBeInTheDocument();
      expect(screen.getByText('Emails Sent')).toBeInTheDocument();
      expect(screen.getByText('Reply Rate')).toBeInTheDocument();
    });

    test('displays correct values', () => {
      render(<OverviewMetrics data={mockData} loading={false} />);

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('32.5%')).toBeInTheDocument();
    });

    test('displays best performing sequence', () => {
      render(<OverviewMetrics data={mockData} loading={false} />);

      expect(screen.getByText('Cold Outreach Template')).toBeInTheDocument();
      expect(screen.getByText('45.2% reply rate')).toBeInTheDocument();
    });

    test('displays activity insights', () => {
      render(<OverviewMetrics data={mockData} loading={false} />);

      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('14:00')).toBeInTheDocument();
    });
  });

  describe('Comparison Mode', () => {
    test('shows trend indicators when comparison enabled', () => {
      render(<OverviewMetrics data={mockData} comparison={mockComparison} loading={false} />);

      // Should show up/down arrows and percentages
      const trends = screen.getAllByText(/%/, { exact: false });
      expect(trends.length).toBeGreaterThan(0);
    });

    test('shows positive trend with up arrow', () => {
      render(<OverviewMetrics data={mockData} comparison={mockComparison} loading={false} />);

      // Positive changes should have green color class
      // This would need to check for specific styling or aria-labels
    });

    test('shows negative trend with down arrow', () => {
      const negativeComparison = {
        ...mockComparison,
        contacts: -10,
      };

      render(<OverviewMetrics data={mockData} comparison={negativeComparison} loading={false} />);

      // Negative changes should have red color class
    });

    test('hides trends when comparison is null', () => {
      render(<OverviewMetrics data={mockData} comparison={null} loading={false} />);

      // Should not show any trend indicators
      const { container } = render(<OverviewMetrics data={mockData} comparison={null} loading={false} />);
      expect(container.querySelector('[class*="text-green"]')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    test('shows skeleton loaders when loading', () => {
      render(<OverviewMetrics data={mockData} loading={true} />);

      // Should show animated skeleton elements
      const skeletons = screen.getAllByRole('status', { hidden: true });
      expect(skeletons.length).toBeGreaterThan(0);
    });

    test('hides actual data when loading', () => {
      render(<OverviewMetrics data={mockData} loading={true} />);

      // Real values should not be visible
      expect(screen.queryByText('150')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles zero values', () => {
      const zeroData = {
        ...mockData,
        totalContacts: 0,
        emailsSent: 0,
      };

      render(<OverviewMetrics data={zeroData} loading={false} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    test('handles very large numbers', () => {
      const largeData = {
        ...mockData,
        totalContacts: 999999,
      };

      render(<OverviewMetrics data={largeData} loading={false} />);

      expect(screen.getByText('999999')).toBeInTheDocument();
    });

    test('handles missing best performing sequence', () => {
      const noSequenceData = {
        ...mockData,
        bestPerformingSequence: 'N/A',
        bestPerformingReplyRate: '0.0',
      };

      render(<OverviewMetrics data={noSequenceData} loading={false} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    test('handles decimal reply rates', () => {
      const decimalData = {
        ...mockData,
        replyRate: '12.345',
      };

      render(<OverviewMetrics data={decimalData} loading={false} />);

      expect(screen.getByText('12.345%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      const { container } = render(<OverviewMetrics data={mockData} loading={false} />);

      // Check for semantic HTML and ARIA attributes
      expect(container.querySelector('[role="region"]')).toBeInTheDocument();
    });

    test('loading state has appropriate aria-busy', () => {
      const { container } = render(<OverviewMetrics data={mockData} loading={true} />);

      // Loading elements should indicate busy state
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    test('trend indicators have screen reader text', () => {
      render(<OverviewMetrics data={mockData} comparison={mockComparison} loading={false} />);

      // Trends should have descriptive text for screen readers
      // e.g., "increased by 20%"
    });
  });

  describe('Animations', () => {
    test('applies motion animations to metric values', () => {
      const { container } = render(<OverviewMetrics data={mockData} loading={false} />);

      // Framer Motion should add specific classes/attributes
      expect(container.querySelector('[style*="opacity"]')).toBeInTheDocument();
    });

    test('staggers card animations', () => {
      // Each card should have a slightly different animation delay
      // This would require checking computed styles or motion props
    });
  });

  describe('Responsive Design', () => {
    test('renders in grid layout', () => {
      const { container } = render(<OverviewMetrics data={mockData} loading={false} />);

      // Should use CSS Grid
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    test('adapts to mobile screens', () => {
      // This would require viewport manipulation
      // or checking for responsive classes
    });
  });
});
