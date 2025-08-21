import { useState, useEffect } from 'react';
import { Shield, BookOpen, Link, Search, Upload, Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useToast } from '../../context/ToastContext';
import GroupNistCatalog from './GroupNistCatalog';
import GroupBaselineControls from './GroupBaselineControls';
import GroupControlAssociations from './GroupControlAssociations';
import { NistControl } from './types';
import catalogData from './catalog.json';

interface GroupBaselineControl {
  id: string;
  family: string;
  title: string;
  implementation_status: string;
  date_added: string;
  responsible_party?: string;
  notes?: string;
  group_id: string;
}

interface ControlImplementationStatus {
  control_id: string;
  implementation_status: string;
  compliance_percentage: number;
  total_findings: number;
  open_findings: number;
  not_applicable_findings: number;
  compliant_findings: number;
  mapped_ccis: string[];
  affected_systems: string[];
  last_assessed?: string;
}

interface ControlComplianceAnalysis {
  group_id: string;
  total_controls: number;
  controls_with_mappings: number;
  fully_compliant: number;
  partially_compliant: number;
  non_compliant: number;
  not_assessed: number;
  control_statuses: ControlImplementationStatus[];
}

interface GroupNistControlsProps {
  groupId: string;
  systems: any[];
}

export default function GroupNistControls({ groupId, systems }: GroupNistControlsProps) {
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [controls, setControls] = useState<NistControl[]>([]);
  const [baselineControls, setBaselineControls] = useState<GroupBaselineControl[]>([]);
  const [controlStatuses, setControlStatuses] = useState<ControlImplementationStatus[]>([]);
  const [hasCciMappings, setHasCciMappings] = useState(false);
  const [isUploadingCci, setIsUploadingCci] = useState(false);
  
  const { showToast } = useToast();

  // Load NIST controls data
  useEffect(() => {
    if (groupId) {
      loadNistControlsData();
    }
  }, [groupId]);

  const loadNistControlsData = async () => {
    setIsLoading(true);
    try {
      // Load NIST 800-53 controls from the catalog.json file
      const nistControls = await loadNistControlsFromCatalog();
      setControls(nistControls);
      
      // Load any saved baseline controls for this group
      const savedBaseline = await loadSavedGroupBaselineControls();
      setBaselineControls(savedBaseline);
      
      // Check for CCI mappings and load control implementation status
      await loadControlImplementationStatus();
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading NIST controls:', error);
      showToast('error', 'Failed to load NIST controls data. Please try again.');
      setIsLoading(false);
    }
  };

  const loadControlImplementationStatus = async () => {
    try {
      const analysis = await invoke<ControlComplianceAnalysis>('analyze_control_compliance', { groupId });
      setControlStatuses(analysis.control_statuses);
      setHasCciMappings(analysis.controls_with_mappings > 0);
    } catch (error) {
      console.log('No CCI mappings found for this group - upload U_CCI_List.xml to enable implementation status detection');
      setHasCciMappings(false);
    }
  };

  const handleUploadCciList = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'CCI List',
          extensions: ['xml']
        }]
      });

      if (selected) {
        setIsUploadingCci(true);
        const result = await invoke<string>('upload_cci_list', { 
          filePath: selected, 
          groupId 
        });
        
        showToast('success', result);
        
        // Reload control implementation status
        await loadControlImplementationStatus();
        
        setIsUploadingCci(false);
      }
    } catch (error) {
      console.error('Failed to upload CCI list:', error);
      showToast('error', 'Failed to upload CCI list. Please ensure the file is a valid U_CCI_List.xml file.');
      setIsUploadingCci(false);
    }
  };

  const loadNistControlsFromCatalog = async (): Promise<NistControl[]> => {
    // Process the imported catalog data into our NistControl format
    const controls: NistControl[] = [];
    
    try {
      // The catalog is structured as an object with control IDs as keys
      Object.entries(catalogData).forEach(([id, controlData]: [string, any]) => {
        // Extract family from the ID (e.g., 'AC' from 'AC-1')
        const family = id.split('-')[0];
        
        // Determine impact levels based on common patterns
        // This is a simplification - in a real system you might have mapping data
        let impact: ('LOW' | 'MODERATE' | 'HIGH')[] = [];
        
        // Simplified impact assignment - adjust as needed for accuracy
        // Basic control (e.g. AC-1) typically applies to all impact levels
        if (!id.includes('(')) {
          impact = ['LOW', 'MODERATE', 'HIGH'];
        } 
        // Enhancement often starts at MODERATE
        else if (id.match(/\(\d+\)$/)) {
          impact = ['MODERATE', 'HIGH'];
        }
        // Higher numbered enhancements often only at HIGH
        else if (parseInt(id.match(/\((\d+)\)$/)?.[1] || '0') > 10) {
          impact = ['HIGH'];
        }
        
        // Create the control object
        const control: NistControl = {
          id,
          family,
          title: controlData.name,
          controlText: controlData.controlText || '',
          discussion: controlData.discussion || '',
          relatedControls: controlData.relatedControls || [],
          impact,
          ccis: controlData.ccis
        };
        
        controls.push(control);
      });
      
      // Sorting will be handled where displayed using a shared comparator
      
      return controls;
    } catch (error) {
      console.error('Error processing NIST catalog:', error);
      throw error;
    }
  };

  const loadSavedGroupBaselineControls = async (): Promise<GroupBaselineControl[]> => {
    try {
      console.log('Loading group baseline controls for group:', groupId);
      const savedControls = await invoke<GroupBaselineControl[]>('get_group_baseline_controls', { 
        groupId 
      });
      console.log('Loaded group baseline controls:', savedControls);
      return savedControls || [];
    } catch (error) {
      console.error('Error loading saved group baseline controls:', error);
      return [];
    }
  };

  const handleAddToBaseline = async (controlId: string) => {
    try {
      // Find the control in our catalog
      const control = controls.find(c => c.id === controlId);
      if (!control) {
        showToast('error', 'Control not found in catalog');
        return;
      }

      // Check if already in baseline
      if (baselineControls.some(bc => bc.id === controlId)) {
        showToast('warning', 'Control is already in your baseline');
        return;
      }

      const groupBaselineControl: GroupBaselineControl = {
        id: controlId,
        family: control.family,
        title: control.title,
        implementation_status: 'Not Implemented',
        date_added: new Date().toISOString(),
        responsible_party: '',
        notes: '',
        group_id: groupId,
      };

      await invoke('add_group_baseline_control', { control: groupBaselineControl });
      
      // Update local state
      setBaselineControls(prev => [...prev, groupBaselineControl]);
      showToast('success', `Added ${controlId} to group baseline`);
      
    } catch (error) {
      console.error('Error adding control to group baseline:', error);
      showToast('error', 'Failed to add control to group baseline');
    }
  };

  const handleRemoveFromBaseline = async (controlId: string) => {
    try {
      await invoke('remove_group_baseline_control', { 
        controlId, 
        groupId 
      });
      
      // Update local state
      setBaselineControls(prev => prev.filter(bc => bc.id !== controlId));
      showToast('success', `Removed ${controlId} from group baseline`);
      
    } catch (error) {
      console.error('Error removing control from group baseline:', error);
      showToast('error', 'Failed to remove control from group baseline');
    }
  };

  const handleUpdateControl = async (control: GroupBaselineControl) => {
    try {
      await invoke('update_group_baseline_control', { control });
      
      // Update local state
      setBaselineControls(prev => 
        prev.map(bc => bc.id === control.id ? control : bc)
      );
      showToast('success', `Updated ${control.id} in group baseline`);
      
    } catch (error) {
      console.error('Error updating group baseline control:', error);
      showToast('error', 'Failed to update group baseline control');
    }
  };

  // Filter controls based on search query
  const filteredControls = controls.filter(control => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      control.id.toLowerCase().includes(query) ||
      control.title.toLowerCase().includes(query) ||
      control.family.toLowerCase().includes(query) ||
      control.controlText.toLowerCase().includes(query) ||
      control.discussion.toLowerCase().includes(query)
    );
  });

  const baselineControlIds = baselineControls.map(bc => bc.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold flex items-center gap-2 title-row">
            <Shield className="w-8 h-8" />
            Group NIST Controls
          </h1>
          <p className="text-muted-foreground">
            Manage NIST 800-53 controls at the group level for consistent security posture
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search by control ID, title, family, or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredControls.length} controls matching your search
          </p>
        </CardContent>
      </Card>

      {/* CCI Mapping Status & Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Implementation Status Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasCciMappings ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  <Activity className="w-3 h-3 mr-1" />
                  CCI Mappings Active
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {controlStatuses.length} controls with implementation status detected
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {controlStatuses.filter(c => c.implementation_status === 'Implemented').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Implemented</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {controlStatuses.filter(c => c.implementation_status === 'Partially Implemented').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Partial</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {controlStatuses.filter(c => c.implementation_status === 'Not Implemented').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Not Implemented</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {controlStatuses.filter(c => c.implementation_status === 'Not Assessed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Not Assessed</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm">
                  Upload U_CCI_List.xml to enable automatic implementation status detection based on STIG findings
                </span>
              </div>
              
              <Button 
                onClick={handleUploadCciList}
                disabled={isUploadingCci}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isUploadingCci ? 'Uploading...' : 'Upload U_CCI_List.xml'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            NIST Catalog
          </TabsTrigger>
          <TabsTrigger value="baseline" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Group Baseline ({baselineControls.length})
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Implementation Status
          </TabsTrigger>
          <TabsTrigger value="associations" className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            POAM Associations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <GroupNistCatalog
            controls={filteredControls}
            isLoading={isLoading}
            onAddToBaseline={handleAddToBaseline}
            baselineControlIds={baselineControlIds}
          />
        </TabsContent>

        <TabsContent value="baseline">
          <GroupBaselineControls
            controls={baselineControls}
            isLoading={isLoading}
            onRemoveControl={handleRemoveFromBaseline}
            onUpdateControl={handleUpdateControl}
            setActiveTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="status">
          {hasCciMappings ? (
            <Card>
              <CardHeader>
                <CardTitle>Control Implementation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {controlStatuses.map((status) => (
                    <div key={status.control_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{status.control_id}</span>
                          <Badge 
                            variant={
                              status.implementation_status === 'Implemented' ? 'default' :
                              status.implementation_status === 'Partially Implemented' ? 'secondary' :
                              status.implementation_status === 'Not Implemented' ? 'destructive' :
                              'outline'
                            }
                          >
                            {status.implementation_status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {status.compliance_percentage.toFixed(1)}% compliant
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Findings:</span>
                          <span className="ml-1 font-medium">{status.total_findings}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Open:</span>
                          <span className="ml-1 font-medium text-red-600">{status.open_findings}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Compliant:</span>
                          <span className="ml-1 font-medium text-green-600">{status.compliant_findings}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">N/A:</span>
                          <span className="ml-1 font-medium text-gray-600">{status.not_applicable_findings}</span>
                        </div>
                      </div>
                      
                      {status.affected_systems.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-muted-foreground">Affected Systems: </span>
                          {status.affected_systems.map((system, index) => (
                            <Badge key={index} variant="outline" className="mr-1">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {status.mapped_ccis.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-muted-foreground">Mapped CCIs: </span>
                          <span className="text-sm">{status.mapped_ccis.slice(0, 3).join(', ')}</span>
                          {status.mapped_ccis.length > 3 && (
                            <span className="text-sm text-muted-foreground"> +{status.mapped_ccis.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Implementation Status Available</h3>
                <p className="text-muted-foreground mb-4">
                  Upload U_CCI_List.xml to enable automatic implementation status detection based on STIG findings.
                </p>
                <Button onClick={handleUploadCciList} disabled={isUploadingCci}>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploadingCci ? 'Uploading...' : 'Upload U_CCI_List.xml'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="associations">
          <GroupControlAssociations
            groupId={groupId}
            baselineControls={baselineControls}
            systems={systems}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
