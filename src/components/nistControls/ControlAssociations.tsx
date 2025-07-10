import { useState, useEffect } from 'react';
import { Link2, Search, ArrowUpRight, Plus, X, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
// No scroll-area component needed
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { BaselineControl, AssociatedItem } from './types';
import { useEditPOAM } from '../../App';

interface ControlAssociationsProps {
  baselineControls: BaselineControl[];
  isLoading: boolean;
}

export default function ControlAssociations({
  baselineControls,
  isLoading,
}: ControlAssociationsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [associations, setAssociations] = useState<Record<string, AssociatedItem[]>>({});
  const [poams, setPOAMs] = useState<any[]>([]);
  // Will be used when STP API is available
  const [stps /* , setSTPs */] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedControl, setSelectedControl] = useState<BaselineControl | null>(null);
  const [selectedPOAMId, setSelectedPOAMId] = useState<string>('');
  const [associationLoading, setAssociationLoading] = useState(false);
  
  const { addToast } = useToast();
  const { currentSystem } = useSystem();
  const { openEditPOAM } = useEditPOAM();

  // Load POAMs and STPs data when component mounts
  useEffect(() => {
    if (currentSystem?.id) {
      loadPOAMData();
      // Later we can add STP data loading when the API is available
      // loadSTPData();
    }
  }, [currentSystem?.id]);

  // Generate associations whenever POAMs, STPs or baseline controls change
  useEffect(() => {
    if (baselineControls.length) {
      // Create an async function inside useEffect
      const fetchAssociations = async () => {
        setLoading(true);
        try {
          await generateAssociations();
        } catch (error) {
          console.error('Error generating associations:', error);
          addToast(`Failed to generate associations: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
          setLoading(false);
        }
      };
      
      fetchAssociations();
    }
  }, [baselineControls, poams, stps, currentSystem?.id]);

  const loadPOAMData = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping POAM load');
      return;
    }

    try {
      setLoading(true);
      console.log('Loading POAMs from backend for system:', currentSystem.id);
      const data = await invoke<any[]>('get_all_poams', { systemId: currentSystem.id });
      console.log('Received POAMs from backend:', data);
      setPOAMs(data || []);
    } catch (error) {
      console.error('Error loading POAMs data:', error);
      addToast('Failed to load POAMs. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // This will be implemented when the STP API is ready
  // const loadSTPData = async () => {
  //   if (!currentSystem?.id) return;
  //   try {
  //     setLoading(true);
  //     const data = await invoke<any[]>('get_all_stps', { systemId: currentSystem.id });
  //     setSTPs(data || []);
  //   } catch (error) {
  //     console.error('Error loading STPs data:', error);
  //     addToast('Failed to load Security Test Plans. Please try again.', 'error');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const generateAssociations = async () => {
    const newAssociations: Record<string, AssociatedItem[]> = {};
    
    // Initialize with empty arrays for all baseline controls
    baselineControls.forEach(control => {
      newAssociations[control.id] = [];
    });
    
    if (currentSystem?.id) {
      // For each control, load existing manual associations from the backend
      for (const control of baselineControls) {
        try {
          console.log(`Getting POAM associations for control: ${control.id}`);
          // Get POAM associations from the backend
          const manualAssociations = await invoke('get_poam_associations_by_control', { 
            controlId: control.id,
            systemId: currentSystem.id
          }) as Array<{
            id: string;
            control_id: string;
            poam_id: number;
            association_date: string;
          }>;
          
          console.log(`Found ${manualAssociations.length} associations for control ${control.id}`);
          
          // For each association, find the corresponding POAM
          for (const assoc of manualAssociations) {
            const poam = poams.find(p => p.id === assoc.poam_id);
            if (poam) {
              newAssociations[control.id].push({
                id: assoc.id,
                type: 'POAM',
                poamId: poam.id,
                title: poam.title,
                status: poam.status,
                date: assoc.association_date
              });
            }
          }
        } catch (error) {
          console.error(`Failed to load associations for control ${control.id}:`, error);
        }
      }
    }
    
    // No automatic associations - only manual associations will be shown
    
    setAssociations(newAssociations);
  };

  const handleNavigateToItem = (item: AssociatedItem) => {
    if (item.type === 'POAM' && item.poamId !== undefined) {
      openEditPOAM(item.poamId);
      addToast(`Opening POAM #${item.poamId}`, 'info');
    } else if (item.type === 'STP') {
      // This would navigate to Security Test Plan detail
      addToast(`Security Test Plan navigation not yet implemented`, 'info');
    }
  };

  const openAssociationModal = (control: BaselineControl) => {
    setSelectedControl(control);
    setSelectedPOAMId('');
    setModalOpen(true);
  };

  const saveAssociation = async () => {
    if (!selectedControl || !selectedPOAMId || !currentSystem?.id) {
      addToast('Please select both a control and a POAM to associate', 'error');
      return;
    }

    setAssociationLoading(true);

    try {
      // Find the selected POAM for UI update
      const selectedPOAM = poams.find(p => p.id.toString() === selectedPOAMId);
      if (!selectedPOAM) {
        throw new Error('Selected POAM not found');
      }

      // Call backend API to associate POAM with control
      const associationId = await invoke('associate_poam_with_control', { 
        controlId: selectedControl.id, 
        poamId: parseInt(selectedPOAMId),
        systemId: currentSystem.id,
        createdBy: null,  // Could add user info in the future
        notes: null       // Could add notes in the future
      });
      
      // Update local state with new association
      setAssociations(prev => {
        const newAssociations = { ...prev };
        const now = new Date().toISOString();
        
        const newItem: AssociatedItem = {
          id: associationId as string,
          type: 'POAM',
          poamId: selectedPOAM.id,
          title: selectedPOAM.title,
          status: selectedPOAM.status,
          date: now
        };
        
        newAssociations[selectedControl.id] = [
          ...(newAssociations[selectedControl.id] || []),
          newItem
        ];
        
        return newAssociations;
      });

      addToast(`POAM "${selectedPOAM.title}" associated with control ${selectedControl.id}`, 'success');
      setSelectedPOAMId('');
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to associate POAM with control:', error);
      addToast(`Failed to associate POAM with control: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setAssociationLoading(false);
    }
  };

  const removeAssociation = async (controlId: string, itemId: string, itemType: string) => {
    if (!currentSystem?.id) {
      addToast('No active system selected', 'error');
      return;
    }
    
    try {
      setAssociationLoading(true);

      // Call backend API to remove association
      await invoke('remove_poam_control_association', { 
        associationId: itemId,
        systemId: currentSystem.id 
      });

      // Update local state
      const newAssociations = { ...associations };
      
      if (newAssociations[controlId]) {
        newAssociations[controlId] = newAssociations[controlId].filter(
          item => item.id !== itemId
        );
      }

      setAssociations(newAssociations);
      addToast(`${itemType} association removed successfully`, 'success');
    } catch (error) {
      console.error('Error removing association:', error);
      addToast(`Failed to remove association: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setAssociationLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    switch (status.toLowerCase()) {
      case 'ongoing':
        variant = 'default';
        break;
      case 'completed':
        variant = 'secondary';
        break;
      case 'late':
        variant = 'destructive';
        break;
    }
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const variant = type === 'POAM' ? 'default' : 'secondary';
    return <Badge variant={variant}>{type}</Badge>;
  };

  // Filter controls based on search query
  const filteredControls = baselineControls.filter(
    control =>
      control.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-2 border-b-2 border-primary animate-spin rounded-full mx-auto mb-4"></div>
          <p className="mt-2 text-muted-foreground">Loading associations...</p>
        </div>
      </div>
    );
  }

  // Count total associations
  const totalAssociations = Object.values(associations).reduce(
    (total, items) => total + items.length,
    0
  );

  // Count controls with associations
  const controlsWithAssociations = Object.keys(associations).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search controls..."
              className="pl-8 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{totalAssociations}</span> associations across{' '}
          <span className="font-medium">{controlsWithAssociations}</span> controls
        </div>
      </div>

      {filteredControls.length > 0 ? (
        <div className="space-y-6">
          {filteredControls.map((control) => (
            <Card key={control.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center text-base">
                    <Badge variant="outline" className="mr-2">
                      {control.id}
                    </Badge>
                    {control.title}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                    onClick={() => openAssociationModal(control)}
                  >
                    <Plus className="h-4 w-4" /> Associate POAM
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {associations[control.id] && associations[control.id].length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="p-4 w-[100px]">Type</TableHead>
                        <TableHead className="p-4">Item</TableHead>
                        <TableHead className="p-4 w-[180px]">Status</TableHead>
                        <TableHead className="p-4 w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {associations[control.id].map((item) => (
                        <TableRow key={`${control.id}-${item.id}`} className="hover:bg-muted/50">
                          <TableCell className="p-4">{getTypeBadge(item.type)}</TableCell>
                          <TableCell className="p-4">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.date ? (
                                <span>
                                  Associated {new Date(item.date).toLocaleDateString()}
                                </span>
                              ) : ''}
                            </div>
                          </TableCell>
                          <TableCell className="p-4">{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="p-4 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleNavigateToItem(item)}
                                title="View item"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeAssociation(control.id, item.id, item.type)}
                                title="Remove association"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center p-6 text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Link2 className="h-6 w-6" />
                    </div>
                    <h4 className="font-medium mb-1">No Associations</h4>
                    <p className="text-sm">
                      No POAMs or STPs are associated with this control.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Controls Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No controls match your search criteria.
            </p>
          </CardContent>
        </Card>
      )}

      {filteredControls.length === 0 && baselineControls.length > 0 && (
        <div className="text-center mt-4">
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            Clear Search
          </Button>
        </div>
      )}

      {baselineControls.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Baseline Controls Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Add controls to your baseline before creating associations.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Modal for creating associations */}
      {modalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div 
            className="bg-card rounded-lg shadow-xl border border-border p-6 w-[450px] max-w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Associate POAM with Control</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedControl && (
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <Badge variant="outline">{selectedControl.id}</Badge>
                <span className="text-sm text-muted-foreground">{selectedControl.title}</span>
              </div>
            )}
            
            <div className="py-4">
              <label className="block text-sm font-medium mb-2">Select a POAM to associate</label>
              <div className="max-h-[200px] overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                <div className="space-y-2">
                  {poams.length > 0 ? poams.map(poam => (
                    <div 
                      key={poam.id} 
                      className={`flex items-center p-2 border rounded-md cursor-pointer ${selectedPOAMId === poam.id.toString() ? 'border-primary bg-primary/5' : 'border-border'}`}
                      onClick={() => setSelectedPOAMId(poam.id.toString())}
                    >
                      <div className="flex-1">
                        <div className="font-medium">#{poam.id} - {poam.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Status: {getStatusBadge(poam.status)}
                        </div>
                      </div>
                      {selectedPOAMId === poam.id.toString() && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-center p-4 text-muted-foreground">
                      No POAMs found for this system
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={saveAssociation} 
                disabled={!selectedPOAMId || associationLoading}
              >
                {associationLoading ? 'Saving...' : 'Associate POAM'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
