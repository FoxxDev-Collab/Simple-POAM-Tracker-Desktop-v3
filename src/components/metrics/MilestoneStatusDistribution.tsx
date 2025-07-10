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
import { getBaseChartOptions, chartContainerStyle, getStatusColors } from './themeUtils';

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

interface MilestoneStatusDistributionProps {
  poams: POAM[];
}

const MilestoneStatusDistribution: React.FC<MilestoneStatusDistributionProps> = ({ poams }) => {
  const [chartData, setChartData] = useState<ChartData<'doughnut', number[], string>>({
    labels: [],
    datasets: []
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions<'doughnut'>>({});
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    // Skip processing if no POAMs
    if (poams.length === 0) return;
    
    // Extract all milestones from all POAMs
    const allMilestones: any[] = [];
    
    poams.forEach(poam => {
      if (poam.milestones && poam.milestones.length > 0) {
        // Add POAM reference to each milestone for better context
        const poamMilestones = poam.milestones.map(milestone => ({
          ...milestone,
          poamTitle: poam.title,
          poamId: poam.id
        }));
        allMilestones.push(...poamMilestones);
      }
    });
    
    // Count milestones by status
    const statusCounts: Record<string, number> = {
      'Not Started': 0,
      'In Progress': 0,
      'Completed': 0,
      'Delayed': 0
    };

    allMilestones.forEach(milestone => {
      const status = milestone.status || 'Not Specified';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    // Prepare data for chart
    const labels = Object.keys(statusCounts).filter(status => statusCounts[status] > 0);
    const data = labels.map(status => statusCounts[status]);
    
    // Get theme-aware colors for each status
    const statusColors = getStatusColors();
    const backgroundColor = labels.map(status => 
      statusColors[status as keyof typeof statusColors] || statusColors['Not Started']
    );
    
    // Create chart data
    setChartData({
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: 'transparent',
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
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
          text: 'Milestone Status Distribution',
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

  // Add "no data" message when there are no milestones
  if (poams.length === 0 || !poams.some(poam => poam.milestones && poam.milestones.length > 0)) {
    return (
      <div className="metrics-card">
        <h3>Milestone Status Distribution</h3>
        <div className="no-data-message">No milestones available to display</div>
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

export default MilestoneStatusDistribution;
