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
import { getBaseChartOptions, chartContainerStyle } from './themeUtils';

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

interface RiskSummaryProps {
  poams: POAM[];
}

const RiskSummary: React.FC<RiskSummaryProps> = ({ poams }) => {
  const [chartData, setChartData] = useState<ChartData<'bar', number[], string>>({
    labels: [],
    datasets: []
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions<'bar'>>({});

  useEffect(() => {
    // Get risk level counts by status
    const statusesMap: Record<string, Record<string, number>> = {
      'Not Started': {},
      'In Progress': {},
      'Completed': {},
      'On Hold': {},
      'Delayed': {},
      'Cancelled': {}
    };
    
    // Count POAMs by risk level and status
    poams.forEach(poam => {
      const status = poam.status || 'Not Specified';
      const riskLevel = poam.riskLevel || 'Not Specified';
      
      if (!statusesMap[status]) {
        statusesMap[status] = {};
      }
      
      statusesMap[status][riskLevel] = (statusesMap[status][riskLevel] || 0) + 1;
    });
    
    // Get all unique risk levels
    const allRiskLevels = Array.from(
      new Set(poams.map(poam => poam.riskLevel || 'Not Specified'))
    );
    
    // Sort risk levels by severity
    const orderedRiskLevels = ['Low', 'Medium', 'High', 'Very High', 'Not Specified'].filter(
      risk => allRiskLevels.includes(risk)
    );
    
    // Create datasets for each status
    const datasets = Object.entries(statusesMap).map(([status, riskCounts]) => {
      // Skip statuses with no POAMs
      if (Object.values(riskCounts).reduce((sum, count) => sum + count, 0) === 0) {
        return null;
      }
      
      const statusColor = status === 'Not Started' ? '#6366f1' : 
                         status === 'In Progress' ? '#3b82f6' : 
                         status === 'Completed' ? '#22c55e' : 
                         status === 'On Hold' ? '#f97316' : 
                         status === 'Delayed' ? '#ef4444' : 
                         '#94a3b8'; // Cancelled or other
      
      return {
        label: status,
        data: orderedRiskLevels.map(risk => riskCounts[risk] || 0),
        backgroundColor: statusColor,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 4,
      };
    }).filter(dataset => dataset !== null) as any[];
    
    setChartData({
      labels: orderedRiskLevels,
      datasets
    });
    
    // Get base chart options and customize for this chart
    const baseOptions = getBaseChartOptions();
    setChartOptions({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: 'POAM Risk Level by Status',
          color: baseOptions.plugins.legend.labels.color,
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          stacked: true,
          title: {
            display: true,
            text: 'Number of POAMs',
            color: baseOptions.scales.y.ticks.color
          }
        },
        x: {
          ...baseOptions.scales.x,
          stacked: true,
          title: {
            display: true,
            text: 'Risk Level',
            color: baseOptions.scales.x.ticks.color
          }
        }
      }
    });
  }, [poams]);

  // Add "no data" message when there are no POAMs
  if (poams.length === 0) {
    return (
      <div className="metrics-card">
        <h3>POAM Risk Summary</h3>
        <div className="no-data-message">No POAMs available to display</div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <div style={chartContainerStyle}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default RiskSummary;
