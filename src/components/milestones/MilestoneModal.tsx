import React, { useState, useEffect } from 'react';
import { formatDateForInput } from '../../utils/dateUtils';
import { Milestone } from '../../types/Milestone';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface MilestoneModalProps {
  milestone: Milestone;
  onClose: () => void;
  onSave: (milestone: Milestone) => void;
}

export default function MilestoneModal({ milestone, onClose, onSave }: MilestoneModalProps) {
  const [editedMilestone, setEditedMilestone] = useState<Milestone>({
    ...milestone,
    // Format the date when initializing the state
    dueDate: formatDateForInput(milestone.dueDate)
  });
  const [isPoamInfoOpen, setIsPoamInfoOpen] = useState(false); // State for accordion
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
  
  // Add debugging log to verify milestone data
  useEffect(() => {
    console.log('MilestoneModal - Received milestone data:', milestone);
    
    // Format the date when updating from props
    setEditedMilestone({
      ...milestone,
      dueDate: formatDateForInput(milestone.dueDate)
    });
  }, [milestone]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedMilestone({ ...editedMilestone, [name]: value });
    
    // Debug the changes
    console.log(`Changed ${name} to ${value}`);
  };
  
  // Handle date input focus to prevent jumping
  const handleDateFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Scroll the input into view smoothly to prevent jumping
    setTimeout(() => {
      e.target.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }, 100);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting edited milestone:', editedMilestone);
    onSave(editedMilestone);
  };

  // Handle overlay click to close modal
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // If the milestone doesn't have valid data, show an error
  if (!milestone || !milestone.id) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleOverlayClick}
      >
        <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Error Loading Milestone</h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="p-6">
            <p className="text-muted-foreground">There was a problem loading the milestone data. Please try again.</p>
          </div>
          <div className="flex justify-end gap-3 p-6 border-t border-border">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Edit Milestone</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* POAM Information Accordion */}
            {editedMilestone.poamTitle && (
              <div className="border border-border rounded-lg overflow-hidden">
                <button 
                  type="button" 
                  onClick={() => setIsPoamInfoOpen(!isPoamInfoOpen)}
                  className="w-full p-4 bg-muted hover:bg-muted/80 text-left flex items-center justify-between transition-colors"
                >
                  <span className="font-medium text-foreground">POAM Information</span>
                  {isPoamInfoOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isPoamInfoOpen && (
                  <div className="p-4 bg-card border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Part of POAM:</span>
                        <div className="text-foreground">{editedMilestone.poamTitle}</div>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">POAM ID:</span>
                        <div className="text-foreground">{editedMilestone.poamId}</div>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Milestone ID:</span>
                        <div className="text-foreground">{editedMilestone.id}</div>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Original Due Date:</span>
                        <div className="text-foreground">{milestone.dueDate}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Milestone Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4 pb-2 border-b border-border">
                  Milestone Details
                </h3>
                
                <div className="space-y-4">
                  {/* Title - Full Width */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                      Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={editedMilestone.title || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      placeholder="Enter milestone title"
                    />
                  </div>
                  
                  {/* Status and Due Date - Two Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
                        Status
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={editedMilestone.status || 'Not Started'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Delayed">Delayed</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="dueDate" className="block text-sm font-medium text-foreground mb-2">
                        Due Date <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="date"
                        id="dueDate"
                        name="dueDate"
                        value={editedMilestone.dueDate || ''}
                        onChange={handleInputChange}
                        required
                        onFocus={handleDateFocus}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                    </div>
                  </div>
                  
                  {/* Description - Full Width */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={editedMilestone.description || ''}
                      onChange={handleInputChange}
                      rows={6}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                      placeholder="Enter milestone description..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 