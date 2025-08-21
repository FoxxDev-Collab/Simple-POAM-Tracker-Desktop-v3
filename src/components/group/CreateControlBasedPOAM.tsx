import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { SimpleDateInput } from '../common';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Shield } from 'lucide-react';
import { GroupPOAM, Milestone } from '../../types/group';

interface ControlGap {
  control_id: string;
  control_title: string;
  implementation_status: string;
  affected_vulnerabilities: any[];
  gap_severity: 'Critical' | 'High' | 'Medium' | 'Low';
  remediation_priority: number;
  affected_systems: string[];
}

interface CreateControlBasedPOAMProps {
  groupId: string;
  systems: any[];
  preSelectedControlGaps?: ControlGap[];
  existingPOAM?: GroupPOAM | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function CreateControlBasedPOAM({ 
  groupId, 
  systems, 
  preSelectedControlGaps = [], 
  existingPOAM = null,
  onCancel, 
  onSuccess 
}: CreateControlBasedPOAMProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [riskLevel, setRiskLevel] = useState('Low');
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlImplementationPlan, setControlImplementationPlan] = useState('');
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);
  const [milestones] = useState<Milestone[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { showToast } = useToast();

  useEffect(() => {
    if (preSelectedControlGaps.length > 0) {
      const controlIds = preSelectedControlGaps.map(gap => gap.control_id);
      const controlTitles = preSelectedControlGaps.map(gap => gap.control_title).join(', ');
      const affectedSystems = [...new Set(preSelectedControlGaps.flatMap(gap => gap.affected_systems))];
      
      setSelectedControlIds(controlIds);
      setTitle(`Implement NIST Controls: ${controlTitles.substring(0, 80)}${controlTitles.length > 80 ? '...' : ''}`);
      
      const controlDetails = preSelectedControlGaps.map(gap => 
        `• ${gap.control_id} (${gap.control_title}): ${gap.implementation_status}`
      ).join('\n');
      
      setDescription(`Control Implementation POAM for ${preSelectedControlGaps.length} NIST 800-53 controls:\n\n${controlDetails}`);
      setSelectedSystemIds(affectedSystems);
      
      const severities = preSelectedControlGaps.map(gap => gap.gap_severity.toLowerCase());
      if (severities.includes('critical')) {
        setRiskLevel('High');
        setPriority('Critical');
      } else if (severities.includes('high')) {
        setRiskLevel('High');
        setPriority('High');
      }
    }
  }, [preSelectedControlGaps]);

  const toggleSelectedSystem = (systemId: string) => {
    setSelectedSystemIds(prev =>
      prev.includes(systemId) ? prev.filter(id => id !== systemId) : [...prev, systemId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSystemIds.length === 0) {
      showToast('error', 'Please select at least one system');
      return;
    }

    setIsSubmitting(true);

    try {
      const groupPOAM: GroupPOAM = {
        id: existingPOAM ? existingPOAM.id : Date.now(),
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        status,
        priority,
        risk_level: riskLevel,
        group_id: groupId,
        affected_systems: selectedSystemIds,
        milestones: milestones.filter(m => m.title.trim() !== ''),
      };

      let poamId: number;
      if (existingPOAM) {
        await invoke('update_group_poam', { poam: groupPOAM });
        poamId = existingPOAM.id;
        showToast('success', 'Control-based POAM updated successfully');
      } else {
        const result = await invoke<number>('create_group_poam', { poam: groupPOAM });
        poamId = result;
        showToast('success', 'Control-based POAM created successfully');
      }

      // Auto-associate with selected NIST controls
      for (const controlId of selectedControlIds) {
        try {
          await invoke('associate_group_poam_with_control', {
            controlId,
            groupPoamId: poamId,
            groupId,
            createdBy: null,
            notes: `Control implementation POAM - ${controlImplementationPlan.substring(0, 100)}`
          });
        } catch (error) {
          console.error(`Failed to associate control ${controlId}:`, error);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to create/update Control-based POAM:', error);
      showToast('error', 'Failed to save Control-based POAM');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            {existingPOAM ? 'Edit Control-based POAM' : 'Create Control-based POAM'}
          </h2>
          <p className="text-muted-foreground">
            NIST control implementation plan across multiple systems
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="control-poam-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save POAM'}
          </Button>
        </div>
      </div>

      {preSelectedControlGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Selected Control Gaps ({preSelectedControlGaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preSelectedControlGaps.map((gap, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <span className="font-medium">{gap.control_id}</span>
                    <span className="text-muted-foreground ml-2">{gap.control_title}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={gap.gap_severity === 'Critical' || gap.gap_severity === 'High' ? 'destructive' : 'default'}>
                      {gap.gap_severity}
                    </Badge>
                    <Badge variant="outline">{gap.implementation_status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} id="control-poam-form" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                POAM Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Control implementation title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Description <span className="text-destructive">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Describe the control implementation plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Implementation Plan
              </label>
              <textarea
                value={controlImplementationPlan}
                onChange={(e) => setControlImplementationPlan(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Detail the control implementation steps"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affected Systems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systems.map((system) => (
                <div key={system.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={`system-${system.id}`}
                    checked={selectedSystemIds.includes(system.id)}
                    onCheckedChange={() => toggleSelectedSystem(system.id)}
                  />
                  <label htmlFor={`system-${system.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">{system.name}</div>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline & Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <SimpleDateInput
                  value={startDate}
                  onChange={setStartDate}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <SimpleDateInput
                  value={endDate}
                  onChange={setEndDate}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Risk Level</label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
