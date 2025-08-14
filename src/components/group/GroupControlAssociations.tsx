import { useState, useEffect } from 'react';
import { Link, Trash2, Plus, Search, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';

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

interface GroupPOAM {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  risk_level: string;
  group_id: string;
  affected_systems: string[];
}

interface GroupControlPOAMAssociation {
  id: string;
  control_id: string;
  group_poam_id: number;
  association_date: string;
  group_id: string;
  created_by?: string;
  notes?: string;
}

interface GroupControlAssociationsProps {
  groupId: string;
  baselineControls: GroupBaselineControl[];
  systems: any[];
}

export default function GroupControlAssociations({ 
  groupId, 
  baselineControls, 
  systems 
}: GroupControlAssociationsProps) {
  const [associations, setAssociations] = useState<GroupControlPOAMAssociation[]>([]);
  const [groupPOAMs, setGroupPOAMs] = useState<GroupPOAM[]>([]);
  const [selectedControl, setSelectedControl] = useState('');
  const [selectedPOAM, setSelectedPOAM] = useState('');
  const [associationNotes, setAssociationNotes] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (groupId) {
      loadData();
    }
  }, [groupId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load group POAMs
      const poams = await invoke<GroupPOAM[]>('get_group_poams', { groupId });
      setGroupPOAMs(poams || []);

      // Load all associations for this group's controls
      const allAssociations: GroupControlPOAMAssociation[] = [];
      for (const control of baselineControls) {
        try {
          const controlAssociations = await invoke<GroupControlPOAMAssociation[]>(
            'get_group_poam_associations_by_control',
            { controlId: control.id, groupId }
          );
          allAssociations.push(...controlAssociations);
        } catch (error) {
          console.error(`Failed to load associations for control ${control.id}:`, error);
        }
      }
      setAssociations(allAssociations);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('error', 'Failed to load association data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAssociation = async () => {
    if (!selectedControl || !selectedPOAM) {
      showToast('warning', 'Please select both a control and a POAM');
      return;
    }

    setIsCreating(true);
    try {
      await invoke<string>('associate_group_poam_with_control', {
        controlId: selectedControl,
        groupPoamId: parseInt(selectedPOAM),
        groupId,
        createdBy: null,
        notes: associationNotes || null
      });

      // Reload associations
      await loadData();

      // Reset form
      setSelectedControl('');
      setSelectedPOAM('');
      setAssociationNotes('');

      showToast('success', 'Successfully created control-POAM association');
    } catch (error) {
      console.error('Failed to create association:', error);
      showToast('error', 'Failed to create association');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveAssociation = async (associationIdParam: string) => {
    if (!confirm('Are you sure you want to remove this association?')) {
      return;
    }

    try {
      await invoke('remove_group_poam_control_association', {
        associationId: associationIdParam,
        groupId
      });

      // Update local state
      setAssociations(prev => prev.filter(a => a.id !== associationIdParam));
      showToast('success', 'Association removed successfully');
    } catch (error) {
      console.error('Failed to remove association:', error);
      showToast('error', 'Failed to remove association');
    }
  };

  const getControlTitle = (controlId: string) => {
    const control = baselineControls.find(c => c.id === controlId);
    return control?.title || controlId;
  };

  const getPOAMTitle = (poamId: number) => {
    const poam = groupPOAMs.find(p => p.id === poamId);
    return poam?.title || `POAM ${poamId}`;
  };

  const getPOAMStatus = (poamId: number) => {
    const poam = groupPOAMs.find(p => p.id === poamId);
    return poam?.status || 'Unknown';
  };

  const filteredAssociations = associations.filter(association => {
    if (!searchFilter) return true;
    
    const query = searchFilter.toLowerCase();
    const controlTitle = getControlTitle(association.control_id).toLowerCase();
    const poamTitle = getPOAMTitle(association.group_poam_id).toLowerCase();
    
    return (
      association.control_id.toLowerCase().includes(query) ||
      controlTitle.includes(query) ||
      poamTitle.includes(query) ||
      (association.notes && association.notes.toLowerCase().includes(query))
    );
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'closed':
        return 'default';
      case 'in progress':
      case 'active':
        return 'secondary';
      case 'pending':
      case 'draft':
        return 'outline';
      case 'overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSystemName = (systemId: string) => {
    return systems.find(s => s.id === systemId)?.name || systemId;
  };

  return (
    <div className="space-y-6">
      {/* Create Association */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Control-POAM Association
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">NIST Control</label>
              <Select value={selectedControl} onValueChange={setSelectedControl}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a control" />
                </SelectTrigger>
                <SelectContent>
                  {baselineControls.map(control => (
                    <SelectItem key={control.id} value={control.id}>
                      {control.id} - {control.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Group POAM</label>
              <Select value={selectedPOAM} onValueChange={setSelectedPOAM}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a POAM" />
                </SelectTrigger>
                <SelectContent>
                  {groupPOAMs.map(poam => (
                    <SelectItem key={poam.id} value={poam.id.toString()}>
                      POAM {poam.id} - {poam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Association Notes (Optional)</label>
            <Textarea
              value={associationNotes}
              onChange={(e) => setAssociationNotes(e.target.value)}
              placeholder="Describe how this control relates to the POAM..."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleCreateAssociation}
            disabled={!selectedControl || !selectedPOAM || isCreating}
          >
            <Link className="w-4 h-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create Association'}
          </Button>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Associations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by control ID, POAM title, or notes..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredAssociations.length} associations
          </p>
        </CardContent>
      </Card>

      {/* Associations List */}
      <Card>
        <CardHeader>
          <CardTitle>Control-POAM Associations ({associations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading associations...</div>
            </div>
          ) : filteredAssociations.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Associations Found</h3>
              <p className="text-muted-foreground">
                {associations.length === 0 
                  ? 'Create your first control-POAM association using the form above'
                  : 'No associations match your current search'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control</TableHead>
                    <TableHead>POAM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Affected Systems</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssociations.map(association => {
                    const poam = groupPOAMs.find(p => p.id === association.group_poam_id);
                    const control = baselineControls.find(c => c.id === association.control_id);

                    return (
                      <TableRow key={association.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{association.control_id}</div>
                            <div className="text-sm text-muted-foreground">
                              {control?.title || 'Unknown Control'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">POAM {association.group_poam_id}</div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {getPOAMTitle(association.group_poam_id)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(getPOAMStatus(association.group_poam_id))}>
                            {getPOAMStatus(association.group_poam_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {poam ? (
                            <div>
                              <div className="font-medium">{poam.affected_systems.length} systems</div>
                              <div className="text-sm text-muted-foreground">
                                {poam.affected_systems.slice(0, 2).map(systemId => getSystemName(systemId)).join(', ')}
                                {poam.affected_systems.length > 2 && ` +${poam.affected_systems.length - 2} more`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(association.association_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm text-muted-foreground">
                            {association.notes || 'No notes'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAssociation(association.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
