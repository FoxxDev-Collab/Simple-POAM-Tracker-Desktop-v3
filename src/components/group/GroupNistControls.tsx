import { useState, useEffect } from 'react';
import { Shield, BookOpen, Link, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { invoke } from '@tauri-apps/api/core';
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
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading NIST controls:', error);
      showToast('error', 'Failed to load NIST controls data. Please try again.');
      setIsLoading(false);
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            NIST Catalog
          </TabsTrigger>
          <TabsTrigger value="baseline" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Group Baseline ({baselineControls.length})
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
