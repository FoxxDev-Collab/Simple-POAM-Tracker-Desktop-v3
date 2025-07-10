import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface STIGComplianceChartProps {
  compliantControls: number;
  nonCompliantControls: number;
  notReviewedControls: number;
}

const STIGComplianceChart: React.FC<STIGComplianceChartProps> = ({
  compliantControls,
  nonCompliantControls,
  notReviewedControls
}) => {
  const totalControls = compliantControls + nonCompliantControls + notReviewedControls;
  const [chartKey, setChartKey] = useState(0);

  // Get computed CSS variables for theme-aware colors
  const getThemeColors = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    return {
      success: `hsl(${computedStyle.getPropertyValue('--success').trim()})`,
      destructive: `hsl(${computedStyle.getPropertyValue('--destructive').trim()})`,
      warning: `hsl(${computedStyle.getPropertyValue('--warning').trim()})`,
      background: `hsl(${computedStyle.getPropertyValue('--background').trim()})`,
      foreground: `hsl(${computedStyle.getPropertyValue('--foreground').trim()})`,
      muted: `hsl(${computedStyle.getPropertyValue('--muted-foreground').trim()})`
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
    labels: ['Compliant', 'Non-Compliant', 'Not Reviewed'],
    datasets: [{
      data: [compliantControls, nonCompliantControls, notReviewedControls],
      backgroundColor: [
        themeColors.success,
        themeColors.destructive,
        themeColors.warning
      ],
      borderWidth: 2,
      borderColor: themeColors.background
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 },
          color: themeColors.foreground,
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const percentage = totalControls > 0 ? Math.round((value / totalControls) * 100) : 0;
                
                return {
                  text: `${label}: ${value} (${percentage}%)`,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.backgroundColor[i],
                  lineWidth: 0,
                  pointStyle: 'circle',
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: themeColors.background,
        titleColor: themeColors.foreground,
        bodyColor: themeColors.foreground,
        borderColor: themeColors.muted,
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = totalControls > 0 ? Math.round((value / totalControls) * 100) : 0;
            return `${label}: ${value} controls (${percentage}%)`;
          }
        }
      }
    }
  };

  if (totalControls === 0) {
    return (
      <div className="metrics-card">
        <h3>STIG Compliance Status</h3>
        <div className="no-data-message">
          No STIG mapping data available
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <h3>STIG Compliance Status</h3>
      <div className="h-64">
        <Doughnut key={chartKey} data={chartData} options={chartOptions} />
      </div>
      <div className="mt-4 text-center space-y-1">
        <div className="text-sm text-muted-foreground">
          Total Controls: <strong className="text-foreground">{totalControls}</strong>
        </div>
        <div className="text-sm text-muted-foreground">
          Compliance Rate: <strong className="text-success">
            {Math.round((compliantControls / totalControls) * 100)}%
          </strong>
        </div>
      </div>
    </div>
  );
};

export default STIGComplianceChart; 