import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { SimpleDateInput } from '../common';
import catalogData from '../nistControls/catalog.json';
import TabNavigation from '../tabNavigation/TabNavigation';

interface POAM {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  riskLevel: string;
  milestones: [];
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
  const [activeTab, setActiveTab] = useState('basic-details');
  // Associations
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [availableControls] = useState<{ id: string; title: string }[]>(
    Object.entries(catalogData as Record<string, any>).map(([id, c]: any) => ({ id, title: c?.name || id }))
  );
  const [stps, setStps] = useState<Array<{ id: string; name: string; poam_id?: number | null }>>([]);
  const [selectedStpIds, setSelectedStpIds] = useState<string[]>([]);
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

  const toggleSelectedControl = (controlId: string) => {
    setSelectedControlIds((prev) =>
      prev.includes(controlId) ? prev.filter((id) => id !== controlId) : [...prev, controlId]
    );
  };

  const toggleSelectedStp = (stpId: string) => {
    setSelectedStpIds((prev) =>
      prev.includes(stpId) ? prev.filter((id) => id !== stpId) : [...prev, stpId]
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
        milestones: [],
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
      
      // Optionally associate selected NIST controls to the created POAM
      if (selectedControlIds.length > 0) {
        await Promise.all(
          selectedControlIds.map((controlId) =>
            invoke<string>('associate_poam_with_control', {
              controlId,
              poamId: newPOAM.id,
              systemId: currentSystem.id,
              createdBy: null,
              notes: null,
            })
          )
        );
      }

      // Optionally associate selected STPs to the created POAM (by setting stp.poam_id)
      if (selectedStpIds.length > 0) {
        for (const stpId of selectedStpIds) {
          try {
            const plan = await invoke<any>('get_security_test_plan_by_id', { id: stpId, systemId: currentSystem.id });
            if (plan) {
              plan.poam_id = newPOAM.id;
              await invoke('save_security_test_plan', { plan, systemId: currentSystem.id });
            }
          } catch (_) {}
        }
      }
      // Reset associations
      setSelectedControlIds([]);
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New POAM</h1>
          <p className="text-muted-foreground">
            Plan of Action and Milestones Entry Form for {currentSystem.name}
          </p>
        </div>
        
        <div className="button-group">
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
        </div>
      </div>

      <form onSubmit={handleSubmit} id="create-poam-form">
        <TabNavigation
          tabs={[
            {
              id: 'basic-details',
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
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
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
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
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
                          value={startDate}
                          onChange={setStartDate}
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
                          value={endDate}
                          onChange={setEndDate}
                          min={startDate}
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
                      <p className="text-sm text-muted-foreground mt-1">Current status, priority level, and basic risk assessment</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
                          Current Status
                        </label>
                        <select
                          id="status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'Completed' ? 'bg-green-100 text-green-800' :
                            status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            status === 'Delayed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-foreground mb-2">
                          Priority Level
                        </label>
                        <select
                          id="priority"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            priority === 'High' ? 'bg-red-100 text-red-800' :
                            priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {priority} Priority
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="riskLevel" className="block text-sm font-medium text-foreground mb-2">
                          Risk Assessment
                        </label>
                        <select
                          id="riskLevel"
                          value={riskLevel}
                          onChange={(e) => setRiskLevel(e.target.value)}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                        >
                          <option value="Low">Low</option>
                          <option value="Moderate">Moderate</option>
                          <option value="High">High</option>
                        </select>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            riskLevel === 'High' ? 'bg-red-100 text-red-800' :
                            riskLevel === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {riskLevel} Risk
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
                      <label htmlFor="severity" className="block text-sm font-medium text-foreground mb-2">
                        Adjusted Severity
                      </label>
                      <select
                        id="severity"
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
                      <label htmlFor="relevanceOfThreat" className="block text-sm font-medium text-foreground mb-2">
                        Relevance of Threat
                      </label>
                      <select
                        id="relevanceOfThreat"
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
                      <label htmlFor="likelihood" className="block text-sm font-medium text-foreground mb-2">
                        Likelihood
                      </label>
                      <select
                        id="likelihood"
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
                      <label htmlFor="impact" className="block text-sm font-medium text-foreground mb-2">
                        Impact
                      </label>
                      <select
                        id="impact"
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
                      <label htmlFor="residualRisk" className="block text-sm font-medium text-foreground mb-2">
                        Residual Risk
                      </label>
                      <select
                        id="residualRisk"
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
                        value={sourceIdentifyingVulnerability}
                        onChange={(e) => setSourceIdentifyingVulnerability(e.target.value)}
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
                        value={resources}
                        onChange={(e) => setResources(e.target.value)}
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
                        value={mitigations}
                        onChange={(e) => setMitigations(e.target.value)}
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
                        value={devicesAffected}
                        onChange={(e) => setDevicesAffected(e.target.value)}
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

                {/* Optional Associations Section */}
                <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                  <div className="border-b border-border pb-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      Optional Associations
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Optionally associate this POAM with NIST controls and Security Test Plans</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* NIST Controls Multi-select */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">NIST Controls (optional)</label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 custom-scrollbar">
                        {availableControls.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              checked={selectedControlIds.includes(c.id)}
                              onChange={() => toggleSelectedControl(c.id)}
                            />
                            <span className="text-sm"><span className="font-medium">{c.id}</span> — {c.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* STPs Multi-select */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Security Test Plans (optional)</label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 custom-scrollbar">
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
                    </div>
                  </div>
                </div>
              </div>
            )
          }
        ]}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />
      </form>
    </div>
  );
}