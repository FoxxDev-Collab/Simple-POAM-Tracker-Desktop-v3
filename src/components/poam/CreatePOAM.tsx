import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { SimpleDateInput } from '../common';
import { Button } from '../ui/button';

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

interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
}

export default function CreatePOAM() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [riskLevel, setRiskLevel] = useState('Low');
  // Enhanced fields
  const [resources, setResources] = useState('');
  const [sourceIdentifyingVulnerability, setSourceIdentifyingVulnerability] = useState('');
  // Risk Analysis fields
  const [rawSeverity, setRawSeverity] = useState('');
  const [severity, setSeverity] = useState('');
  const [relevanceOfThreat, setRelevanceOfThreat] = useState('');
  const [likelihood, setLikelihood] = useState('');
  const [impact, setImpact] = useState('');
  const [residualRisk, setResidualRisk] = useState('');
  // Additional optional fields
  const [mitigations, setMitigations] = useState('');
  const [devicesAffected, setDevicesAffected] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['Select STP(s)', 'Basic Details', 'Schedule', 'Risk & Info', 'Milestones', 'Review'];
  // Associations (NIST control association is managed in the NIST Catalog, not during creation)
  const [stps, setStps] = useState<Array<{ id: string; name: string; poam_id?: number | null }>>([]);
  const [selectedStpIds, setSelectedStpIds] = useState<string[]>([]);
  const [generatedMilestones, setGeneratedMilestones] = useState<Milestone[]>([]);
  const [editingMilestones, setEditingMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<string[]>([]);
  const { showToast } = useToast();
  const { currentSystem } = useSystem();
  const { notifyPOAMCreated, notifySystemEvent } = useNotificationGenerator();
  // Load STPs for optional association
  // This list enables linking STPs to the new POAM
  if (currentSystem && stps.length === 0) {
    invoke<Array<{ id: string; name: string; poam_id?: number | null }>>('get_all_security_test_plans', { systemId: currentSystem.id })
      .then((plans) => setStps(plans || []))
      .catch(() => setStps([]));
  }

  const toggleSelectedStp = (stpId: string) => {
    setSelectedStpIds((prev) =>
      prev.includes(stpId) ? prev.filter((id) => id !== stpId) : [...prev, stpId]
    );
  };

  // Preselect STP if coming from STP view
  useEffect(() => {
    try {
      const fromId = sessionStorage.getItem('createPOAMFromSTP');
      if (fromId && selectedStpIds.length === 0) {
        setSelectedStpIds([fromId]);
        sessionStorage.removeItem('createPOAMFromSTP');
        setCurrentStep(1);
      }
    } catch (_) {}
  }, []);

  // Helper to map risk ratings to an overall
  const riskOrder: Record<string, number> = { 'Low': 1, 'Moderate': 2, 'Medium': 2, 'High': 3, 'Critical': 4 };

  // Calculate reasonable milestone due dates and suggest end date adjustments
  const calculateMilestoneDueDates = (milestones: Milestone[]): Milestone[] => {
    if (milestones.length === 0) return milestones;

    const today = new Date();
    const startDateObj = startDate ? new Date(startDate) : today;
    const endDateObj = endDate ? new Date(endDate) : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days

    // Calculate minimum reasonable timeframe based on milestone count and complexity
    const baseWeeksPerMilestone = 2; // Assume 2 weeks per milestone for security work
    const minimumWeeks = Math.max(4, milestones.length * baseWeeksPerMilestone); // At least 4 weeks
    const suggestedEndDate = new Date(startDateObj.getTime() + minimumWeeks * 7 * 24 * 60 * 60 * 1000);

    // Check if current end date is unreasonable
    const currentDurationWeeks = endDate ? Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;
    
    if (!endDate || currentDurationWeeks < minimumWeeks) {
      const suggestedEndDateStr = suggestedEndDate.toISOString().split('T')[0];
      setEndDate(suggestedEndDateStr);
      showToast('info', `Suggested end date adjusted to ${suggestedEndDateStr} (${minimumWeeks} weeks) based on ${milestones.length} milestones`);
    }

    // Use the better end date for calculations
    const finalEndDate = !endDate || currentDurationWeeks < minimumWeeks ? suggestedEndDate : endDateObj;
    
    // Distribute milestones evenly across the timeframe
    const totalDuration = finalEndDate.getTime() - startDateObj.getTime();
    const milestoneInterval = totalDuration / milestones.length;

    return milestones.map((milestone, index) => {
      const milestoneDate = new Date(startDateObj.getTime() + (milestoneInterval * (index + 1)));
      return {
        ...milestone,
        dueDate: milestoneDate.toISOString().split('T')[0]
      };
    });
  };

  const canProceedFromStep = (stepIndex: number) => {
    if (stepIndex === 0) return selectedStpIds.length > 0;
    if (stepIndex === 1) return !!title && !!description;
    if (stepIndex === 2) return !!startDate && !!endDate;
    if (stepIndex === 3) return true;
    if (stepIndex === 4) return editingMilestones.length > 0;
    return true;
  };

  const generateFromSelectedSTPs = async () => {
    if (!currentSystem?.id || selectedStpIds.length === 0) return;
    try {
      // Fetch full plans to access test cases
      const plans = await Promise.all(selectedStpIds.map((id) => invoke<any>('get_security_test_plan_by_id', { id, systemId: currentSystem.id })));
      // Generate milestones from all test cases
      const milestones: Milestone[] = [];
      let highestRisk = 'Low';
      for (const plan of plans) {
        if (plan?.test_cases?.length) {
          for (const tc of plan.test_cases) {
            const ms: Milestone = {
              id: `stp-${plan.id}-tc-${tc.id}`,
              title: tc.stig_vuln_id || `Test ${tc.id}`,
              dueDate: '',
              status: 'Not Started',
              description: tc.test_description || tc.test_procedure || ''
            };
            milestones.push(ms);
            const tcRisk = (tc.risk_rating || 'Low');
            if ((riskOrder[tcRisk] || 1) > (riskOrder[highestRisk] || 1)) {
              highestRisk = tcRisk;
            }
          }
        }
      }

      // Calculate milestone due dates and suggest end date if needed
      const milestonesWithDates = calculateMilestoneDueDates(milestones);

      // Prefill title/description if empty
      if (!title) {
        const names = plans.map((p: any) => p?.name).filter(Boolean).join(', ');
        setTitle(names ? `POAM for ${names}` : 'New POAM');
      }
      if (!description) {
        setDescription('POAM generated from selected Security Test Plan(s).');
      }
      if (!sourceIdentifyingVulnerability) {
        const names = plans.map((p: any) => p?.name).filter(Boolean).join(', ');
        setSourceIdentifyingVulnerability(`Security Test Plan(s): ${names}`);
      }
      // Prefill risk based on highest test case risk
      if (!riskLevel || riskLevel === 'Low') {
        setRiskLevel(highestRisk === 'Critical' ? 'High' : highestRisk);
      }
      if (!severity) setSeverity(highestRisk);
      if (!rawSeverity) setRawSeverity(highestRisk);

      setGeneratedMilestones(milestonesWithDates);
      setEditingMilestones([...milestonesWithDates]);
      showToast('info', `Generated ${milestonesWithDates.length} milestone(s) from selected STP test cases`);
    } catch (error) {
      console.error('Failed generating from STPs', error);
      showToast('error', 'Failed to generate milestones from selected STPs');
    }
  };

  // Milestone management functions
  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    setEditingMilestones(prev => 
      prev.map(m => m.id === id ? { ...m, ...updates } : m)
    );
  };

  const deleteMilestone = (id: string) => {
    setEditingMilestones(prev => prev.filter(m => m.id !== id));
    setSelectedMilestoneIds(prev => prev.filter(mId => mId !== id));
  };

  const addMilestone = () => {
    const newMilestone: Milestone = {
      id: `manual-${Date.now()}`,
      title: 'New Milestone',
      dueDate: '',
      status: 'Not Started',
      description: ''
    };
    setEditingMilestones(prev => [...prev, newMilestone]);
  };

  const combineMilestones = () => {
    if (selectedMilestoneIds.length < 2) {
      showToast('warning', 'Select at least 2 milestones to combine');
      return;
    }

    const selectedMilestones = editingMilestones.filter(m => selectedMilestoneIds.includes(m.id));
    const combinedTitle = selectedMilestones.map(m => m.title).join(' + ');
    const combinedDescription = selectedMilestones.map(m => m.description).filter(Boolean).join('\n\n');
    
    const combinedMilestone: Milestone = {
      id: `combined-${Date.now()}`,
      title: combinedTitle,
      dueDate: '',
      status: 'Not Started',
      description: combinedDescription
    };

    // Find the position of the first selected milestone
    const firstSelectedIndex = editingMilestones.findIndex(m => selectedMilestoneIds.includes(m.id));
    
    // Create new array with combined milestone at the first selected position
    setEditingMilestones(prev => {
      const filtered = prev.filter(m => !selectedMilestoneIds.includes(m.id));
      return [
        ...filtered.slice(0, firstSelectedIndex),
        combinedMilestone,
        ...filtered.slice(firstSelectedIndex)
      ];
    });
    
    setSelectedMilestoneIds([]);
    showToast('success', `Combined ${selectedMilestones.length} milestones`);
  };

  const toggleMilestoneSelection = (id: string) => {
    setSelectedMilestoneIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to create POAMs.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedStpIds.length === 0) {
      showToast('error', 'Please select at least one Security Test Plan');
      setCurrentStep(0);
      return;
    }

    if (!title || !description || !startDate || !endDate) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create POAM object
      const newPOAM: POAM = {
        id: Date.now(), // Generate a timestamp-based ID
        title,
        description,
        startDate,
        endDate,
        status,
        priority,
        riskLevel,
        milestones: editingMilestones,
        // Enhanced fields
        resources,
        sourceIdentifyingVulnerability,
        // Risk Analysis fields
        rawSeverity,
        severity,
        relevanceOfThreat,
        likelihood,
        impact,
        residualRisk,
        // Additional optional fields
        mitigations,
        devicesAffected
      };
      
      // Use the proper create_poam command with systemId
      await invoke('create_poam', { 
        poam: newPOAM,
        systemId: currentSystem.id 
      });
      
      // Associate selected STPs to the created POAM (by setting stp.poam_id)
      for (const stpId of selectedStpIds) {
        try {
          const plan = await invoke<any>('get_security_test_plan_by_id', { id: stpId, systemId: currentSystem.id });
          if (plan) {
            plan.poam_id = newPOAM.id;
            await invoke('save_security_test_plan', { plan, systemId: currentSystem.id });
          }
        } catch (_) {}
      }
      // Reset associations
      setSelectedStpIds([]);
      
      showToast('success', `POAM created successfully for ${currentSystem.name}`);
      
      // Trigger notification for POAM creation
      notifyPOAMCreated(newPOAM);
      
      // Notify about successful creation
      notifySystemEvent({
        type: 'sync',
        message: `POAM "${title}" created successfully in ${currentSystem.name}`,
        success: true
      });
      
      // Reset form after submission
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setStatus('Not Started');
      setPriority('Medium');
      setRiskLevel('Low');
      // Reset enhanced fields
      setResources('');
      setSourceIdentifyingVulnerability('');
      // Reset Risk Analysis fields
      setRawSeverity('');
      setSeverity('');
      setRelevanceOfThreat('');
      setLikelihood('');
      setImpact('');
      setResidualRisk('');
      // Reset additional optional fields
      setMitigations('');
      setDevicesAffected('');
      
      // Reload the app to refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error creating POAM:', error);
      showToast('error', `Failed to create POAM: ${error}`);
      
      // Notify about creation failure
      notifySystemEvent({
        type: 'error',
        message: `Failed to create POAM "${title}"`,
        success: false,
        details: String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="responsive-header mb-6 pb-4 border-b border-border">
        <div className="title-row">
          <h1 className="text-3xl font-bold text-foreground">Create New POAM</h1>
          <p className="text-muted-foreground">Plan of Action and Milestones Wizard for {currentSystem.name}</p>
        </div>
        
        <div className="button-group">
          {currentStep > 0 && (
            <Button
              variant="outline"
              className="btn-responsive"
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              className="btn-responsive"
              type="button"
              onClick={async () => {
                if (!canProceedFromStep(currentStep)) {
                  showToast('warning', 'Complete required fields before continuing');
                  return;
                }
                if (currentStep === 0) {
                  await generateFromSelectedSTPs();
                } else if (currentStep === 3) {
                  // Moving to milestone step - ensure we have milestones to edit
                  if (editingMilestones.length === 0 && generatedMilestones.length > 0) {
                    setEditingMilestones([...generatedMilestones]);
                  }
                }
                setCurrentStep((s) => s + 1);
              }}
              disabled={isSubmitting}
            >
              Next
            </Button>
          ) : (
            <button
              type="submit"
              form="create-poam-form"
              className="btn btn-primary btn-responsive"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  Creating...
                </div>
              ) : (
                'Create POAM'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${idx <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/60'}`}>{idx + 1}</div>
            <span className={`${idx === currentStep ? 'text-foreground font-medium' : ''}`}>{step}</span>
            {idx < steps.length - 1 && <span className="opacity-50">→</span>}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} id="create-poam-form">
        {currentStep === 0 && (
          <div className="container-responsive p-6 space-y-8">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Select Security Test Plan(s) <span className="text-destructive">*</span></h3>
                <p className="text-sm text-muted-foreground">POAMs require at least one STP. Milestones will be generated from the test cases.</p>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md p-2 custom-scrollbar">
                {stps.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">No Security Test Plans found</div>
                ) : (
                  stps.map((plan) => (
                    <label key={plan.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedStpIds.includes(plan.id)}
                        onChange={() => toggleSelectedStp(plan.id)}
                      />
                      <span className="text-sm"><span className="font-medium">{plan.name}</span></span>
                    </label>
                  ))
                )}
              </div>
              {selectedStpIds.length === 0 && (
                <p className="text-xs text-destructive">Select at least one STP to continue.</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="container-responsive p-6 space-y-8">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Essential POAM details and description</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">POAM Title <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Enter a clear, descriptive title for this POAM"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">Description <span className="text-destructive">*</span></label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    required
                    placeholder="Provide a detailed description of scope and expected outcomes"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="container-responsive p-6 space-y-8">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Timeline & Schedule</h3>
                <p className="text-sm text-muted-foreground">Define project start and completion dates</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-2">Start Date <span className="text-destructive">*</span></label>
                  <SimpleDateInput
                    value={startDate}
                    onChange={setStartDate}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-foreground mb-2">Target Completion <span className="text-destructive">*</span></label>
                  <SimpleDateInput
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="container-responsive p-6 space-y-8">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Risk & Additional Information</h3>
                <p className="text-sm text-muted-foreground">Risk context can be prefilled from selected STPs</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Current Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Risk Assessment</label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Raw Severity</label>
                  <select
                    value={rawSeverity}
                    onChange={(e) => setRawSeverity(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Adjusted Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Relevance of Threat</label>
                  <select
                    value={relevanceOfThreat}
                    onChange={(e) => setRelevanceOfThreat(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Likelihood</label>
                  <select
                    value={likelihood}
                    onChange={(e) => setLikelihood(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Impact</label>
                  <select
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Residual Risk</label>
                  <select
                    value={residualRisk}
                    onChange={(e) => setResidualRisk(e.target.value)}
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Source Identifying Vulnerability</label>
                  <textarea
                    id="sourceIdentifyingVulnerability"
                    value={sourceIdentifyingVulnerability}
                    onChange={(e) => setSourceIdentifyingVulnerability(e.target.value)}
                    rows={3}
                    placeholder="e.g., STP names, NESSUS Scan, Manual Testing"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Resources Required</label>
                  <textarea
                    id="resources"
                    value={resources}
                    onChange={(e) => setResources(e.target.value)}
                    rows={3}
                    placeholder="e.g., Staff, budget, tools"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="container-responsive p-10 space-y-12">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Milestone Management</h3>
                <p className="text-sm text-muted-foreground">Review, edit, combine, or add new milestones before creating the POAM.</p>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button type="button" onClick={addMilestone} variant="outline" size="sm">
                  Add Milestone
                </Button>
                <Button 
                  type="button" 
                  onClick={combineMilestones} 
                  variant="outline" 
                  size="sm"
                  disabled={selectedMilestoneIds.length < 2}
                >
                  Combine Selected ({selectedMilestoneIds.length})
                </Button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                {editingMilestones.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <p>No milestones available. Go back to select STPs or add a milestone manually.</p>
                  </div>
                ) : (
                  editingMilestones.map((milestone, index) => (
                    <div key={milestone.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedMilestoneIds.includes(milestone.id)}
                          onChange={() => toggleMilestoneSelection(milestone.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        <Button
                          type="button"
                          onClick={() => deleteMilestone(milestone.id)}
                          variant="outline"
                          size="sm"
                          className="ml-auto text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                          <input
                            type="text"
                            value={milestone.title}
                            onChange={(e) => updateMilestone(milestone.id, { title: e.target.value })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                            placeholder="Milestone title"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                          <SimpleDateInput
                            value={milestone.dueDate}
                            onChange={(date) => updateMilestone(milestone.id, { dueDate: date })}
                            min={startDate}
                            max={endDate}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                        <textarea
                          value={milestone.description}
                          onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          placeholder="Milestone description or procedure"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="container-responsive p-6 space-y-8">
            <div className="bg-muted/30 rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-foreground">Review & Confirm</h3>
                <p className="text-sm text-muted-foreground">Final review of POAM with {editingMilestones.length} milestone(s).</p>
              </div>
              <ul className="text-sm space-y-1">
                <li><strong>Title:</strong> {title}</li>
                <li><strong>Dates:</strong> {startDate || 'N/A'} → {endDate || 'N/A'}</li>
                <li><strong>Risk:</strong> {riskLevel} {severity ? `(Severity: ${severity})` : ''}</li>
                <li><strong>STPs:</strong> {selectedStpIds.length}</li>
              </ul>
              <div className="max-h-64 overflow-auto border rounded p-2">
                {editingMilestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones available.</p>
                ) : (
                  editingMilestones.map((m, idx) => (
                    <div key={m.id} className="py-1 text-sm">
                      <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                      <span className="font-medium">{m.title}</span>
                      {m.dueDate && <span className="text-muted-foreground ml-2">({m.dueDate})</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}