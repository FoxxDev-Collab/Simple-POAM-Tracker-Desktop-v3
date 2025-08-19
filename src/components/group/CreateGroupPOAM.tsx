import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { SimpleDateInput } from '../common';
import TabNavigation from '../tabNavigation/TabNavigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Target, Users, Shield, CheckCircle, Plus } from 'lucide-react';
import { GroupPOAM, Milestone } from '../../types/group';

interface CreateGroupPOAMProps {
  groupId: string;
  systems: any[];
  preSelectedVulnerabilities?: any[];
  existingPOAM?: GroupPOAM | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function CreateGroupPOAM({ 
  groupId, 
  systems, 
  preSelectedVulnerabilities = [], 
  existingPOAM = null,
  onCancel, 
  onSuccess 
}: CreateGroupPOAMProps) {
  // Basic fields
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
  
  // Additional fields
  const [mitigations, setMitigations] = useState('');
  const [devicesAffected, setDevicesAffected] = useState('');
  
  // Group-specific fields
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  // NIST Controls association handled in Group NIST Catalog, not during creation
  
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic-details');
  
  const { showToast } = useToast();

  // Initialize with existing POAM data if editing
  useEffect(() => {
    if (existingPOAM) {
      setTitle(existingPOAM.title);
      setDescription(existingPOAM.description);
      setStartDate(existingPOAM.start_date);
      setEndDate(existingPOAM.end_date);
      setStatus(existingPOAM.status);
      setPriority(existingPOAM.priority);
      setRiskLevel(existingPOAM.risk_level);
      setSelectedSystemIds(existingPOAM.affected_systems || []);
      setMilestones(existingPOAM.milestones || []);
      
      // Set enhanced fields if they exist
      setResources(existingPOAM.resources || '');
      setSourceIdentifyingVulnerability(existingPOAM.source_identifying_vulnerability || '');
      setRawSeverity(existingPOAM.raw_severity || '');
      setSeverity(existingPOAM.severity || '');
      setRelevanceOfThreat(existingPOAM.relevance_of_threat || '');
      setLikelihood(existingPOAM.likelihood || '');
      setImpact(existingPOAM.impact || '');
      setResidualRisk(existingPOAM.residual_risk || '');
      setMitigations(existingPOAM.mitigations || '');
      setDevicesAffected(existingPOAM.devices_affected || '');
    }
  }, [existingPOAM]);

  // Initialize with pre-selected vulnerabilities if provided
  useEffect(() => {
    if (preSelectedVulnerabilities.length > 0) {
      const vulnTitles = preSelectedVulnerabilities.map(v => v.title).join(', ');
      const vulnSystems = [...new Set(preSelectedVulnerabilities.flatMap(v => v.affected_systems))];
      
      setTitle(`Remediate Cross-System Vulnerabilities: ${vulnTitles.substring(0, 100)}${vulnTitles.length > 100 ? '...' : ''}`);
      setDescription(`This Group POAM addresses ${preSelectedVulnerabilities.length} vulnerabilities that affect multiple systems in the group:\n\n${preSelectedVulnerabilities.map(v => `• ${v.vulnerability_id}: ${v.title}`).join('\n')}`);
      setSelectedSystemIds(vulnSystems);
      
      // Set severity based on highest severity vulnerability
      const severities = preSelectedVulnerabilities.map(v => v.severity.toLowerCase());
      if (severities.includes('critical')) {
        setSeverity('Critical');
        setRiskLevel('High');
        setPriority('High');
      } else if (severities.includes('high')) {
        setSeverity('High');
        setRiskLevel('High');
        setPriority('High');
      } else if (severities.includes('medium')) {
        setSeverity('Medium');
        setRiskLevel('Moderate');
        setPriority('Medium');
      }
    }
  }, [preSelectedVulnerabilities]);

  const toggleSelectedSystem = (systemId: string) => {
    setSelectedSystemIds(prev =>
      prev.includes(systemId) ? prev.filter(id => id !== systemId) : [...prev, systemId]
    );
  };

  // Association with controls is managed post-creation

  const addMilestone = () => {
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: '',
      dueDate: '',
      status: 'Pending',
      description: ''
    };
    setMilestones(prev => [...prev, newMilestone]);
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    setMilestones(prev => prev.map((milestone, i) => 
      i === index ? { ...milestone, [field]: value } : milestone
    ));
  };

  const removeMilestone = (index: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSystemIds.length === 0) {
      showToast('error', 'Please select at least one system for this Group POAM');
      return;
    }

    setIsSubmitting(true);

    try {
      const groupPOAM: GroupPOAM = {
        id: existingPOAM ? existingPOAM.id : Date.now(), // Use existing ID or generate new one
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        status,
        priority,
        risk_level: riskLevel,
        group_id: groupId,
        affected_systems: selectedSystemIds,
        milestones: milestones.filter(m => m.title.trim() !== ''), // Only include milestones with titles
        resources: resources || undefined,
        source_identifying_vulnerability: sourceIdentifyingVulnerability || undefined,
        raw_severity: rawSeverity || undefined,
        severity: severity || undefined,
        relevance_of_threat: relevanceOfThreat || undefined,
        likelihood: likelihood || undefined,
        impact: impact || undefined,
        residual_risk: residualRisk || undefined,
        mitigations: mitigations || undefined,
        devices_affected: devicesAffected || undefined,
      };

      if (existingPOAM) {
        // Update existing POAM
        await invoke('update_group_poam', { poam: groupPOAM });
        showToast('success', 'Group POAM updated successfully');
      } else {
        // Create new POAM
        await invoke('create_group_poam', { poam: groupPOAM });
        showToast('success', 'Group POAM created successfully');
      }

      // Associations with NIST controls are managed separately in Group NIST Catalog

      onSuccess();
    } catch (error) {
      console.error(existingPOAM ? 'Failed to update Group POAM:' : 'Failed to create Group POAM:', error);
      showToast('error', existingPOAM ? 'Failed to update Group POAM' : 'Failed to create Group POAM');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSystemName = (systemId: string) => {
    return systems.find(s => s.id === systemId)?.name || systemId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" />
            {existingPOAM ? 'Edit Group POAM' : 'Create Group POAM'}
          </h2>
          <p className="text-muted-foreground">
            {existingPOAM 
              ? 'Modify the security action item that spans multiple systems in the group'
              : 'Create a security action item that spans multiple systems in the group'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="create-group-poam-form"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (existingPOAM ? 'Updating...' : 'Creating...') 
              : (existingPOAM ? 'Update Group POAM' : 'Create Group POAM')
            }
          </Button>
        </div>
      </div>

      {/* Pre-selected Vulnerabilities Summary */}
      {preSelectedVulnerabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Selected Vulnerabilities
            </CardTitle>
            <CardDescription>
              This Group POAM will address {preSelectedVulnerabilities.length} cross-system vulnerabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preSelectedVulnerabilities.map((vuln, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <span className="font-medium">{vuln.vulnerability_id}</span>
                    <span className="text-muted-foreground ml-2">{vuln.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={vuln.severity === 'High' || vuln.severity === 'Critical' ? 'destructive' : 'default'}>
                      {vuln.severity}
                    </Badge>
                    <Badge variant="outline">
                      {vuln.affected_systems.length} systems
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} id="create-group-poam-form">
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
                        <p className="text-sm text-muted-foreground mt-1">Essential Group POAM details and description</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                            Group POAM Title <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="Enter a clear, descriptive title for this Group POAM"
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
                            rows={6}
                            required
                            placeholder="Provide a detailed description of the cross-system security issue, remediation plan, and expected outcomes across affected systems"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Include relevant details about how this issue affects multiple systems and the coordinated remediation approach
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Affected Systems Section */}
                    <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          Affected Systems
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Select which systems in the group are affected by this POAM</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {systems.map((system) => (
                          <div key={system.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                              id={`system-${system.id}`}
                              checked={selectedSystemIds.includes(system.id)}
                              onCheckedChange={() => toggleSelectedSystem(system.id)}
                            />
                            <label 
                              htmlFor={`system-${system.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="font-medium">{system.name}</div>
                              {system.description && (
                                <div className="text-sm text-muted-foreground">{system.description}</div>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      {selectedSystemIds.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                            <Users className="w-4 h-4" />
                            Selected Systems ({selectedSystemIds.length})
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedSystemIds.map(systemId => (
                              <Badge key={systemId} variant="secondary">
                                {getSystemName(systemId)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline Section */}
                    <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Timeline & Schedule
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Define project start and completion dates for all affected systems</p>
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
                          <p className="text-xs text-muted-foreground mt-1">When coordinated work begins across affected systems</p>
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
                          <p className="text-xs text-muted-foreground mt-1">Expected completion date for all affected systems</p>
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
                        <p className="text-sm text-muted-foreground mt-1">Current status, priority level, and risk assessment for the group</p>
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
                            <option value="Critical">Critical</option>
                          </select>
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
                            <option value="Critical">Critical</option>
                          </select>
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
                  {/* Risk Assessment Section */}
                  <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                    <div className="border-b border-border pb-3">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        Risk Assessment Details
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Detailed risk analysis across affected systems</p>
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
                          <option value="">Select...</option>
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
                          <option value="">Select...</option>
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                          <option value="Informational">Informational</option>
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
                          <option value="">Select...</option>
                          <option value="Very High">Very High</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
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
                          <option value="">Select...</option>
                          <option value="Very High">Very High</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                          <option value="Very Low">Very Low</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="relevanceOfThreat" className="block text-sm font-medium text-foreground mb-2">
                          Relevance of Threat
                        </label>
                        <textarea
                          id="relevanceOfThreat"
                          value={relevanceOfThreat}
                          onChange={(e) => setRelevanceOfThreat(e.target.value)}
                          rows={3}
                          placeholder="Describe how relevant this threat is to the affected systems and organization"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                      </div>

                      <div>
                        <label htmlFor="residualRisk" className="block text-sm font-medium text-foreground mb-2">
                          Residual Risk Assessment
                        </label>
                        <textarea
                          id="residualRisk"
                          value={residualRisk}
                          onChange={(e) => setResidualRisk(e.target.value)}
                          rows={3}
                          placeholder="Assess the remaining risk after proposed mitigations are implemented"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sources and Resources Section */}
                  <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                    <div className="border-b border-border pb-3">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Sources & Resources
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Vulnerability sources and required resources</p>
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
                          placeholder="e.g., Cross-system NESSUS Scan, Group Security Assessment, STIG Analysis, Compliance Audit"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Specify the assessment or process that identified this cross-system vulnerability
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
                          placeholder="e.g., Cross-functional team coordination, Shared security tools, Group-wide policy changes, Centralized training program"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Detail personnel, coordination, and resources needed for group-wide remediation
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mitigations and Devices Section */}
                  <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                    <div className="border-b border-border pb-3">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Mitigations & Affected Infrastructure
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Current mitigations and cross-system impact scope</p>
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
                          placeholder="e.g., Group-wide network segmentation, Centralized access controls, Unified monitoring across systems, Cross-system firewall rules"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Describe existing group-level controls and temporary mitigations currently in place
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
                          placeholder="e.g., Cross-system components: Load balancers (5), Shared databases (8), Common network infrastructure, All web servers in group"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          List specific devices, shared components, or infrastructure affected across multiple systems
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            
            {
              id: 'milestones',
              label: 'Milestones',
              content: (
                <div className="container-responsive p-6 space-y-8">
                  {/* Milestones Section */}
                  <div className="bg-muted/30 rounded-lg p-6 space-y-6">
                    <div className="border-b border-border pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            Group POAM Milestones
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Define key milestones for coordinated remediation across affected systems
                          </p>
                        </div>
                        <Button type="button" onClick={addMilestone} size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Milestone
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {milestones.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h4 className="text-lg font-semibold mb-2">No Milestones Added</h4>
                          <p className="text-muted-foreground mb-4">
                            Add milestones to track progress across all affected systems
                          </p>
                          <Button type="button" onClick={addMilestone}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Milestone
                          </Button>
                        </div>
                      ) : (
                        milestones.map((milestone, index) => (
                          <div key={milestone.id} className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Milestone {index + 1}</h4>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeMilestone(index)}
                              >
                                Remove
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Milestone Title <span className="text-destructive">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={milestone.title}
                                  onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                                  placeholder="e.g., Complete vulnerability assessment across all systems"
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
                                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                                  required
                                />
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Description
                                </label>
                                <textarea
                                  value={milestone.description}
                                  onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                                  rows={3}
                                  placeholder="Describe what needs to be accomplished for this milestone across all affected systems"
                                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-vertical"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
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
