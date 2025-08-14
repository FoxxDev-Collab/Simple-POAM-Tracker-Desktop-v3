import { useState, useEffect } from 'react';
import { Shield, BookOpen, Link, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import NistCatalog from './NistCatalog';
import BaselineControls from './BaselineControls';
import ControlAssociations from './ControlAssociations';
import { NistControl, BaselineControl } from './types';
import catalogData from './catalog.json';

export default function NistControls() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [controls, setControls] = useState<NistControl[]>([]);
  const [baselineControls, setBaselineControls] = useState<BaselineControl[]>([]);
  
  const { addToast } = useToast();
  const { currentSystem } = useSystem();

  // Load NIST controls data
  useEffect(() => {
    if (currentSystem?.id) {
      loadNistControlsData();
    }
  }, [currentSystem]);

  const loadNistControlsData = async () => {
    setIsLoading(true);
    try {
      // Load NIST 800-53 controls from the catalog.json file
      const nistControls = await loadNistControlsFromCatalog();
      setControls(nistControls);
      
      // Load any saved baseline controls for this system
      const savedBaseline = await loadSavedBaselineControls();
      setBaselineControls(savedBaseline);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading NIST controls:', error);
      addToast('Failed to load NIST controls data. Please try again.', 'error');
      setIsLoading(false);
    }
  };

  const loadNistControlsFromCatalog = async (): Promise<NistControl[]> => {
    // Process the imported catalog data into our NistControl format
    const controls: NistControl[] = [];
    
    try {
      // The catalog is structured as an object with control IDs as keys
      Object.entries(catalogData).forEach(([id, controlData]) => {
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
      
      // Sort controls by ID using a natural sort algorithm
      controls.sort((a, b) => {
        const aParts = a.id.split(/[-()]/).filter(p => p);
        const bParts = b.id.split(/[-()]/).filter(p => p);
        
        const familyCompare = aParts[0].localeCompare(bParts[0]);
        if (familyCompare !== 0) return familyCompare;

        const aNum = parseInt(aParts[1]);
        const bNum = parseInt(bParts[1]);
        if (aNum !== bNum) return aNum - bNum;

        // Handle enhancements (e.g., AC-2 (1))
        const aEnh = aParts.length > 2 ? parseInt(aParts[2]) : -1;
        const bEnh = bParts.length > 2 ? parseInt(bParts[2]) : -1;
        return aEnh - bEnh;
      });
      
      return controls;
    } catch (error) {
      console.error('Error processing catalog data:', error);
      return [];
    }
  };

  const loadSavedBaselineControls = async (): Promise<BaselineControl[]> => {
    if (!currentSystem?.id) {
      return [];
    }
    
    try {
      // Fetch baseline controls from the backend database
      const savedControls = await invoke('get_baseline_controls', {
        systemId: currentSystem.id
      }) as any[];
      
      console.log('Loaded baseline controls from backend:', savedControls);
      
      // Convert snake_case fields from Rust to camelCase for TypeScript
      const convertedControls: BaselineControl[] = savedControls.map(control => ({
        id: control.id,
        family: control.family,
        title: control.title,
        implementationStatus: control.implementation_status,
        dateAdded: control.date_added,
        responsibleParty: control.responsible_party,
        notes: control.notes
      }));
      
      return convertedControls || [];
    } catch (error) {
      console.error('Error loading baseline controls:', error);
      addToast('Failed to load baseline controls from the database', 'error');
      return [];
    }
  };

  const handleAddToBaseline = async (controlId: string) => {
    if (!currentSystem?.id) {
      addToast('Please select a system first', 'error');
      return;
    }

    // Find the control in the catalog
    const controlToAdd = controls.find(c => c.id === controlId);
    if (!controlToAdd) return;

    // Check if it's already in the baseline
    if (baselineControls.some(bc => bc.id === controlId)) {
      addToast(`Control ${controlId} is already in your baseline.`, 'info');
      return;
    }

    try {
      // Create new baseline control object
      const newBaselineControl: BaselineControl = {
        id: controlToAdd.id,
        family: controlToAdd.family,
        title: controlToAdd.title,
        implementationStatus: 'Not Implemented',
        dateAdded: new Date().toISOString(),
        responsibleParty: '',
        notes: ''
      };

      // Convert to snake_case for Rust backend
      const backendControl = {
        id: newBaselineControl.id,
        family: newBaselineControl.family,
        title: newBaselineControl.title,
        implementation_status: newBaselineControl.implementationStatus,
        date_added: newBaselineControl.dateAdded,
        responsible_party: newBaselineControl.responsibleParty,
        notes: newBaselineControl.notes,
        system_id: currentSystem.id
      };

      // Save to backend
      await invoke('add_baseline_control', {
        systemId: currentSystem.id,
        control: backendControl
      });

      // Update state
      setBaselineControls(prev => [...prev, newBaselineControl]);
      addToast(`Added ${controlId} to your baseline controls.`, 'success');
    } catch (error) {
      console.error('Error adding control to baseline:', error);
      addToast(`Failed to add ${controlId} to baseline: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleRemoveFromBaseline = async (controlId: string) => {
    if (!currentSystem?.id) {
      addToast('Please select a system first', 'error');
      return;
    }

    try {
      // Remove from backend
      await invoke('remove_baseline_control', {
        systemId: currentSystem.id,
        controlId
      });

      // Update state
      setBaselineControls(prev => prev.filter(c => c.id !== controlId));
      addToast(`Removed ${controlId} from your baseline controls.`, 'info');
    } catch (error) {
      console.error('Error removing control from baseline:', error);
      addToast(`Failed to remove ${controlId} from baseline: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleUpdateBaselineControl = async (updatedControl: BaselineControl) => {
    if (!currentSystem?.id) {
      addToast('Please select a system first', 'error');
      return;
    }

    try {
      // Convert to snake_case for Rust backend
      const backendControl = {
        id: updatedControl.id,
        family: updatedControl.family,
        title: updatedControl.title,
        implementation_status: updatedControl.implementationStatus,
        date_added: updatedControl.dateAdded,
        responsible_party: updatedControl.responsibleParty,
        notes: updatedControl.notes,
        system_id: currentSystem.id
      };

      // Update in backend
      await invoke('update_baseline_control', {
        systemId: currentSystem.id,
        control: backendControl
      });

      // Update state
      setBaselineControls(prev => 
        prev.map(c => c.id === updatedControl.id ? updatedControl : c)
      );
      addToast(`Updated control ${updatedControl.id}.`, 'success');
    } catch (error) {
      console.error('Error updating baseline control:', error);
      addToast(`Failed to update ${updatedControl.id}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const filteredControls = controls.filter(control => 
    control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    control.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    control.controlText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    control.discussion.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBaselineControls = baselineControls.filter(control =>
    control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    control.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (control.notes && control.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> NIST Controls
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search controls..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="catalog" className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" /> Catalog
          </TabsTrigger>
          <TabsTrigger value="baseline" className="flex items-center gap-1">
            <Shield className="h-4 w-4" /> Baseline Controls
          </TabsTrigger>
          <TabsTrigger value="associations" className="flex items-center gap-1">
            <Link className="h-4 w-4" /> Associations
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>NIST 800-53 Controls Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <NistCatalog 
                controls={filteredControls} 
                isLoading={isLoading} 
                onAddToBaseline={handleAddToBaseline}
                baselineControlIds={baselineControls.map(c => c.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="baseline" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Baseline Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <BaselineControls 
                controls={filteredBaselineControls}
                isLoading={isLoading}
                onRemoveControl={handleRemoveFromBaseline}
                onUpdateControl={handleUpdateBaselineControl}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="associations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Control Associations</CardTitle>
            </CardHeader>
            <CardContent>
              <ControlAssociations 
                baselineControls={baselineControls}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
