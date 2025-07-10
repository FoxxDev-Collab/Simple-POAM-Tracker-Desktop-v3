import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface SecurityTestingChartProps {
  testPlans: Array<{
    id: string;
    name: string;
    status: string;
    test_cases: Array<{
      id: string;
      status: string;
      evidence_files?: string[];
      risk_rating: string;
    }>;
  }>;
}

const SecurityTestingChart: React.FC<SecurityTestingChartProps> = ({ testPlans }) => {
  const [chartKey, setChartKey] = useState(0);

  const calculateStats = () => {
    let totalTestCases = 0;
    let passedTests = 0;
    let failedTests = 0;
    let inProgressTests = 0;
    let notStartedTests = 0;
    let evidenceCollected = 0;

    testPlans.forEach(plan => {
      if (plan.test_cases) {
        totalTestCases += plan.test_cases.length;
        passedTests += plan.test_cases.filter(tc => tc.status === 'Passed').length;
        failedTests += plan.test_cases.filter(tc => tc.status === 'Failed').length;
        inProgressTests += plan.test_cases.filter(tc => tc.status === 'In Progress').length;
        notStartedTests += plan.test_cases.filter(tc => tc.status === 'Not Started').length;
        
        plan.test_cases.forEach(tc => {
          if (tc.evidence_files && tc.evidence_files.length > 0) {
            evidenceCollected++;
          }
        });
      }
    });

    return {
      totalTestCases,
      passedTests,
      failedTests,
      inProgressTests,
      notStartedTests,
      evidenceCollected
    };
  };

  const stats = calculateStats();

  // Get computed CSS variables for theme-aware colors
  const getThemeColors = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    return {
      success: `hsl(${computedStyle.getPropertyValue('--success').trim()})`,
      primary: `hsl(${computedStyle.getPropertyValue('--primary').trim()})`,
      muted: `hsl(${computedStyle.getPropertyValue('--muted-foreground').trim()})`,
      background: `hsl(${computedStyle.getPropertyValue('--background').trim()})`,
      foreground: `hsl(${computedStyle.getPropertyValue('--foreground').trim()})`
    };
  };

  const themeColors = getThemeColors();

  // Force chart re-render when theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setChartKey(prev => prev + 1);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const chartData = {
    labels: ['Test Execution', 'Evidence Collection'],
    datasets: [
      {
        label: 'Completed',
        data: [
          stats.passedTests + stats.failedTests, // Completed tests (passed + failed)
          stats.evidenceCollected
        ],
        backgroundColor: themeColors.success,
        borderColor: themeColors.success,
        borderWidth: 1
      },
      {
        label: 'In Progress',
        data: [
          stats.inProgressTests,
          0 // Evidence collection doesn't have "in progress" state
        ],
        backgroundColor: themeColors.primary,
        borderColor: themeColors.primary,
        borderWidth: 1
      },
      {
        label: 'Not Started',
        data: [
          stats.notStartedTests,
          stats.totalTestCases - stats.evidenceCollected // Tests without evidence
        ],
        backgroundColor: themeColors.muted,
        borderColor: themeColors.muted,
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          color: themeColors.foreground
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: themeColors.muted
        },
        ticks: {
          color: themeColors.foreground
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 },
          color: themeColors.foreground
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: themeColors.background,
        titleColor: themeColors.foreground,
        bodyColor: themeColors.foreground,
        borderColor: themeColors.muted,
        borderWidth: 1,
        callbacks: {
          afterLabel: (context: any) => {
            if (context.datasetIndex === 0 && context.dataIndex === 0) {
              const passRate = stats.totalTestCases > 0 
                ? Math.round((stats.passedTests / (stats.passedTests + stats.failedTests || 1)) * 100)
                : 0;
              return `Pass Rate: ${passRate}%`;
            }
            if (context.datasetIndex === 0 && context.dataIndex === 1) {
              const evidenceRate = stats.totalTestCases > 0 
                ? Math.round((stats.evidenceCollected / stats.totalTestCases) * 100)
                : 0;
              return `Collection Rate: ${evidenceRate}%`;
            }
            return '';
          }
        }
      }
    }
  };

  if (stats.totalTestCases === 0) {
    return (
      <div className="metrics-card">
        <h3>Security Testing Progress</h3>
        <div className="no-data-message">
          No test plan data available
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <h3>Security Testing Progress</h3>
      <div className="h-80">
        <Bar key={chartKey} data={chartData} options={chartOptions} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div className="text-center">
          <div>
            <strong className="text-success">
              {stats.totalTestCases > 0 
                ? Math.round(((stats.passedTests + stats.failedTests) / stats.totalTestCases) * 100)
                : 0}%
            </strong>
          </div>
          <div>Tests Executed</div>
        </div>
        <div className="text-center">
          <div>
            <strong className="text-primary">
              {stats.totalTestCases > 0 
                ? Math.round((stats.evidenceCollected / stats.totalTestCases) * 100)
                : 0}%
            </strong>
          </div>
          <div>Evidence Collected</div>
        </div>
      </div>
    </div>
  );
};

export default SecurityTestingChart; 