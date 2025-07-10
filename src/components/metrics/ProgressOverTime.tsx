import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { getBaseChartOptions, chartContainerStyle, getThemeColors } from './themeUtils';

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

interface MilestoneProgressProps {
  poams: POAM[];
}

const MilestoneProgress: React.FC<MilestoneProgressProps> = ({ poams }) => {
  const [chartData, setChartData] = useState<ChartData<'bar', number[], string>>({
    labels: [],
    datasets: []
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions<'bar'>>({});
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    // Skip processing if no POAMs
    if (poams.length === 0) return;
    
    // Filter POAMs to only include those with milestones
    const poamsWithMilestones = poams.filter(poam => poam.milestones && poam.milestones.length > 0);
    
    // Sort POAMs by title for consistent display
    poamsWithMilestones.sort((a, b) => a.title.localeCompare(b.title));
    
    // Limit to 15 POAMs to keep the chart readable
    const limitedPoams = poamsWithMilestones.slice(0, 15);
    
    // Calculate milestone completion for each POAM
    const labels = limitedPoams.map(poam => {
      // Truncate long titles
      const maxLength = 15;
      return poam.title.length > maxLength ? 
        poam.title.substring(0, maxLength) + '...' : 
        poam.title;
    });
    
    // Create datasets for total and completed milestones
    const totalMilestones = limitedPoams.map(poam => poam.milestones.length);
    const completedMilestones = limitedPoams.map(poam => 
      poam.milestones.filter(milestone => milestone.status === 'Completed').length
    );
    
    const themeColors = getThemeColors();
    
    setChartData({
      labels: labels,
      datasets: [
        {
          label: 'Completed Milestones',
          data: completedMilestones,
          backgroundColor: themeColors.success,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 0,
            bottomRight: 0,
          },
          barPercentage: 0.8,
        },
        {
          label: 'Remaining Milestones',
          data: limitedPoams.map((_, index) =>
            totalMilestones[index] - completedMilestones[index]
          ),
          backgroundColor: themeColors.muted,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 0,
            bottomRight: 0,
          },
          barPercentage: 0.8,
        }
      ]
    });
    
    // Get base chart options and customize for this chart
    const baseOptions = getBaseChartOptions();
    setChartOptions({
      ...baseOptions,
      indexAxis: 'x',
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: 'POAM Milestone Completion',
          color: baseOptions.plugins.legend.labels.color,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          backgroundColor: baseOptions.plugins.tooltip?.backgroundColor || 'rgba(0, 0, 0, 0.8)',
          titleColor: baseOptions.plugins.tooltip?.titleColor || 'white',
          bodyColor: baseOptions.plugins.tooltip?.bodyColor || 'white',
          borderColor: baseOptions.plugins.tooltip?.borderColor || 'rgba(0, 0, 0, 0)',
          borderWidth: baseOptions.plugins.tooltip?.borderWidth || 0,
          padding: baseOptions.plugins.tooltip?.padding || 10,
          cornerRadius: baseOptions.plugins.tooltip?.cornerRadius || 6,
          callbacks: {
            afterTitle: (tooltipItems) => {
              const dataIndex = tooltipItems[0].dataIndex;
              return `ID: ${limitedPoams[dataIndex].id}`;
            },
            footer: (tooltipItems) => {
              const dataIndex = tooltipItems[0].dataIndex;
              const poam = limitedPoams[dataIndex];
              const total = poam.milestones.length;
              const completed = poam.milestones.filter(m => m.status === 'Completed').length;
              const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
              return [
                `Total Milestones: ${total}`,
                `Completed: ${completed} (${percentage}%)`
              ];
            }
          }
        },
        legend: {
          ...baseOptions.plugins.legend,
          position: 'bottom'
        }
      },
      scales: {
        x: {
          ...baseOptions.scales.x,
          stacked: true,
          title: {
            display: true,
            text: 'POAMs',
            color: baseOptions.scales.x.ticks.color
          },
          ticks: {
            ...baseOptions.scales.x.ticks,
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          ...baseOptions.scales.y,
          stacked: true,
          title: {
            display: true,
            text: 'Number of Milestones',
            color: baseOptions.scales.y.ticks.color
          },
          beginAtZero: true
        }
      }
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

  // Add "no data" message when there are no POAMs with milestones
  if (poams.length === 0 || !poams.some(poam => poam.milestones && poam.milestones.length > 0)) {
    return (
      <div className="metrics-card">
        <h3>POAM Milestone Completion</h3>
        <div className="no-data-message">No POAMs with milestones available to display</div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <div style={chartContainerStyle}>
        <Bar key={chartKey} data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default MilestoneProgress;
