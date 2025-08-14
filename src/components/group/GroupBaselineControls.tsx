import React, { useState } from 'react';
import { Trash2, User, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { compareNistControlIdStrings } from '../../lib/utils';

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

interface GroupBaselineControlsProps {
  controls: GroupBaselineControl[];
  isLoading: boolean;
  onRemoveControl: (controlId: string) => void;
  onUpdateControl: (control: GroupBaselineControl) => void;
  setActiveTab?: (tab: string) => void;
}

export default function GroupBaselineControls({
  controls,
  isLoading,
  onRemoveControl,
  onUpdateControl,
  setActiveTab,
}: GroupBaselineControlsProps) {
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState<Record<string, GroupBaselineControl>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: '', 
    direction: 'asc' 
  });

  const handleEditChange = (controlId: string, field: keyof GroupBaselineControl, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        [field]: value,
      }
    }));
  };

  const handleSaveEdit = (control: GroupBaselineControl) => {
    const updatedControl = editForm[control.id] || control;
    onUpdateControl(updatedControl);
    
    // Remove from edit form
    setEditForm(prev => {
      const newForm = { ...prev };
      delete newForm[control.id];
      return newForm;
    });
  };

  const handleCancelEdit = (controlId: string) => {
    setEditForm(prev => {
      const newForm = { ...prev };
      delete newForm[controlId];
      return newForm;
    });
  };

  const startEdit = (control: GroupBaselineControl) => {
    setEditForm(prev => ({
      ...prev,
      [control.id]: { ...control }
    }));
  };

  const toggleExpanded = (controlId: string) => {
    setExpandedControls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(controlId)) {
        newSet.delete(controlId);
      } else {
        newSet.add(controlId);
      }
      return newSet;
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Apply sorting
  const sortedControls = [...controls].sort((a, b) => {
    if (!sortConfig.key) return 0;

    if (sortConfig.key === 'id') {
      const cmp = compareNistControlIdStrings(a.id, b.id);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    }

    let aValue: any;
    let bValue: any;

    switch (sortConfig.key) {
      case 'family':
        aValue = a.family;
        bValue = b.family;
        break;
      case 'status':
        aValue = a.implementation_status;
        bValue = b.implementation_status;
        break;
      case 'date':
        aValue = new Date(a.date_added).getTime();
        bValue = new Date(b.date_added).getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'implemented':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'partially implemented':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'not implemented':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'planned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'not applicable':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading group baseline controls...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (controls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Group Baseline Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No Controls in Group Baseline</h3>
              <p className="text-muted-foreground mt-1">
                Add NIST controls to your group baseline from the catalog to get started.
              </p>
            </div>
            {setActiveTab && (
              <Button onClick={() => setActiveTab('catalog')}>
                Browse Control Catalog
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Group Baseline Controls ({controls.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('id')}
                  >
                    Control ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('family')}
                  >
                    Family {sortConfig.key === 'family' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date')}
                  >
                    Date Added {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedControls.map(control => {
                  const isExpanded = expandedControls.has(control.id);
                  const isEditing = editForm[control.id] !== undefined;
                  const editingControl = editForm[control.id] || control;

                  return (
                    <React.Fragment key={control.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(control.id)}
                            className="p-1 h-auto"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{control.id}</TableCell>
                        <TableCell>{control.family}</TableCell>
                        <TableCell>{control.title}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusVariant(control.implementation_status)}`}>
                            {control.implementation_status}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(control.date_added).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEdit(control)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onRemoveControl(control.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleSaveEdit(control)}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelEdit(control.id)}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Implementation Status
                                  </label>
                                  {isEditing ? (
                                    <Select
                                      value={editingControl.implementation_status}
                                      onValueChange={(value) => handleEditChange(control.id, 'implementation_status', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                                        <SelectItem value="Partially Implemented">Partially Implemented</SelectItem>
                                        <SelectItem value="Implemented">Implemented</SelectItem>
                                        <SelectItem value="Planned">Planned</SelectItem>
                                        <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className={`inline-flex px-3 py-2 rounded-md text-sm ${getStatusVariant(control.implementation_status)}`}>
                                      {control.implementation_status}
                                    </div>
                                  )}
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    <User className="w-4 h-4 inline mr-1" />
                                    Responsible Party
                                  </label>
                                  {isEditing ? (
                                    <Input
                                      value={editingControl.responsible_party || ''}
                                      onChange={(e) => handleEditChange(control.id, 'responsible_party', e.target.value)}
                                      placeholder="Enter responsible party"
                                    />
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      {control.responsible_party || 'Not specified'}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  <FileText className="w-4 h-4 inline mr-1" />
                                  Implementation Notes
                                </label>
                                {isEditing ? (
                                  <Textarea
                                    value={editingControl.notes || ''}
                                    onChange={(e) => handleEditChange(control.id, 'notes', e.target.value)}
                                    rows={3}
                                    placeholder="Enter implementation details, notes, or comments"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground bg-background p-3 rounded border">
                                    {control.notes || 'No notes provided'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
