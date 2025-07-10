import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { getPriorityColors, getBaseChartOptions, chartContainerStyle } from './themeUtils';

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface POAM {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  riskLevel: string;
  milestones: any[];
}

interface PriorityDistributionProps {
  poams: POAM[];
}

const PriorityDistribution: React.FC<PriorityDistributionProps> = ({ poams }) => {
  const [chartData, setChartData] = useState<ChartData<'doughnut', number[], string>>({
    labels: [],
    datasets: []
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions<'doughnut'>>({});
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    const priorityCounts: Record<string, number> = {};
    
    // Count POAMs by priority
    poams.forEach(poam => {
      const priority = poam.priority || 'Not Specified';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    // Prepare data for chart
    const labels = Object.keys(priorityCounts);
    const data = Object.values(priorityCounts);
    const priorityColors = getPriorityColors();
    const backgroundColor = labels.map(priority => 
      priorityColors[priority as keyof typeof priorityColors] || priorityColors['Low']
    );

    setChartData({
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: 'transparent',
          borderWidth: 0,
          hoverOffset: 10,
        }
      ]
    });

    // Get base chart options and customize for this chart
    const baseOptions = getBaseChartOptions();
    setChartOptions({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: {
          ...baseOptions.plugins.legend,
        },
        tooltip: {
          ...baseOptions.plugins.tooltip,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw as number;
              const total = data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        },
        title: {
          display: true,
          text: 'POAM Priority Distribution',
          color: baseOptions.plugins.legend.labels.color,
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      cutout: '60%'
    });
  }, [poams, chartKey]);

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

  // Add "no data" message when there are no POAMs
  if (poams.length === 0) {
    return (
      <div className="metrics-card">
        <h3>POAM Priority Distribution</h3>
        <div className="no-data-message">No POAMs available to display</div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <div style={chartContainerStyle}>
        <Doughnut key={chartKey} data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default PriorityDistribution;
