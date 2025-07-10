import React from 'react';
import { Milestone } from '../../types/Milestone';
import { formatDateDisplay } from '../../utils/dateUtils';
import './Milestone.css';

interface MilestoneItemProps {
  milestone: Milestone;
  onClick?: (milestone: Milestone) => void;
  onRemove?: (id: string) => void;
  showRemoveButton?: boolean;
}

const MilestoneItem: React.FC<MilestoneItemProps> = ({ 
  milestone, 
  onClick, 
  onRemove,
  showRemoveButton = false
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(milestone);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(milestone.id);
    }
  };

  // Get user's timezone from settings
  let timezone = 'America/Boise'; // Default
  try {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      if (settings.timezone) {
        timezone = settings.timezone;
      }
    }
  } catch (error) {
    console.error('Error getting timezone:', error);
  }

  return (
    <div className="milestone-item" onClick={handleClick}>
      <div className="milestone-header">
        <h4>{milestone.title}</h4>
        {showRemoveButton && (
          <button 
            className="remove-milestone-button" 
            onClick={handleRemove}
            aria-label="Remove milestone"
          >
            ×
          </button>
        )}
      </div>
      <p>
        <strong>Due Date:</strong> {formatDateDisplay(milestone.dueDate, timezone)}
      </p>
      <p>
        <strong>Status:</strong> 
        <span className={`status-badge ${milestone.status.toLowerCase().replace(/\s+/g, '-')}`}>
          {milestone.status}
        </span>
      </p>
      {milestone.description && (
        <p className="milestone-description">
          {milestone.description.length > 100 
            ? `${milestone.description.substring(0, 100)}...` 
            : milestone.description}
        </p>
      )}
    </div>
  );
};

export default MilestoneItem; 