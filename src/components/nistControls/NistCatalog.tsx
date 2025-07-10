import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileX, Filter, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '../ui/dropdown-menu';
import { NistControl, ControlFamily } from './types';

interface NistCatalogProps {
  controls: NistControl[];
  isLoading: boolean;
  onAddToBaseline: (controlId: string) => void;
  baselineControlIds: string[];
}

export default function NistCatalog({ controls, isLoading, onAddToBaseline, baselineControlIds }: NistCatalogProps) {
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [familyFilters, setFamilyFilters] = useState<Set<string>>(new Set());
  const [impactFilters, setImpactFilters] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: '', 
    direction: 'asc' 
  });
  
  // Get unique families from controls
  const families = [...new Set(controls.map(control => control.family))].sort();

  const toggleControlExpansion = (controlId: string) => {
    const newSet = new Set(expandedControls);
    if (newSet.has(controlId)) {
      newSet.delete(controlId);
    } else {
      newSet.add(controlId);
    }
    setExpandedControls(newSet);
  };

  const toggleFamilyFilter = (family: string) => {
    const newSet = new Set(familyFilters);
    if (newSet.has(family)) {
      newSet.delete(family);
    } else {
      newSet.add(family);
    }
    setFamilyFilters(newSet);
  };

  const toggleImpactFilter = (impact: string) => {
    const newSet = new Set(impactFilters);
    if (newSet.has(impact)) {
      newSet.delete(impact);
    } else {
      newSet.add(impact);
    }
    setImpactFilters(newSet);
  };

  // Handle sorting
  const toggleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Apply filters and sorting to controls
  let filteredControls = controls.filter(control => {
    // Apply family filter
    if (familyFilters.size > 0 && !familyFilters.has(control.family)) {
      return false;
    }

    // Apply impact filter
    if (impactFilters.size > 0 && !control.impact.some(impact => impactFilters.has(impact))) {
      return false;
    }

    return true;
  });
  
  // Apply sorting
  if (sortConfig.key) {
    filteredControls = [...filteredControls].sort((a, b) => {
      if (sortConfig.key === 'id') {
        // Special handling for ID sorting to handle enhancements correctly
        const [aBase, aEnh] = a.id.split('(');
        const [bBase, bEnh] = b.id.split('(');
        const baseCompare = aBase.localeCompare(bBase);
        if (baseCompare !== 0) return sortConfig.direction === 'asc' ? baseCompare : -baseCompare;
        if (!aEnh && bEnh) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aEnh && !bEnh) return sortConfig.direction === 'asc' ? 1 : -1;
        if (!aEnh && !bEnh) return 0;
        const aNum = parseInt(aEnh);
        const bNum = parseInt(bEnh);
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      const aValue = a[sortConfig.key as keyof NistControl];
      const bValue = b[sortConfig.key as keyof NistControl];
      
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

  const getImpactBadgeClass = (impact: string): string => {
    switch (impact) {
      case 'LOW': return 'text-green-600 bg-green-50';
      case 'MODERATE': return 'text-amber-600 bg-amber-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
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
          <p className="mt-2 text-muted-foreground">Loading NIST controls catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {/* Family Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Filter className="h-4 w-4" /> Family
                {familyFilters.size > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {familyFilters.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {families.map((family) => (
                <DropdownMenuCheckboxItem
                  key={family}
                  checked={familyFilters.has(family)}
                  onCheckedChange={() => toggleFamilyFilter(family)}
                >
                  {family} - {getFamilyFullName(family)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Impact Level Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Impact
                {impactFilters.size > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {impactFilters.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={impactFilters.has('LOW')}
                onCheckedChange={() => toggleImpactFilter('LOW')}
              >
                Low
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={impactFilters.has('MODERATE')}
                onCheckedChange={() => toggleImpactFilter('MODERATE')}
              >
                Moderate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={impactFilters.has('HIGH')}
                onCheckedChange={() => toggleImpactFilter('HIGH')}
              >
                High
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="text-muted-foreground text-sm">
          {filteredControls.length} {filteredControls.length === 1 ? 'control' : 'controls'}
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('id')}>
                Control ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}  
              </TableHead>
              <TableHead className="w-[45%] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('title')}>
                Title {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}  
              </TableHead>
              <TableHead className="w-[100px] p-4 cursor-pointer hover:bg-muted/80" onClick={() => toggleSort('family')}>
                Family {sortConfig.key === 'family' && (sortConfig.direction === 'asc' ? '↑' : '↓')}  
              </TableHead>
              <TableHead className="w-[120px] p-4">Impact</TableHead>
              <TableHead className="text-right w-[100px] p-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 mb-2 text-muted-foreground/70" />
                    <p>Loading controls...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileX className="h-8 w-8 mb-2" />
                    <span className="font-medium">No controls found</span>
                    <span className="text-sm mt-1">Try adjusting your filters</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredControls.map((control) => (
                <React.Fragment key={control.id}>
                   <TableRow 
                    className="border-t border-border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleControlExpansion(control.id)}
                   >
                    <TableCell className="p-4">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                          {expandedControls.has(control.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                        <span className="font-mono text-foreground">{control.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div>
                        <div className="font-medium text-foreground">{control.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xl">
                          {control.controlText.substring(0, 100)}{control.controlText.length > 100 ? '...' : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <Badge variant="secondary" className="font-normal text-foreground/90">
                        {control.family}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {control.impact.map(impact => (
                          <span key={impact} className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactBadgeClass(impact)}`}>
                            {impact === 'LOW' ? 'Low' : impact === 'MODERATE' ? 'Moderate' : 'High'}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      {baselineControlIds.includes(control.id) ? (
                        <button
                          disabled
                          className="px-3 py-1 bg-muted text-muted-foreground rounded-md text-sm opacity-50 cursor-not-allowed"
                        >
                          Added
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToBaseline(control.id); }}
                          className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                        >
                          <Plus className="h-3.5 w-3.5 inline-block mr-1" />
                          Add
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {expandedControls.has(control.id) && (
                    <TableRow className="bg-muted/30 dark:bg-muted/10 border-b border-border">
                      <TableCell colSpan={5} className="p-4">
                        <div className="space-y-4 pb-2">
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-1">Control Text</h4>
                            <p className="text-sm text-foreground/90 p-2 bg-card dark:bg-card/80 rounded border border-border">{control.controlText}</p>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-1">Discussion</h4>
                            <p className="text-sm text-foreground/90 p-2 bg-card dark:bg-card/80 rounded border border-border">{control.discussion}</p>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-1">Related Controls</h4>
                            <div className="flex flex-wrap gap-2 p-2 bg-card dark:bg-card/80 rounded border border-border">
                              {control.relatedControls.length > 0 ? control.relatedControls.map((relatedControl) => (
                                <span key={relatedControl} className="px-2 py-1 bg-background dark:bg-background/80 border border-border rounded text-xs font-mono">
                                  {relatedControl}
                                </span>
                              )) : <span className="text-sm text-muted-foreground">None</span>}
                            </div>
                          </div>

                          {control.ccis && control.ccis.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm text-muted-foreground">Common Control Identifiers</h4>
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/20">
                                  {control.ccis.length}
                                </span>
                              </div>
                              <div className={`bg-card dark:bg-card/80 rounded border border-border ${control.ccis.length > 5 ? 'max-h-60 overflow-y-auto' : ''}`}>
                                <div className="divide-y divide-border">
                                  {control.ccis.map((cci) => (
                                    <div key={cci.cci} className="p-3">
                                      <div className="flex items-start gap-3">
                                        <span className="px-2 py-1 bg-background dark:bg-background/80 border border-border rounded text-xs font-mono shrink-0">
                                          {cci.cci}
                                        </span>
                                        <p className="text-sm text-foreground/90">{cci.definition}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
