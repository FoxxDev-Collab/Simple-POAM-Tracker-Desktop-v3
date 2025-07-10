import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { invoke } from '@tauri-apps/api/core';
import { formatDateForInput } from '../../utils/dateUtils';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { Button } from '../../components/ui/button';
import { SimpleDateInput } from '../common';
import TabNavigation from '../tabNavigation/TabNavigation';

interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
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
  // Enhanced fields (optional for backward compatibility)
  resources?: string;
  sourceIdentifyingVulnerability?: string;
  // Risk Analysis fields
  rawSeverity?: string;
  severity?: string;
  relevanceOfThreat?: string;
  likelihood?: string;
  impact?: string;
  residualRisk?: string;
  // Additional optional fields
  mitigations?: string;
  devicesAffected?: string;
}

interface EditPOAMProps {
  poamId?: number;
  onSave?: () => void;
}

export default function EditPOAM({ poamId, onSave }: EditPOAMProps) {
  const [editedPOAM, setEditedPOAM] = useState<POAM | null>(null);
  const [originalPOAM, setOriginalPOAM] = useState<POAM | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const { showToast } = useToast();
  const { currentSystem } = useSystem();
  const { notifyPOAMUpdated, notifyMilestoneCompleted, notifySystemEvent } = useNotificationGenerator();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to edit POAMs.</p>
      </div>
    );
  }
  
  useEffect(() => {
    if (poamId) {
      loadPOAM(poamId);
    } else {
      setLoading(false);
      showToast('error', 'No POAM selected for editing');
    }
  }, [poamId]);

  const loadPOAM = async (id: number) => {
    try {
      setLoading(true);
      // Fetch the actual POAM data from the backend with systemId
      const data = await invoke<any>('get_poam_by_id', { 
        id,
        systemId: currentSystem.id 
      });
      
      if (data) {
        // Map the snake_case fields from backend to camelCase for frontend
        const mappedPOAM: POAM = {
          id: data.id,
          title: data.title,
          description: data.description,
          startDate: formatDateForInput(data.start_date || data.startDate || ''),
          endDate: formatDateForInput(data.end_date || data.endDate || ''),
          status: data.status,
          priority: data.priority,
          riskLevel: data.risk_level || data.riskLevel || '',
          milestones: (data.milestones || []).map((m: any) => ({
            id: m.id,
            title: m.title,
            dueDate: formatDateForInput(m.due_date || m.dueDate || ''),
            status: m.status,
            description: m.description
          })),
          // Enhanced fields with backward compatibility
          resources: data.resources || '',
          sourceIdentifyingVulnerability: data.source_identifying_vulnerability || data.sourceIdentifyingVulnerability || '',
          // Risk Analysis fields
          rawSeverity: data.raw_severity || data.rawSeverity || '',
          severity: data.severity || '',
          relevanceOfThreat: data.relevance_of_threat || data.relevanceOfThreat || '',
          likelihood: data.likelihood || '',
          impact: data.impact || '',
          residualRisk: data.residual_risk || data.residualRisk || '',
          // Additional optional fields
          mitigations: data.mitigations || '',
          devicesAffected: data.devices_affected || data.devicesAffected || ''
        };
        
        setEditedPOAM(mappedPOAM);
        setOriginalPOAM(JSON.parse(JSON.stringify(mappedPOAM)));
      } else {
        showToast('error', 'Failed to load POAM: Not found');
      }
    } catch (error) {
      console.error('Error loading POAM:', error);
      showToast('error', `Failed to load POAM: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editedPOAM) return;
    
    const { name, value } = e.target;
    setEditedPOAM({ ...editedPOAM, [name]: value });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedPOAM || !originalPOAM) return;
    
    try {
      // Keep everything in camelCase as the backend now expects
      const mappedPOAM = {
        id: editedPOAM.id,
        title: editedPOAM.title,
        description: editedPOAM.description,
        startDate: editedPOAM.startDate,  // Keep as camelCase
        endDate: editedPOAM.endDate,      // Keep as camelCase
        status: editedPOAM.status,
        priority: editedPOAM.priority,
        riskLevel: editedPOAM.riskLevel,  // Keep as camelCase
        milestones: editedPOAM.milestones.map(m => ({
          id: m.id,
          title: m.title,
          dueDate: m.dueDate,
          status: m.status,
          description: m.description
        })),
        // Enhanced fields
        resources: editedPOAM.resources || '',
        sourceIdentifyingVulnerability: editedPOAM.sourceIdentifyingVulnerability || '',
        // Risk Analysis fields
        rawSeverity: editedPOAM.rawSeverity || '',
        severity: editedPOAM.severity || '',
        relevanceOfThreat: editedPOAM.relevanceOfThreat || '',
        likelihood: editedPOAM.likelihood || '',
        impact: editedPOAM.impact || '',
        residualRisk: editedPOAM.residualRisk || '',
        // Additional optional fields
        mitigations: editedPOAM.mitigations || '',
        devicesAffected: editedPOAM.devicesAffected || ''
      };
      
      // Save the updated POAM to the backend with systemId
      await invoke('update_poam', { 
        poam: mappedPOAM,
        systemId: currentSystem.id 
      });
      
      showToast('success', `POAM updated successfully for ${currentSystem.name}`);
      
      // Check for milestone status changes and notify
      const originalMilestones = originalPOAM.milestones;
      const updatedMilestones = editedPOAM.milestones;
      
      updatedMilestones.forEach(updatedMilestone => {
        const originalMilestone = originalMilestones.find(m => m.id === updatedMilestone.id);
        if (originalMilestone && originalMilestone.status !== 'Completed' && updatedMilestone.status === 'Completed') {
          // Milestone was just completed
          notifyMilestoneCompleted({
            ...updatedMilestone,
            poamTitle: editedPOAM.title,
            poamId: editedPOAM.id
          });
        }
      });
      
      // Notify about POAM update
      notifyPOAMUpdated(editedPOAM, originalPOAM.status);
      
      // Notify about successful update
      notifySystemEvent({
        type: 'sync',
        message: `POAM "${editedPOAM.title}" updated successfully`,
        success: true
      });
      
      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving POAM:', error);
      showToast('error', `Failed to save POAM: ${error}`);
      
      // Notify about update failure
      notifySystemEvent({
        type: 'error',
        message: `Failed to update POAM "${editedPOAM.title}"`,
        success: false,
        details: String(error)
      });
    }
  };
  
  const addMilestone = () => {
    if (!editedPOAM) return;
    
    // Check if there are already blank milestones to prevent creating too many at once
    const blankMilestones = editedPOAM.milestones.filter(m => !m.title.trim());
    if (blankMilestones.length > 2) {
      showToast('warning', 'Please fill out existing milestones before adding more');
      return;
    }
    
    // Smart date suggestion: distribute milestones evenly across POAM timeline
    const suggestedDate = getSuggestedMilestoneDate();
    
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: '',
      dueDate: suggestedDate,
      status: 'Not Started',
      description: ''
    };
    
    setEditedPOAM({
      ...editedPOAM,
      milestones: [...editedPOAM.milestones, newMilestone]
    });
    
    // Scroll to the new milestone after a short delay to allow DOM update
    setTimeout(() => {
      const milestoneElements = document.querySelectorAll('[data-milestone-index]');
      const lastMilestone = milestoneElements[milestoneElements.length - 1];
      if (lastMilestone) {
        lastMilestone.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 100);
  };

  // Helper function to suggest milestone dates
  const getSuggestedMilestoneDate = (): string => {
    if (!editedPOAM || !editedPOAM.startDate || !editedPOAM.endDate) {
      return '';
    }

    const startDate = new Date(editedPOAM.startDate);
    const endDate = new Date(editedPOAM.endDate);
    const existingMilestones = editedPOAM.milestones.filter(m => m.dueDate); // Only consider milestones with dates

    // If no milestones exist, suggest a date 1/4 through the timeline
    if (existingMilestones.length === 0) {
      const quarterPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.25);
      return formatDateForInput(quarterPoint.toISOString());
    }

    // Sort existing milestones by date
    const sortedMilestones = existingMilestones
      .map(m => new Date(m.dueDate))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const latestMilestoneDate = sortedMilestones[sortedMilestones.length - 1];

    if (latestMilestoneDate) {
      // Calculate intelligent spacing based on remaining timeline
      const remainingTime = endDate.getTime() - latestMilestoneDate.getTime();
      
      // If we have more than 30 days remaining, suggest 2 weeks later
      // If we have less time, suggest proportional spacing
      let suggestedOffset: number;
      if (remainingTime > 30 * 24 * 60 * 60 * 1000) { // More than 30 days
        suggestedOffset = 14 * 24 * 60 * 60 * 1000; // 2 weeks
      } else if (remainingTime > 7 * 24 * 60 * 60 * 1000) { // More than 1 week
        suggestedOffset = 7 * 24 * 60 * 60 * 1000; // 1 week
      } else {
        // For shorter remaining periods, suggest 1/3 of the remaining time
        suggestedOffset = remainingTime * 0.33;
      }

      const suggestedDate = new Date(latestMilestoneDate.getTime() + suggestedOffset);
      
      // Make sure we don't go past the end date, leave at least 1 day buffer
      const maxSuggestedDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000));
      if (suggestedDate <= maxSuggestedDate) {
        return formatDateForInput(suggestedDate.toISOString());
      } else {
        // If our suggestion would be too late, put it halfway between latest milestone and end
        const halfwayPoint = new Date(latestMilestoneDate.getTime() + (endDate.getTime() - latestMilestoneDate.getTime()) * 0.5);
        return formatDateForInput(halfwayPoint.toISOString());
      }
    }

    // If all else fails, suggest the midpoint between start and end
    const midPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.5);
    return formatDateForInput(midPoint.toISOString());
  };

  // Helper function to validate milestone date
  const validateMilestoneDate = (date: string): { isValid: boolean; message?: string } => {
    if (!editedPOAM || !date) return { isValid: true };

    const milestoneDate = new Date(date);
    const startDate = new Date(editedPOAM.startDate);
    const endDate = new Date(editedPOAM.endDate);

    if (milestoneDate < startDate) {
      return { 
        isValid: false, 
        message: 'Milestone date cannot be before POAM start date' 
      };
    }

    if (milestoneDate > endDate) {
      return { 
        isValid: false, 
        message: 'Milestone date cannot be after POAM end date' 
      };
    }

    return { isValid: true };
  };

  // Helper function to get the minimum date for a milestone based on its position
  const getMinimumDateForMilestone = (currentIndex: number): string => {
    if (!editedPOAM) return '';

    // Create a stable copy of milestones with their indices
    const sortedMilestones = [...editedPOAM.milestones]
      .map((milestone, idx) => ({
        ...milestone,
        originalIndex: idx,
        date: new Date(milestone.dueDate || '1900-01-01').getTime()
      }))
      .sort((a, b) => a.date - b.date);

    // Find the current milestone in the sorted array
    const currentMilestone = sortedMilestones.find(m => m.originalIndex === currentIndex);
    if (!currentMilestone) return editedPOAM.startDate || '';

    const currentSortedIndex = sortedMilestones.indexOf(currentMilestone);
    
    // If this is the first milestone chronologically, use POAM start date
    if (currentSortedIndex === 0) {
      return editedPOAM.startDate || '';
    }

    // Find the previous milestone in chronological order
    const previousMilestone = sortedMilestones[currentSortedIndex - 1];
    if (previousMilestone && previousMilestone.dueDate) {
      // Set minimum to the day after the previous milestone
      const prevDate = new Date(previousMilestone.dueDate);
      prevDate.setDate(prevDate.getDate() + 1);
      return formatDateForInput(prevDate.toISOString());
    }

    return editedPOAM.startDate || '';
  };

  // Helper function to calculate timeline progress
  const getTimelineProgress = (): number => {
    if (!editedPOAM || !editedPOAM.startDate || !editedPOAM.endDate) return 0;
    
    const start = new Date(editedPOAM.startDate);
    const end = new Date(editedPOAM.endDate);
    const now = new Date();
    
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };
  
  // Update milestone with debounce to prevent rapid updates
  const updateMilestone = useCallback((index: number, field: keyof Milestone, value: string) => {
    if (!editedPOAM) return;

    // Special handling for date updates
    if (field === 'dueDate') {
      const validation = validateMilestoneDate(value);
      if (!validation.isValid && value !== '') {
        showToast('warning', validation.message || 'Invalid date');
        return;
      }
    }

    const updatedMilestones = [...editedPOAM.milestones];
    updatedMilestones[index] = {
      ...updatedMilestones[index],
      [field]: value
    };

    // Sort milestones by date when updating dates
    if (field === 'dueDate') {
      updatedMilestones.sort((a, b) => {
        const dateA = new Date(a.dueDate || '1900-01-01').getTime();
        const dateB = new Date(b.dueDate || '1900-01-01').getTime();
        return dateA - dateB;
      });
    }

    setEditedPOAM({
      ...editedPOAM,
      milestones: updatedMilestones
    });
  }, [editedPOAM, validateMilestoneDate, showToast]);
  
  const removeMilestone = (index: number) => {
    if (!editedPOAM) return;
    
    const updatedMilestones = [...editedPOAM.milestones];
    updatedMilestones.splice(index, 1);
    
    setEditedPOAM({
      ...editedPOAM,
      milestones: updatedMilestones
    });
  };

  // Handle cancel button - reset to original state or navigate back
  const handleCancel = () => {
    // Ask for confirmation if there are unsaved changes
    if (editedPOAM && originalPOAM) {
      const hasChanges = JSON.stringify(editedPOAM) !== JSON.stringify(originalPOAM);
      
      if (hasChanges) {
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
        if (!confirmed) {
          return;
        }
      }
    }
    
    if (onSave) {
      // If onSave callback is provided, use it to navigate back
      onSave();
    } else {
      // Fallback to browser history
      window.history.back();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="responsive-header mb-6 pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit POAM</h1>
          <p className="text-muted-foreground">
            {editedPOAM ? `Editing "${editedPOAM.title}" for ${currentSystem.name}` : 'Loading POAM...'}
          </p>
        </div>
        
        {editedPOAM && (
          <div className="button-group">
            <button
              type="submit"
              form="edit-poam-form"
              className="btn btn-primary btn-responsive"
              disabled={!editedPOAM}
            >
              Save Changes
            </button>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="btn-responsive"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading POAM data...</p>
        </div>
      ) : editedPOAM ? (
        <>
          <form onSubmit={handleSubmit} id="edit-poam-form">
            <TabNavigation
              tabs={[
                {
                  id: 'details',
                  label: 'Basic Details',
                  content: (
                    <div className="container-responsive p-6 space-y-8">
                    <div className="space-y-8">
                      {/* Basic Information Section */}
                      <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                        <div className="border-b border-border pb-3">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            Basic Information
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">Essential POAM details and description</p>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                              POAM Title <span className="text-destructive">*</span>
                            </label>
                            <input
                              type="text"
                              id="title"
                              name="title"
                              value={editedPOAM.title}
                              onChange={handleInputChange}
                              required
                              placeholder="Enter a clear, descriptive title for this POAM"
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                              Description <span className="text-destructive">*</span>
                            </label>
                            <textarea
                              id="description"
                              name="description"
                              value={editedPOAM.description}
                              onChange={handleInputChange}
                              rows={5}
                              required
                              placeholder="Provide a detailed description of the security issue, remediation plan, and expected outcomes"
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Include relevant details about the security finding and remediation approach
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Section */}
                      <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                        <div className="border-b border-border pb-3">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            Timeline & Schedule
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">Define project start and completion dates</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-2">
                              Start Date <span className="text-destructive">*</span>
                            </label>
                            <SimpleDateInput
                              value={editedPOAM.startDate}
                              onChange={(value) => setEditedPOAM({ ...editedPOAM, startDate: value })}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                              required
                            />
                            <p className="text-xs text-muted-foreground mt-1">When work on this POAM begins</p>
                          </div>
                          
                          <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-foreground mb-2">
                              Target Completion <span className="text-destructive">*</span>
                            </label>
                            <SimpleDateInput
                              value={editedPOAM.endDate}
                              onChange={(value) => setEditedPOAM({ ...editedPOAM, endDate: value })}
                              min={editedPOAM.startDate}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                              required
                            />
                            <p className="text-xs text-muted-foreground mt-1">Expected completion date</p>
                          </div>
                        </div>
                      </div>

                      {/* Classification Section */}
                      <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                        <div className="border-b border-border pb-3">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            Classification & Assessment
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">Current status, priority level, and risk assessment</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
                              Current Status
                            </label>
                            <select
                              id="status"
                              name="status"
                              value={editedPOAM.status}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                            >
                              <option value="Not Started">Not Started</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Delayed">Delayed</option>
                            </select>
                            <div className="mt-2">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                editedPOAM.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                editedPOAM.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                editedPOAM.status === 'Delayed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {editedPOAM.status}
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="priority" className="block text-sm font-medium text-foreground mb-2">
                              Priority Level
                            </label>
                            <select
                              id="priority"
                              name="priority"
                              value={editedPOAM.priority}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                            <div className="mt-2">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                editedPOAM.priority === 'High' ? 'bg-red-100 text-red-800' :
                                editedPOAM.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {editedPOAM.priority} Priority
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="riskLevel" className="block text-sm font-medium text-foreground mb-2">
                              Risk Assessment
                            </label>
                            <select
                              id="riskLevel"
                              name="riskLevel"
                              value={editedPOAM.riskLevel}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                            >
                              <option value="Low">Low</option>
                              <option value="Moderate">Moderate</option>
                              <option value="High">High</option>
                            </select>
                            <div className="mt-2">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                editedPOAM.riskLevel === 'High' ? 'bg-red-100 text-red-800' :
                                editedPOAM.riskLevel === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {editedPOAM.riskLevel} Risk
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                id: 'risk-analysis',
                label: 'Risk Analysis',
                content: (
                  <div className="container-responsive p-6 space-y-8">
                    <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          Risk Assessment & Analysis
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Comprehensive risk evaluation and threat assessment</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="rawSeverity" className="block text-sm font-medium text-foreground mb-2">
                            Raw Severity
                          </label>
                          <select
                            id="rawSeverity"
                            name="rawSeverity"
                            value={editedPOAM.rawSeverity || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Raw Severity</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                            <option value="Informational">Informational</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="severity" className="block text-sm font-medium text-foreground mb-2">
                            Adjusted Severity
                          </label>
                          <select
                            id="severity"
                            name="severity"
                            value={editedPOAM.severity || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Adjusted Severity</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                            <option value="Informational">Informational</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="relevanceOfThreat" className="block text-sm font-medium text-foreground mb-2">
                            Relevance of Threat
                          </label>
                          <select
                            id="relevanceOfThreat"
                            name="relevanceOfThreat"
                            value={editedPOAM.relevanceOfThreat || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Relevance</option>
                            <option value="Very High">Very High</option>
                            <option value="High">High</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Low">Low</option>
                            <option value="Very Low">Very Low</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="likelihood" className="block text-sm font-medium text-foreground mb-2">
                            Likelihood
                          </label>
                          <select
                            id="likelihood"
                            name="likelihood"
                            value={editedPOAM.likelihood || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Likelihood</option>
                            <option value="Very High">Very High</option>
                            <option value="High">High</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Low">Low</option>
                            <option value="Very Low">Very Low</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="impact" className="block text-sm font-medium text-foreground mb-2">
                            Impact
                          </label>
                          <select
                            id="impact"
                            name="impact"
                            value={editedPOAM.impact || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Impact</option>
                            <option value="Very High">Very High</option>
                            <option value="High">High</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Low">Low</option>
                            <option value="Very Low">Very Low</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="residualRisk" className="block text-sm font-medium text-foreground mb-2">
                            Residual Risk
                          </label>
                          <select
                            id="residualRisk"
                            name="residualRisk"
                            value={editedPOAM.residualRisk || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          >
                            <option value="">Select Residual Risk</option>
                            <option value="Very High">Very High</option>
                            <option value="High">High</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Low">Low</option>
                            <option value="Very Low">Very Low</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                id: 'additional-info',
                label: 'Additional Information',
                content: (
                  <div className="container-responsive p-6 space-y-8">
                    {/* Source and Resources Section */}
                    <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          Source & Resources
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Vulnerability source and required resources</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="sourceIdentifyingVulnerability" className="block text-sm font-medium text-foreground mb-2">
                            Source Identifying Vulnerability
                          </label>
                          <textarea
                            id="sourceIdentifyingVulnerability"
                            name="sourceIdentifyingVulnerability"
                            value={editedPOAM.sourceIdentifyingVulnerability || ''}
                            onChange={handleInputChange}
                            rows={3}
                            placeholder="e.g., NESSUS Scan, Manual Testing, Code Review, STIG Finding ID"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Specify the tool, process, or method that identified this vulnerability
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="resources" className="block text-sm font-medium text-foreground mb-2">
                            Resources Required
                          </label>
                          <textarea
                            id="resources"
                            name="resources"
                            value={editedPOAM.resources || ''}
                            onChange={handleInputChange}
                            rows={4}
                            placeholder="e.g., 2 FTE developers, $50,000 budget, 3rd party security consultant, specific tools or licenses"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Detail personnel, budget, tools, and other resources needed for remediation
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mitigations and Devices Section */}
                    <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Mitigations & Affected Systems
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Current mitigations and system impact scope</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="mitigations" className="block text-sm font-medium text-foreground mb-2">
                            Current Mitigations
                          </label>
                          <textarea
                            id="mitigations"
                            name="mitigations"
                            value={editedPOAM.mitigations || ''}
                            onChange={handleInputChange}
                            rows={4}
                            placeholder="e.g., Network segmentation in place, Access controls implemented, Monitoring enabled, WAF rules configured"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Describe existing controls and temporary mitigations currently in place
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="devicesAffected" className="block text-sm font-medium text-foreground mb-2">
                            Devices/Systems Affected
                          </label>
                          <textarea
                            id="devicesAffected"
                            name="devicesAffected"
                            value={editedPOAM.devicesAffected || ''}
                            onChange={handleInputChange}
                            rows={4}
                            placeholder="e.g., Web servers (10), Database servers (3), Workstations (150), Network devices (25), Specific hostnames or IP ranges"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            List specific devices, systems, or components affected by this vulnerability
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                id: 'milestones',
                label: `Milestones (${editedPOAM.milestones.length})`,
                content: (
                  <div className="container-responsive p-6 space-y-6">
                    {/* POAM Timeline Context */}
                    <div className="bg-muted/30 rounded-lg p-6 border border-border">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">POAM Timeline</h3>
                          <p className="text-sm text-muted-foreground">Plan your milestones within this project timeline</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-xs font-medium text-muted-foreground mb-1">START DATE</div>
                          <div className="text-sm font-semibold text-foreground">
                            {editedPOAM.startDate ? new Date(editedPOAM.startDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            }) : 'Not set'}
                          </div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-xs font-medium text-muted-foreground mb-1">END DATE</div>
                          <div className="text-sm font-semibold text-foreground">
                            {editedPOAM.endDate ? new Date(editedPOAM.endDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            }) : 'Not set'}
                          </div>
                        </div>
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-xs font-medium text-muted-foreground mb-1">DURATION</div>
                          <div className="text-sm font-semibold text-foreground">
                            {editedPOAM.startDate && editedPOAM.endDate ? (() => {
                              const start = new Date(editedPOAM.startDate);
                              const end = new Date(editedPOAM.endDate);
                              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              const weeks = Math.floor(days / 7);
                              return weeks > 0 ? `${weeks} weeks, ${days % 7} days` : `${days} days`;
                            })() : 'Not calculated'}
                          </div>
                        </div>
                      </div>

                      {/* Visual Timeline */}
                      {editedPOAM.startDate && editedPOAM.endDate && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Project Progress</span>
                            <span>{Math.round(getTimelineProgress())}% elapsed</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${getTimelineProgress()}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {(!editedPOAM.startDate || !editedPOAM.endDate) && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Please set start and end dates in the Details tab for better milestone planning.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Milestones</h3>
                        <p className="text-sm text-muted-foreground">
                          Break down this POAM into manageable milestones to track progress effectively
                        </p>
                        {editedPOAM.milestones.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            💡 New milestones will be automatically suggested based on your timeline
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={addMilestone}
                        className="btn btn-primary btn-responsive flex items-center gap-2"
                        disabled={!editedPOAM.startDate || !editedPOAM.endDate}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Milestone
                      </button>
                    </div>

                    {editedPOAM.milestones.length === 0 ? (
                      <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-medium text-foreground mb-2">No milestones yet</h4>
                        <p className="text-muted-foreground mb-4">
                          Break down this POAM into manageable milestones to track progress effectively.
                        </p>
                        {editedPOAM.startDate && editedPOAM.endDate ? (
                          <button
                            type="button"
                            onClick={addMilestone}
                            className="btn btn-primary"
                          >
                            Create First Milestone
                          </button>
                                                 ) : (
                           <p className="text-sm text-muted-foreground">
                             Set POAM start and end dates in the Details tab to begin creating milestones.
                           </p>
                         )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {editedPOAM.milestones
                          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                          .map((milestone, index) => {
                            const validation = validateMilestoneDate(milestone.dueDate);
                            
                            return (
                              <div 
                                key={milestone.id} 
                                data-milestone-index={index}
                                className={`bg-card border rounded-lg p-6 ${
                                  !validation.isValid ? 'border-destructive bg-destructive/5' : 'border-border'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                        <span className="text-sm font-semibold text-primary">{index + 1}</span>
                                      </div>
                                      <div>
                                        <h4 className="font-medium text-foreground">Milestone {index + 1}</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {milestone.dueDate ? 
                                            `Due ${new Date(milestone.dueDate).toLocaleDateString('en-US', { 
                                              month: 'short', 
                                              day: 'numeric',
                                              year: 'numeric'
                                            })}` : 
                                            'Due date not set'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeMilestone(index)}
                                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                    title="Remove milestone"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                
                                {!validation.isValid && (
                                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                    <div className="flex items-center gap-2 text-destructive text-sm">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                      {validation.message}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                      Title <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={milestone.title}
                                      onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                                      placeholder="e.g., Complete security assessment"
                                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                                    />
                                  </div>
                                  
                                                                     <div>
                                     <label className="block text-sm font-medium text-foreground mb-2">
                                       Due Date <span className="text-destructive">*</span>
                                     </label>
                                     <SimpleDateInput
                                       value={milestone.dueDate}
                                       onChange={(value) => updateMilestone(index, 'dueDate', value)}
                                       min={getMinimumDateForMilestone(index)}
                                       max={editedPOAM.endDate}
                                       className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 ${
                                         !validation.isValid ? 'border-destructive' : 'border-input'
                                       }`}
                                     />
                                     {editedPOAM.startDate && editedPOAM.endDate && (() => {
                                       const minDate = getMinimumDateForMilestone(index);
                                       const minDateFormatted = minDate ? new Date(minDate).toLocaleDateString() : new Date(editedPOAM.startDate).toLocaleDateString();
                                       const maxDateFormatted = new Date(editedPOAM.endDate).toLocaleDateString();
                                       
                                       // Find if there's a previous milestone
                                       const sortedMilestones = [...editedPOAM.milestones]
                                         .map((m, i) => ({ ...m, originalIndex: i }))
                                         .sort((a, b) => new Date(a.dueDate || '1900-01-01').getTime() - new Date(b.dueDate || '1900-01-01').getTime());
                                       const currentInSorted = sortedMilestones.find(m => m.originalIndex === index);
                                       const currentSortedIndex = currentInSorted ? sortedMilestones.indexOf(currentInSorted) : -1;
                                       const previousMilestone = currentSortedIndex > 0 ? sortedMilestones[currentSortedIndex - 1] : null;
                                       
                                       return (
                                         <p className="text-xs text-muted-foreground mt-1">
                                           {previousMilestone ? (
                                             <>Must be after <span className="font-medium">Milestone {previousMilestone.originalIndex + 1}</span> ({new Date(previousMilestone.dueDate).toLocaleDateString()}) and before {maxDateFormatted}</>
                                           ) : (
                                             <>Must be between {minDateFormatted} and {maxDateFormatted}</>
                                           )}
                                         </p>
                                       );
                                     })()}
                                   </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                      Status
                                    </label>
                                    <select
                                      value={milestone.status}
                                      onChange={(e) => updateMilestone(index, 'status', e.target.value)}
                                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                                    >
                                      <option value="Not Started">Not Started</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Delayed">Delayed</option>
                                    </select>
                                    <div className="mt-2">
                                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                        milestone.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                        milestone.status === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                        milestone.status === 'Delayed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                      }`}>
                                        {milestone.status}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                      Description
                                    </label>
                                    <textarea
                                      value={milestone.description}
                                      onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                                      rows={3}
                                      placeholder="Describe what needs to be accomplished for this milestone, deliverables, and success criteria"
                                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        
                        {/* Add Milestone button at the bottom if there are existing milestones */}
                        {editedPOAM.milestones.length > 0 && (
                          <div className="flex justify-center pt-4">
                            <button
                              type="button"
                              onClick={addMilestone}
                              className="btn btn-outline flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add Another Milestone
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              }
            ]}
            activeTabId={activeTab}
            onTabChange={setActiveTab}
          />
          </form>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No POAM selected for editing.</p>
        </div>
      )}
    </div>
  );
} 