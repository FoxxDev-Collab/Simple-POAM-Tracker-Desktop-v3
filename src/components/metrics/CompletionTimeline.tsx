import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartData,
  ChartOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { getBaseChartOptions, chartContainerStyle, getThemeColors } from './themeUtils';

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
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

interface CompletionTimelineProps {
  poams: POAM[];
}

const CompletionTimeline: React.FC<CompletionTimelineProps> = ({ poams }) => {
  const [chartData, setChartData] = useState<ChartData<'line', {x: string, y: number}[], unknown>>({
    datasets: []
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions<'line'>>({});
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    // Skip processing if no POAMs
    if (poams.length === 0) return;
    
    // Only consider completed POAMs
    const completedPoams = poams.filter(poam => poam.status === 'Completed');
    
    // Group completions by date
    const completionsByDate: Record<string, number> = {};
    completedPoams.forEach(poam => {
      // Use the end date as completion date
      const completionDate = new Date(poam.endDate);
      // Format date to YYYY-MM-DD for grouping
      const dateKey = completionDate.toISOString().split('T')[0];
      
      completionsByDate[dateKey] = (completionsByDate[dateKey] || 0) + 1;
    });
    
    // Convert to array of objects with date and count
    const sortedDates = Object.keys(completionsByDate).sort();
    
    // Create cumulative timeline data
    let cumulativeCount = 0;
    const timelineData = sortedDates.map(date => {
      cumulativeCount += completionsByDate[date];
      return {
        x: date,
        y: cumulativeCount
      };
    });
    
    // Add starting point at 0 if we have data
    if (timelineData.length > 0) {
      // Add a point 1 day before the first completion
      const firstDate = new Date(sortedDates[0]);
      firstDate.setDate(firstDate.getDate() - 1);
      timelineData.unshift({
        x: firstDate.toISOString().split('T')[0],
        y: 0
      });
    }
    
    const themeColors = getThemeColors();
    
    setChartData({
      datasets: [
        {
          label: 'Completed POAMs',
          data: timelineData,
          borderColor: themeColors.success,
          backgroundColor: `${themeColors.success}20`, // 20% opacity
          borderWidth: 2,
          tension: 0.1,
          fill: true,
          pointBackgroundColor: themeColors.success,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    });
    
    // Get base chart options and customize for this chart
    const baseOptions = getBaseChartOptions();
    setChartOptions({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: 'POAM Completion Timeline',
          color: baseOptions.plugins.legend.labels.color,
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'month',
            tooltipFormat: 'PP',
            displayFormats: {
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy'
            }
          },
          title: {
            display: true,
            text: 'Date',
            color: baseOptions.scales.x.ticks.color
          },
          grid: {
            color: baseOptions.scales.x.grid.color
          },
          ticks: {
            color: baseOptions.scales.x.ticks.color
          }
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative Completed POAMs',
            color: baseOptions.scales.y.ticks.color
          },
          beginAtZero: true,
          grid: {
            color: baseOptions.scales.y.grid.color
          },
          ticks: {
            color: baseOptions.scales.y.ticks.color,
            precision: 0
          }
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

  // Add "no data" message when there are no completed POAMs
  if (poams.filter(poam => poam.status === 'Completed').length === 0) {
    return (
      <div className="metrics-card">
        <h3>POAM Completion Timeline</h3>
        <div className="no-data-message">No completed POAMs available to display</div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <div style={chartContainerStyle}>
        <Line key={chartKey} data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default CompletionTimeline;
