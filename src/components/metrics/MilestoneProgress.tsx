import React, { useMemo } from 'react';
import './Metrics.css';

interface Milestone {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  completedDate: string | null;
  status: string;
  poamId: number;
}

interface POAM {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  riskLevel: string;
  milestones: Milestone[];
}

interface MilestoneProgressProps {
  poams: POAM[];
}

const MilestoneProgress: React.FC<MilestoneProgressProps> = ({ poams }) => {
  const progressData = useMemo(() => {
    return poams.map(poam => {
      const totalMilestones = poam.milestones.length;
      const completedMilestones = poam.milestones.filter(
        milestone => milestone.status === 'Completed'
      ).length;
      
      const percentComplete = totalMilestones > 0 
        ? Math.round((completedMilestones / totalMilestones) * 100) 
        : 0;
      
      return {
        id: poam.id,
        title: poam.title,
        totalMilestones,
        completedMilestones,
        percentComplete,
        status: poam.status,
        priority: poam.priority,
        riskLevel: poam.riskLevel
      };
    }).sort((a, b) => {
      // Sort by percentage complete (descending) and then by title
      if (a.percentComplete !== b.percentComplete) {
        return b.percentComplete - a.percentComplete;
      }
      return a.title.localeCompare(b.title);
    });
  }, [poams]);

  // Function to get appropriate color class based on completion percentage
  const getProgressColorClass = (percent: number): string => {
    if (percent >= 75) return 'progress-high';
    if (percent >= 50) return 'progress-medium';
    if (percent >= 25) return 'progress-low';
    return 'progress-very-low';
  };

  if (poams.length === 0) {
    return (
      <div className="metrics-card">
        <h3>POAM Milestone Progress</h3>
        <div className="no-data-message">No POAMs available to display</div>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <h3>POAM Milestone Progress</h3>
      <div className="milestone-progress-container">
        <table className="milestone-progress-table">
          <thead>
            <tr>
              <th>POAM</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Risk Level</th>
              <th>Milestone Progress</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {progressData.map(poam => (
              <tr key={poam.id}>
                <td className="poam-title">{poam.title}</td>
                <td className={`status-cell status-${poam.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {poam.status}
                </td>
                <td className={`priority-cell priority-${poam.priority.toLowerCase()}`}>
                  {poam.priority}
                </td>
                <td className={`risk-cell risk-${poam.riskLevel.toLowerCase().replace(/\s+/g, '-')}`}>
                  {poam.riskLevel}
                </td>
                <td>
                  <div className="progress-bar-container">
                    <div 
                      className={`progress-bar ${getProgressColorClass(poam.percentComplete)}`}
                      style={{ width: `${poam.percentComplete}%` }}
                    ></div>
                    <span className="progress-text">
                      {poam.completedMilestones} of {poam.totalMilestones}
                    </span>
                  </div>
                </td>
                <td className="percent-cell">
                  <span className={`percent-badge ${getProgressColorClass(poam.percentComplete)}`}>
                    {poam.percentComplete}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MilestoneProgress;
