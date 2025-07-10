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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { BaselineControl, ControlFamily } from './types';

interface BaselineControlsProps {
  controls: BaselineControl[];
  isLoading: boolean;
  onRemoveControl: (controlId: string) => void;
  onUpdateControl: (control: BaselineControl) => void;
  setActiveTab?: (tab: string) => void;
}

export default function BaselineControls({
  controls,
  isLoading,
  onRemoveControl,
  onUpdateControl,
  setActiveTab,
}: BaselineControlsProps) {
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState<Record<string, BaselineControl>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: '', 
    direction: 'asc' 
  });

  const handleEditChange = (controlId: string, field: keyof BaselineControl, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        [field]: value,
      },
    }));
  };

  const toggleControlExpansion = (control: BaselineControl) => {
    const newSet = new Set(expandedControls);
    if (newSet.has(control.id)) {
      newSet.delete(control.id);
    } else {
      newSet.add(control.id);
      // Initialize form state when expanding
      setEditForm(prev => ({
        ...prev,
        [control.id]: control,
      }));
    }
    setExpandedControls(newSet);
  };

  const handleCancelEdit = (controlId: string) => {
    setExpandedControls(prev => {
      const newSet = new Set(prev);
      newSet.delete(controlId);
      return newSet;
    });
    setEditForm(prev => {
      const newForm = { ...prev };
      delete newForm[controlId];
      return newForm;
    });
  };

  const handleSaveEdit = (controlId: string) => {
    const controlToSave = editForm[controlId];
    if (!controlToSave) return;
    onUpdateControl(controlToSave);
    setExpandedControls(prev => {
      const newSet = new Set(prev);
      newSet.delete(controlId);
      return newSet;
    });
  };

  // Handle sorting
  const toggleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Apply sorting to controls
  let sortedControls = [...controls];
  if (sortConfig.key) {
    sortedControls.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      if (sortConfig.key === 'id') {
        const aParts = a.id.split(/[-()]/).filter(p => p);
        const bParts = b.id.split(/[-()]/).filter(p => p);
        
        const familyCompare = aParts[0].localeCompare(bParts[0]);
        if (familyCompare !== 0) return familyCompare * direction;

        const aNum = parseInt(aParts[1]);
        const bNum = parseInt(bParts[1]);
        if (aNum !== bNum) return (aNum - bNum) * direction;

        // Handle enhancements (e.g., AC-2 (1))
        const aEnh = aParts.length > 2 ? parseInt(aParts[2]) : -1;
        const bEnh = bParts.length > 2 ? parseInt(bParts[2]) : -1;
        return (aEnh - bEnh) * direction;
      }
      
      if (sortConfig.key === 'dateAdded') {
        const aDate = new Date(a.dateAdded).getTime();
        const bDate = new Date(b.dateAdded).getTime();
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      const aValue = a[sortConfig.key as keyof BaselineControl];
      const bValue = b[sortConfig.key as keyof BaselineControl];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  }

  const getFamilyFullName = (familyCode: string): string => {
    return ControlFamily[familyCode as keyof typeof ControlFamily] || familyCode;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Implemented': return 'text-green-600 bg-green-50';
      case 'Partially Implemented': return 'text-amber-600 bg-amber-50';
      case 'Not Implemented': return 'text-red-600 bg-red-50';
      case 'Not Applicable': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-primary border-r-transparent align-[-0.125em]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
              Loading...
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">Loading baseline controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          {controls.length} {controls.length === 1 ? 'control' : 'controls'} in your baseline
        </div>
      </div>

      {sortedControls.length > 0 ? (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('id')}>
                  Control ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('title')}>
                  Title {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-[180px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('status')}>
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-[120px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('dateAdded')}>
                  Date Added {sortConfig.key === 'dateAdded' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-[180px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('responsibleParty')}>
                  Responsible {sortConfig.key === 'responsibleParty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="text-right w-[60px] p-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedControls.map((control) => (
                <React.Fragment key={control.id}>
                  <TableRow className="border-t border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleControlExpansion(control)}>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                          {expandedControls.has(control.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <span className="font-mono text-foreground">{control.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4" onClick={(e) => { e.stopPropagation(); toggleControlExpansion(control); }}>
                      <div>
                        <div className="font-medium text-foreground">{control.title}</div>
                        <div className="text-sm text-muted-foreground">{getFamilyFullName(control.family)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(control.implementationStatus)}`}>
                        {control.implementationStatus}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-sm">
                      {new Date(control.dateAdded).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="p-4">
                      {control.responsibleParty ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{control.responsibleParty}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRemoveControl(control.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded view */}
                  {expandedControls.has(control.id) && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0 border-t-0 bg-muted/20">
                        <div className="p-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Edit: {control.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Implementation Status</label>
                                  <Select 
                                    onValueChange={(value) => handleEditChange(control.id, 'implementationStatus', value)} 
                                    value={editForm[control.id]?.implementationStatus || ''}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Implemented">Implemented</SelectItem>
                                      <SelectItem value="Partially Implemented">Partially Implemented</SelectItem>
                                      <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                                      <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Responsible Party</label>
                                  <Input 
                                    value={editForm[control.id]?.responsibleParty || ''} 
                                    onChange={(e) => handleEditChange(control.id, 'responsibleParty', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Notes</label>
                                <Textarea 
                                  value={editForm[control.id]?.notes || ''} 
                                  onChange={(e) => handleEditChange(control.id, 'notes', e.target.value)}
                                  rows={4}
                                />
                              </div>
                            </CardContent>
                            <CardFooter className="flex justify-end space-x-2">
                              <Button variant="ghost" onClick={() => handleCancelEdit(control.id)}>Cancel</Button>
                              <Button onClick={() => handleSaveEdit(control.id)}>Save Changes</Button>
                            </CardFooter>
                          </Card>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border rounded-md py-16 px-4 bg-muted/10 text-center">
          <div className="rounded-full bg-muted/20 p-3 mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Baseline Controls Selected</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Add controls from the NIST Catalog tab to create your security baseline.  
          </p>
          <button 
            onClick={() => setActiveTab?.('catalog')}
            className="px-4 py-2 rounded border border-border hover:bg-muted transition-colors inline-flex items-center text-sm"
          >
            Go to NIST Catalog
          </button>
        </div>
      )}
    </div>
  );
}
