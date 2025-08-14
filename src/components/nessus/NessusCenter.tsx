import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Shield, CheckCircle, Info, Search, Save, ChevronUp, ChevronDown, ChevronRight, Edit3, Check, X,
} from 'lucide-react';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getNessusScans, importNessusFiles, getNessusFindingsByScan, saveNessusPrepList, getAllNessusPrepLists, deleteNessusPrepList } from '../../utils/tauriApi';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
// Unified styles moved to global patterns

interface FileUploadState {
  nessusFilePath: string | null;
  nessusFileName: string | null;
  nessusLoaded: boolean;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface NessusPrepDialog {
  isOpen: boolean;
  name: string;
  description: string;
}

interface NessusPrepManagerDialog {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  prepList: any | null;
}

interface NessusPrepEditDialog {
  isOpen: boolean;
  prepList: any | null;
  name: string;
  description: string;
}

interface EditingFindingState {
  findingId: string;
  field: 'severity' | 'risk_factor' | 'synopsis' | 'solution';
  value: string;
}

interface NessusScanMeta {
  id: string;
  name: string;
  description?: string;
  imported_date: string;
  version: number;
  source_file?: string;
  scan_info: any;
}

interface NessusFinding {
  id: string;
  scan_id: string;
  plugin_id?: number;
  plugin_name?: string;
  severity?: string;
  risk_factor?: string;
  cve?: string;
  cvss_base_score?: number;
  host?: string;
  port?: number;
  protocol?: string;
  synopsis?: string;
  description?: string;
  solution?: string;
}

interface NessusAnalysisResult {
  scan_meta: NessusScanMeta;
  findings: NessusFinding[];
  summary: {
    total_findings: number;
    critical_findings: number;
    high_findings: number;
    medium_findings: number;
    low_findings: number;
    total_hosts: number;
  };
}

type SortField = 'severity' | 'host' | 'plugin_name' | 'port' | 'risk_factor';
type SortDirection = 'asc' | 'desc';

export default function NessusCenter() {
  const { currentSystem } = useSystem();
  const [fileState, setFileState] = useState<FileUploadState>({
    nessusFilePath: null,
    nessusFileName: null,
    nessusLoaded: false
  });

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to use Nessus Center functionality.</p>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<NessusAnalysisResult | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [editingFinding, setEditingFinding] = useState<EditingFindingState | null>(null);
  const [nessusPrepDialog, setNessusPrepDialog] = useState<NessusPrepDialog>({
    isOpen: false,
    name: '',
    description: ''
  });
  const { addToast } = useToast();

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);

  // Nessus Prep List Manager state
  const [nessusPrepLists, setNessusPrepLists] = useState<any[]>([]);
  
  // Persistent scans state
  const [savedScans, setSavedScans] = useState<NessusScanMeta[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [nessusPrepManager, setNessusPrepManager] = useState<NessusPrepManagerDialog>({
    isOpen: false,
    mode: 'view',
    prepList: null
  });
  const [nessusPrepEditDialog, setNessusPrepEditDialog] = useState<NessusPrepEditDialog>({
    isOpen: false,
    prepList: null,
    name: '',
    description: ''
  });



  // Load Nessus prep lists
  const loadNessusPrepLists = useCallback(async () => {
    try {
      const prepLists = await getAllNessusPrepLists(currentSystem.id);
      setNessusPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading Nessus prep lists:', error);
    }
  }, [currentSystem.id]);

  // Load saved Nessus scans and restore the most recent one on component mount
  const loadSavedScans = useCallback(async () => {
    try {
      const scans = await getNessusScans(currentSystem.id);
      setSavedScans(scans);
      
      if (scans.length > 0 && !selectedScanId) {
        // Get the most recent scan
        const mostRecent = scans[0]; // Already sorted by imported_date DESC in backend
        setSelectedScanId(mostRecent.id);
        
        // Load findings for the most recent scan
        const findings = await getNessusFindingsByScan(mostRecent.id, currentSystem.id);
        
        // Calculate summary statistics
        const summary = {
          total_findings: findings.length,
          critical_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'critical' || f.severity === '4').length,
          high_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'high' || f.severity === '3').length,
          medium_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'medium' || f.severity === '2').length,
          low_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'low' || f.severity === '1').length,
          total_hosts: new Set(findings.map(f => f.host).filter(Boolean)).size
        };
        
        const result: NessusAnalysisResult = {
          scan_meta: mostRecent,
          findings: findings as NessusFinding[],
          summary
        };
        
        setAnalysisResult(result);
        setIsProcessingComplete(true);
      }
    } catch (error) {
      console.error('Error loading saved scans:', error);
      addToast('Failed to load saved Nessus scans', 'error');
    }
  }, [currentSystem.id, selectedScanId, addToast]);

  // Handle scan selection from dropdown
  const handleScanSelection = useCallback(async (scanId: string) => {
    try {
      setLoading(true);
      setSelectedScanId(scanId);
      
      const selectedScan = savedScans.find(scan => scan.id === scanId);
      if (!selectedScan) return;
      
      // Load findings for the selected scan
      const findings = await getNessusFindingsByScan(scanId, currentSystem.id);
      
      // Calculate summary statistics
      const summary = {
        total_findings: findings.length,
        critical_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'critical' || f.severity === '4').length,
        high_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'high' || f.severity === '3').length,
        medium_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'medium' || f.severity === '2').length,
        low_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'low' || f.severity === '1').length,
        total_hosts: new Set(findings.map(f => f.host).filter(Boolean)).size
      };
      
      const result: NessusAnalysisResult = {
        scan_meta: selectedScan,
        findings: findings as NessusFinding[],
        summary
      };
      
      setAnalysisResult(result);
      setSelectedFindings(new Set()); // Reset selections
      setExpandedFindings(new Set()); // Reset expanded findings
      setIsProcessingComplete(true);
    } catch (error) {
      console.error('Error loading selected scan:', error);
      addToast('Failed to load selected scan', 'error');
    } finally {
      setLoading(false);
    }
  }, [savedScans, currentSystem.id, addToast]);

  // Load saved Nessus analyses on component mount
  useEffect(() => {
    loadNessusPrepLists();
    loadSavedScans();
  }, [loadNessusPrepLists, loadSavedScans]);

  // Handle Nessus file selection and processing
  const handleNessusFileSelect = useCallback(async () => {
    setLoading(true);
    initializeProcessingSteps();
    
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'Nessus Files', extensions: ['nessus', 'xml'] }],
        multiple: true,
      });
      
      const filePaths = Array.isArray(selected) ? selected : (selected ? [selected] : []);

      if (filePaths.length > 0) {
        console.log(`Selected ${filePaths.length} Nessus file(s):`, filePaths);
        
        // Step 1: Parse files
        updateProcessingStep('parse', 'processing', `Parsing ${filePaths.length} Nessus file(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for animation
        
      await importNessusFiles(filePaths, currentSystem.id);
        updateProcessingStep('parse', 'completed', `Parsed ${filePaths.length} Nessus file(s)`);
        
        // Step 2: Load findings
        updateProcessingStep('analyze', 'processing', 'Loading scan findings...');
        const scans = await getNessusScans(currentSystem.id);
        setSavedScans(scans); // Update saved scans list
        
        if (scans.length > 0) {
          const latestScan = scans[0]; // Most recent scan
          setSelectedScanId(latestScan.id); // Set as selected scan
          const findings = await getNessusFindingsByScan(latestScan.id, currentSystem.id);
          
          // Calculate summary statistics
          const summary = {
            total_findings: findings.length,
            critical_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'critical' || f.severity === '4').length,
            high_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'high' || f.severity === '3').length,
            medium_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'medium' || f.severity === '2').length,
            low_findings: findings.filter(f => f.risk_factor?.toLowerCase() === 'low' || f.severity === '1').length,
            total_hosts: new Set(findings.map(f => f.host).filter(Boolean)).size
          };
          
          const result: NessusAnalysisResult = {
            scan_meta: latestScan,
            findings: findings as NessusFinding[],
            summary
          };
          
          setAnalysisResult(result);
          updateProcessingStep('analyze', 'completed', `Analyzed ${findings.length} findings from ${summary.total_hosts} hosts`);
          
          // Step 3: Complete
          updateProcessingStep('complete', 'processing', 'Finalizing...');
          await new Promise(resolve => setTimeout(resolve, 200));
          updateProcessingStep('complete', 'completed', 'Ready for prep list creation');
          
          // Update file state
          setFileState({
            nessusFilePath: filePaths.join(', '),
            nessusFileName: `${filePaths.length} file(s) processed`,
            nessusLoaded: true
          });
          
          setIsProcessingComplete(true);
          setSelectedFindings(new Set()); // Reset selections
          
          addToast(`Successfully processed ${filePaths.length} Nessus file(s) with ${findings.length} findings from ${summary.total_hosts} hosts.`, 'success');
        } else {
          throw new Error('No scans found after import');
        }
      }
    } catch (error) {
      console.error('Error processing Nessus file(s):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update current processing step to error
      setProcessingSteps(prev => {
        const currentStep = prev.find(step => step.status === 'processing');
        if (currentStep) {
          return prev.map(step => 
            step.id === currentStep.id 
              ? { ...step, status: 'error', message: errorMessage }
              : step
          );
        }
        return prev;
      });
      
      addToast(`Failed to process Nessus file(s): ${errorMessage}`, 'error');
      
      setAnalysisResult(null);
      setFileState({
        nessusFilePath: null,
        nessusFileName: null,
        nessusLoaded: false
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, currentSystem.id]);

  // Update processing step status
  const updateProcessingStep = useCallback((stepId: string, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  }, []);

  // Initialize processing steps
  const initializeProcessingSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      { id: 'parse', label: 'Parsing Nessus scan files', status: 'pending' },
      { id: 'analyze', label: 'Analyzing vulnerabilities and hosts', status: 'pending' },
      { id: 'complete', label: 'Processing complete', status: 'pending' }
    ];
    setProcessingSteps(steps);
    setIsProcessingComplete(false);
  }, []);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle checkbox selection
  const handleFindingSelection = (findingId: string, checked: boolean) => {
    const newSelected = new Set(selectedFindings);
    if (checked) {
      newSelected.add(findingId);
    } else {
      newSelected.delete(findingId);
    }
    setSelectedFindings(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFindingIds = new Set(filteredAndSortedFindings.map(finding => finding.id));
      setSelectedFindings(allFindingIds);
    } else {
      setSelectedFindings(new Set());
    }
  };

  // Handle expanding/collapsing finding details
  const toggleFindingExpansion = (findingId: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(findingId)) {
      newExpanded.delete(findingId);
    } else {
      newExpanded.add(findingId);
    }
    setExpandedFindings(newExpanded);
  };

  // Handle finding editing
  const handleFindingEdit = (findingId: string, field: EditingFindingState['field'], currentValue: string) => {
    setEditingFinding({
      findingId,
      field,
      value: currentValue
    });
  };

  const handleFindingUpdate = () => {
    if (!editingFinding || !analysisResult) return;

    // Find and update the finding in the analysis result
    const updatedResult = { ...analysisResult };
    const finding = updatedResult.findings.find(f => f.id === editingFinding.findingId);
    
    if (finding) {
      // Update the field
      switch (editingFinding.field) {
        case 'severity':
          finding.severity = editingFinding.value;
          break;
        case 'risk_factor':
          finding.risk_factor = editingFinding.value;
          break;
        case 'synopsis':
          finding.synopsis = editingFinding.value;
          break;
        case 'solution':
          finding.solution = editingFinding.value;
          break;
      }

      setAnalysisResult(updatedResult);
      addToast('Finding updated successfully', 'success');
    }

    setEditingFinding(null);
  };

  const handleFindingCancel = () => {
    setEditingFinding(null);
  };

  // Handle opening Nessus prep dialog
  const handleOpenNessusPrepDialog = useCallback(() => {
    if (!analysisResult || selectedFindings.size === 0) {
      addToast('Please select at least one finding to prep for STP.', 'warning');
      return;
    }
    
    // Generate default name based on scan info and selection
    const scanName = analysisResult.scan_meta?.name || 'Unknown Scan';
    const defaultName = `Nessus Prep - ${scanName} - ${selectedFindings.size} findings`;
    
    setNessusPrepDialog({
      isOpen: true,
      name: defaultName,
      description: `Nessus prep list with ${selectedFindings.size} selected findings from ${scanName}`
    });
  }, [analysisResult, selectedFindings.size, addToast]);

  // Handle saving Nessus prep list
  const handleSaveNessusPrep = useCallback(async () => {
    if (!analysisResult || !nessusPrepDialog.name.trim() || selectedFindings.size === 0) return;

    setLoading(true);
    try {
      
      // Get selected findings
      const findingsToPrep = analysisResult.findings?.filter(finding => 
        selectedFindings.has(finding.id)
      ) || [];

      // Create Nessus prep data structure
      const nessusPrepData = {
        id: crypto.randomUUID(),
        name: nessusPrepDialog.name.trim(),
        description: nessusPrepDialog.description.trim(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        source_scan_id: savedAnalysisId || analysisResult.scan_meta.id,
        scan_info: analysisResult.scan_meta || {},
        asset_info: {
          total_hosts: analysisResult.summary.total_hosts,
          scan_name: analysisResult.scan_meta.name
        },
        prep_status: 'ready',
        selected_findings: findingsToPrep.map(finding => finding.id),
        finding_count: findingsToPrep.length,
        summary: {
          critical: findingsToPrep.filter(f => f.risk_factor?.toLowerCase() === 'critical' || f.severity === '4').length,
          high: findingsToPrep.filter(f => f.risk_factor?.toLowerCase() === 'high' || f.severity === '3').length,
          medium: findingsToPrep.filter(f => f.risk_factor?.toLowerCase() === 'medium' || f.severity === '2').length,
          low: findingsToPrep.filter(f => f.risk_factor?.toLowerCase() === 'low' || f.severity === '1').length,
        }
      };

      // Save as Nessus prep list to database
      await saveNessusPrepList(nessusPrepData, currentSystem.id);
      
      setNessusPrepDialog({ isOpen: false, name: '', description: '' });
      setSelectedFindings(new Set()); // Clear selection after saving
      
      // Refresh the prep lists
      await loadNessusPrepLists();
      
      addToast(`Nessus prep list "${nessusPrepDialog.name}" saved successfully with ${findingsToPrep.length} findings`, 'success');
    } catch (error) {
      console.error('Error saving Nessus prep list:', error);
      addToast(`Failed to save Nessus prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [analysisResult, nessusPrepDialog, selectedFindings, addToast, savedAnalysisId, currentSystem.id, loadNessusPrepLists]);

  // Handle deleting analysis and restarting process
  const handleDeleteAnalysis = useCallback(() => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this analysis and restart?'
    );
    if (!confirmDelete) return;

    // Reset all state
    setAnalysisResult(null);
    setFileState({
      nessusFilePath: null,
      nessusFileName: null,
      nessusLoaded: false
    });
    setSelectedFindings(new Set());
    setExpandedFindings(new Set());
    setEditingFinding(null);
    setFilter('');
    setIsProcessingComplete(false);
    setSavedAnalysisId(null);
    setProcessingSteps([]);
    
    addToast('Analysis deleted. Ready to start a new analysis.', 'info');
  }, [addToast]);

  // Nessus Prep List Management Functions
  const handleOpenNessusPrepManager = useCallback(() => {
    setNessusPrepManager({ isOpen: true, mode: 'view', prepList: null });
    loadNessusPrepLists();
  }, [loadNessusPrepLists]);

  const handleViewNessusPrepList = useCallback(async (prepListId: string) => {
    try {
      // Find the prep list from the loaded lists
      const prepList = nessusPrepLists.find(list => list.id === prepListId);
      if (prepList) {
        setNessusPrepManager({ isOpen: true, mode: 'view', prepList });
      } else {
        addToast('Prep list not found', 'error');
      }
    } catch (error) {
      console.error('Error loading prep list:', error);
      addToast('Failed to load prep list details', 'error');
    }
  }, [addToast, nessusPrepLists]);

  const handleEditNessusPrepList = useCallback((prepList: any) => {
    setNessusPrepEditDialog({
      isOpen: true,
      prepList,
      name: prepList.name,
      description: prepList.description || ''
    });
  }, []);

  const handleUpdateNessusPrepList = useCallback(async () => {
    if (!nessusPrepEditDialog.prepList || !nessusPrepEditDialog.name.trim()) return;

    setLoading(true);
    try {
      const updatedPrepList = {
        ...nessusPrepEditDialog.prepList,
        name: nessusPrepEditDialog.name.trim(),
        description: nessusPrepEditDialog.description.trim(),
        updated_date: new Date().toISOString()
      };

      // Re-save the prep list with updated information
      await saveNessusPrepList(updatedPrepList, currentSystem.id);
      
      setNessusPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' });
      await loadNessusPrepLists();
      
      addToast(`Nessus prep list "${nessusPrepEditDialog.name}" updated successfully`, 'success');
    } catch (error) {
      console.error('Error updating Nessus prep list:', error);
      addToast(`Failed to update Nessus prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [nessusPrepEditDialog, loadNessusPrepLists, addToast, currentSystem.id]);

  const handleDeleteNessusPrepList = useCallback(async (prepListId: string, prepListName: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the Nessus prep list "${prepListName}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteNessusPrepList(prepListId, currentSystem.id);
      await loadNessusPrepLists();
      
      addToast(`Nessus prep list "${prepListName}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting Nessus prep list:', error);
      addToast(`Failed to delete Nessus prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadNessusPrepLists, addToast, currentSystem.id]);

  // Render severity badge
  const renderSeverityBadge = (severity: string | undefined, riskFactor: string | undefined) => {
    const getSeverityConfig = (sev: string | undefined, risk: string | undefined) => {
      const riskLower = risk?.toLowerCase();
      const sevValue = sev;
      
      if (riskLower === 'critical' || sevValue === '4') {
        return { variant: 'destructive', label: 'Critical' };
      } else if (riskLower === 'high' || sevValue === '3') {
        return { variant: 'destructive', label: 'High' };
      } else if (riskLower === 'medium' || sevValue === '2') {
        return { variant: 'warning', label: 'Medium' };
      } else if (riskLower === 'low' || sevValue === '1') {
        return { variant: 'success', label: 'Low' };
      } else {
        return { variant: 'secondary', label: risk || severity || 'Info' };
      }
    };

    const config = getSeverityConfig(severity, riskFactor);

    return (
      <Badge variant={config.variant as any} className="text-xs font-medium">
        {config.label}
      </Badge>
    );
  };

  // Sort and filter findings
  const filteredAndSortedFindings = (() => {
    if (!analysisResult?.findings) return [];

    let filtered = analysisResult.findings.filter(finding => {
      if (!filter.trim()) return true;
      const searchTerm = filter.toLowerCase();
      return (
        finding.plugin_name?.toLowerCase().includes(searchTerm) ||
        finding.host?.toLowerCase().includes(searchTerm) ||
        finding.synopsis?.toLowerCase().includes(searchTerm) ||
        finding.description?.toLowerCase().includes(searchTerm) ||
        finding.cve?.toLowerCase().includes(searchTerm) ||
        finding.plugin_id?.toString().includes(searchTerm)
      );
    });

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'severity':
          const getSeverityOrder = (sev: string | undefined, risk: string | undefined) => {
            if (risk?.toLowerCase() === 'critical' || sev === '4') return 4;
            if (risk?.toLowerCase() === 'high' || sev === '3') return 3;
            if (risk?.toLowerCase() === 'medium' || sev === '2') return 2;
            if (risk?.toLowerCase() === 'low' || sev === '1') return 1;
            return 0;
          };
          aValue = getSeverityOrder(a.severity, a.risk_factor);
          bValue = getSeverityOrder(b.severity, b.risk_factor);
          break;
        case 'host':
          aValue = a.host || '';
          bValue = b.host || '';
          break;
        case 'plugin_name':
          aValue = a.plugin_name || '';
          bValue = b.plugin_name || '';
          break;
        case 'port':
          aValue = a.port || 0;
          bValue = b.port || 0;
          break;
        case 'risk_factor':
          aValue = a.risk_factor || '';
          bValue = b.risk_factor || '';
          break;
        default:
          aValue = a.plugin_name || '';
          bValue = b.plugin_name || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th 
        className="cursor-pointer hover:bg-muted/50 transition-colors bg-muted text-foreground font-semibold p-3 text-left border-b border-border"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive && (
            sortDirection === 'asc' ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </th>
    );
  };

  // Render detailed finding information for expanded findings
  const renderExpandedFindingDetails = (finding: NessusFinding) => {
    return (
      <tr className="bg-muted/30">
        <td colSpan={7} className="p-0">
          <div className="p-4 border-t border-border">
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">
                Finding Details for {finding.plugin_name || `Plugin ${finding.plugin_id}`}
              </h4>
              
              {/* Technical Details Section */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">
                  Technical Information:
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Plugin ID:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.plugin_id || 'Not Available'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">CVE:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.cve || 'None'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">CVSS Score:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.cvss_base_score || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Protocol:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.protocol || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Synopsis */}
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">Synopsis:</span>
                  {!(editingFinding?.findingId === finding.id && 
                    editingFinding?.field === 'synopsis') && (
                    <button
                      onClick={() => handleFindingEdit(finding.id, 'synopsis', finding.synopsis || '')}
                      className="text-primary hover:text-primary/80 p-1"
                      title="Edit Synopsis"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {editingFinding?.findingId === finding.id && 
                 editingFinding?.field === 'synopsis' ? (
                  <div className="mt-1">
                    <textarea
                      value={editingFinding.value}
                      onChange={(e) => setEditingFinding({ ...editingFinding, value: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      rows={3}
                      placeholder="Enter synopsis..."
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                        onClick={handleFindingUpdate}
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80"
                        onClick={handleFindingCancel}
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-foreground bg-muted p-2 rounded">
                    {finding.synopsis || 'No synopsis provided. Click edit to add synopsis.'}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mt-2">
                <span className="font-medium text-muted-foreground">Description:</span>
                <div className="mt-1 text-sm text-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                  {finding.description || 'No description available.'}
                </div>
              </div>

              {/* Editable Solution */}
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">Solution:</span>
                  {!(editingFinding?.findingId === finding.id && 
                    editingFinding?.field === 'solution') && (
                    <button
                      onClick={() => handleFindingEdit(finding.id, 'solution', finding.solution || '')}
                      className="text-primary hover:text-primary/80 p-1"
                      title="Edit Solution"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {editingFinding?.findingId === finding.id && 
                 editingFinding?.field === 'solution' ? (
                  <div className="mt-1">
                    <textarea
                      value={editingFinding.value}
                      onChange={(e) => setEditingFinding({ ...editingFinding, value: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      rows={4}
                      placeholder="Enter solution..."
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                        onClick={handleFindingUpdate}
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80"
                        onClick={handleFindingCancel}
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-foreground bg-muted p-2 rounded">
                    {finding.solution || 'No solution provided. Click edit to add solution.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
        <div className="responsive-header">
          <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon icon={Shield} size="lg" tone="primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nessus Center</h1>
            <p className="text-muted-foreground">
              Analyze and manage Nessus vulnerability scans for {currentSystem.name}
            </p>
          </div>
        </div>

        <div className="button-group">
          {analysisResult && (
            <>
              <Button
                variant="outline" 
                onClick={handleOpenNessusPrepDialog}
                disabled={loading}
                className="btn-responsive"
              >
                 <Icon icon={Save} size="sm" className="mr-2" />
                <span className="hide-mobile">Create Prep List</span>
                <span className="show-mobile">Prep</span>
          </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteAnalysis}
                className="btn-responsive"
              >
                <Icon icon={X} size="sm" className="mr-2" />
                <span className="hide-mobile">Delete Analysis</span>
                <span className="show-mobile">Delete</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Icon icon={FileText} size="md" />
          Upload Nessus Scan Files
        </h3>
        <div className={`upload-zone ${fileState.nessusLoaded ? 'uploaded' : ''}`}>
          <div className="upload-content" onClick={handleNessusFileSelect}>
            <Upload className="w-8 h-8 mb-2" />
            {fileState.nessusLoaded ? (
              <div className="text-center">
                <p className="text-success font-medium">✓ {fileState.nessusFileName}</p>
                <p className="text-sm text-muted-foreground">Analysis complete</p>
            </div>
            ) : (
              <div className="text-center">
                <p className="mb-1 text-foreground">Click to select Nessus scan file(s)</p>
                <p className="text-sm text-muted-foreground">Browse for .nessus or .xml files</p>
          </div>
            )}
          </div>
        </div>
      </div>

      {/* Scan History Section */}
      {savedScans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Scan History ({savedScans.length} scans)
          </h3>
          <div className="space-y-3">
            <select
              value={selectedScanId || ''}
              onChange={(e) => handleScanSelection(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a scan to view...</option>
              {savedScans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.name} - {new Date(scan.imported_date).toLocaleDateString()} {new Date(scan.imported_date).toLocaleTimeString()}
                </option>
              ))}
            </select>
            
            {analysisResult && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground">Current Scan: {analysisResult.scan_meta.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {new Date(analysisResult.scan_meta.imported_date).toLocaleDateString()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-foreground">{analysisResult.summary.total_findings}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-red-600">{analysisResult.summary.critical_findings}</div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-orange-600">{analysisResult.summary.high_findings}</div>
                    <div className="text-xs text-muted-foreground">High</div>
                  </div>
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-yellow-600">{analysisResult.summary.medium_findings}</div>
                    <div className="text-xs text-muted-foreground">Medium</div>
                  </div>
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-blue-600">{analysisResult.summary.low_findings}</div>
                    <div className="text-xs text-muted-foreground">Low</div>
                  </div>
                  <div className="bg-background rounded p-3 text-center border border-border">
                    <div className="font-medium text-foreground">{analysisResult.summary.total_hosts}</div>
                    <div className="text-xs text-muted-foreground">Hosts</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nessus Prep List Manager */}
      <div className="mb-8 p-6 bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Nessus Prep List Manager
          </h3>
          <Button
            onClick={handleOpenNessusPrepManager}
            variant="outline"
            size="sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Manage Lists ({nessusPrepLists.length})
          </Button>
              </div>
        
        {nessusPrepLists.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nessusPrepLists.slice(0, 6).map((prepList) => (
                <div key={prepList.id} className="bg-background border border-input rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-foreground truncate">{prepList.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {prepList.finding_count} findings
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {prepList.description || 'No description provided'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(prepList.created_date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewNessusPrepList(prepList.id)}
                        className="h-6 px-2"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditNessusPrepList(prepList)}
                        className="h-6 px-2"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {nessusPrepLists.length > 6 && (
              <div className="text-center">
                <Button
                  onClick={handleOpenNessusPrepManager}
                  variant="ghost"
                  size="sm"
                >
                  View all {nessusPrepLists.length} prep lists
                </Button>
            </div>
          )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Nessus Prep Lists Yet</p>
            <p className="text-sm">Create your first prep list by selecting findings below and clicking "Create Prep List"</p>
          </div>
        )}
      </div>

      {/* Processing Steps Animation */}
      {loading && processingSteps.length > 0 && (
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-semibold text-foreground">Processing Nessus Scan</h3>
          </div>
          <div className="space-y-3">
            {processingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                {/* Step Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.status === 'completed' 
                    ? 'bg-success/20 text-success' 
                    : step.status === 'processing'
                    ? 'bg-primary/20 text-primary'
                    : step.status === 'error'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.status === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : step.status === 'processing' ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : step.status === 'error' ? (
                    <X className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                    </div>
                
                {/* Step Content */}
                <div className="flex-1">
                  <div className={`font-medium ${
                    step.status === 'completed' 
                      ? 'text-success' 
                      : step.status === 'processing'
                      ? 'text-primary'
                      : step.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {step.label}
                          </div>
                  {step.message && (
                    <div className="text-sm text-muted-foreground">{step.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Complete Confirmation */}
      {isProcessingComplete && !loading && analysisResult && (
        <div className="mb-8 p-6 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-success/20 text-success rounded-full flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">Nessus Analysis Complete!</h3>
              <p className="text-success/90">Your Nessus scan has been processed and is ready for prep list creation.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div className="bg-card border border-border p-3 rounded">
                            <div className="font-medium text-foreground">Total Findings</div>
              <div className="text-lg font-bold text-primary">
                {analysisResult.summary?.total_findings || 0}
              </div>
                          </div>
                          <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Critical/High</div>
              <div className="text-lg font-bold text-destructive">
                {(analysisResult.summary?.critical_findings || 0) + (analysisResult.summary?.high_findings || 0)}
              </div>
                          </div>
                          <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Medium/Low</div>
              <div className="text-lg font-bold text-warning">
                {(analysisResult.summary?.medium_findings || 0) + (analysisResult.summary?.low_findings || 0)}
                          </div>
                        </div>
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Hosts Affected</div>
              <div className="text-lg font-bold text-info">
                {analysisResult.summary?.total_hosts || 0}
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded">
            <div className="text-sm text-primary">
              <strong>Next Steps:</strong> Review the findings below and use "Create Prep List" to generate test cases for vulnerability validation.
            </div>
                        </div>
                      </div>
                    )}

      {/* Simple Loading State for other operations */}
      {loading && processingSteps.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
            </div>
          )}

      {/* Results Section */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-foreground">{analysisResult.summary?.total_findings || 0}</h3>
              <p className="text-muted-foreground">Total Findings</p>
        </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-destructive">{analysisResult.summary?.critical_findings || 0}</h3>
              <p className="text-muted-foreground">Critical</p>
                </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-destructive">{analysisResult.summary?.high_findings || 0}</h3>
              <p className="text-muted-foreground">High</p>
              </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-warning">{analysisResult.summary?.medium_findings || 0}</h3>
              <p className="text-muted-foreground">Medium</p>
          </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-success">{analysisResult.summary?.low_findings || 0}</h3>
              <p className="text-muted-foreground">Low</p>
            </div>
      </div>

      {/* Selection Summary */}
          {selectedFindings.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Selection Summary
              </h3>
                  <p className="text-foreground">
                    <strong>{selectedFindings.size}</strong> finding(s) selected for prep list creation
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can save the selected findings for Security Test Plan preparation.
                  </p>
            </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOpenNessusPrepDialog}
                  disabled={loading}
                  className="ml-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Prep List
            </Button>
          </div>
        </div>
      )}

          {/* Findings Table */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Vulnerability Findings</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Filter findings..." 
                  className="w-full px-3 py-2 pl-10 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">
                      <input
                        type="checkbox"
                        checked={filteredAndSortedFindings.length > 0 && filteredAndSortedFindings.every(finding => selectedFindings.has(finding.id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="mr-2"
                      />
                      Select
                    </th>
                    {renderSortHeader('severity', 'Severity')}
                    {renderSortHeader('plugin_name', 'Plugin Name')}
                    {renderSortHeader('host', 'Host')}
                    {renderSortHeader('port', 'Port')}
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">CVE</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Synopsis</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedFindings.length > 0 ? (
                    filteredAndSortedFindings.map((finding) => (
                      <React.Fragment key={finding.id}>
                        <tr className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 border-b border-border">
                            <input
                              type="checkbox"
                              checked={selectedFindings.has(finding.id)}
                              onChange={(e) => handleFindingSelection(finding.id, e.target.checked)}
                            />
                          </td>
                          <td className="p-3 border-b border-border">
                            {renderSeverityBadge(finding.severity, finding.risk_factor)}
                          </td>
                          <td 
                            className="font-medium cursor-pointer group p-3 border-b border-border max-w-xs"
                            onClick={() => toggleFindingExpansion(finding.id)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedFindings.has(finding.id) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              )}
                              <span className="text-foreground group-hover:text-primary transition-colors truncate">
                                {finding.plugin_name || `Plugin ${finding.plugin_id}` || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 border-b border-border">
                            <span className="font-medium text-foreground">
                              {finding.host || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 border-b border-border">
                            <span className="text-foreground">
                              {finding.port || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 border-b border-border">
                            <span className="text-foreground text-xs">
                              {finding.cve || 'None'}
                            </span>
                          </td>
                          <td className="p-3 border-b border-border max-w-md">
                            <span className="text-foreground text-sm truncate block" title={finding.synopsis || finding.description || ''}>
                              {finding.synopsis || finding.description || 'No synopsis available'}
                            </span>
                          </td>
                        </tr>
                        {expandedFindings.has(finding.id) && renderExpandedFindingDetails(finding)}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        {analysisResult.findings?.length === 0 ? 'No findings found in scan.' : 'No findings match your filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Nessus Prep Dialog */}
      {nessusPrepDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                 <Icon icon={Save} size="md" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Create Nessus Prep List</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a new prep list for STP
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNessusPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Prep List Name *
                </label>
                <input
                  type="text"
                  value={nessusPrepDialog.name}
                  onChange={(e) => setNessusPrepDialog(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Enter a descriptive name for this prep list"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={nessusPrepDialog.description}
                  onChange={(e) => setNessusPrepDialog(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
                  placeholder="Optional description of this prep list"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
              <Button 
                variant="outline" 
                onClick={() => setNessusPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNessusPrep}
                disabled={!nessusPrepDialog.name.trim() || loading}
                loading={loading}
              >
                Save Prep List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nessus Prep List Manager Modal */}
      {nessusPrepManager.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Nessus Prep List Manager</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your Nessus vulnerability preparation lists
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNessusPrepManager({ isOpen: false, mode: 'view', prepList: null })}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {nessusPrepManager.mode === 'view' && !nessusPrepManager.prepList && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-foreground">All Nessus Prep Lists</h4>
                      <p className="text-sm text-muted-foreground">
                        {nessusPrepLists.length} prep list{nessusPrepLists.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>

                  {nessusPrepLists.length > 0 ? (
                    <div className="space-y-4">
                      {nessusPrepLists.map((prepList) => (
                        <div key={prepList.id} className="bg-card border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-medium text-foreground">{prepList.name}</h5>
                                <Badge variant="outline" className="text-xs">
                                  {prepList.finding_count} findings
                                </Badge>
                                <Badge variant="default" className="text-xs">
                                  ready
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {prepList.description || 'No description provided'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Created: {new Date(prepList.created_date).toLocaleDateString()}</span>
                                <span>Updated: {new Date(prepList.updated_date).toLocaleDateString()}</span>
                                {prepList.scan_info?.name && (
                                  <span>Scan: {prepList.scan_info.name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewNessusPrepList(prepList.id)}
                              >
                                <Info className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditNessusPrepList(prepList)}
                              >
                                <Edit3 className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNessusPrepList(prepList.id, prepList.name)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h5 className="text-lg font-medium text-foreground mb-2">No Nessus Prep Lists</h5>
                      <p className="text-muted-foreground">
                        Create your first prep list by selecting findings from a Nessus scan and clicking "Create Prep List"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {nessusPrepManager.mode === 'view' && nessusPrepManager.prepList && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNessusPrepManager({ isOpen: true, mode: 'view', prepList: null })}
                    >
                      ← Back to List
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditNessusPrepList(nessusPrepManager.prepList)}
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteNessusPrepList(nessusPrepManager.prepList.id, nessusPrepManager.prepList.name)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h5 className="font-medium text-foreground mb-2">{nessusPrepManager.prepList.name}</h5>
                        <p className="text-sm text-muted-foreground mb-4">
                          {nessusPrepManager.prepList.description || 'No description provided'}
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="default">
                              ready
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Findings:</span>
                            <span className="font-medium">{nessusPrepManager.prepList.finding_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(nessusPrepManager.prepList.created_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated:</span>
                            <span>{new Date(nessusPrepManager.prepList.updated_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h6 className="font-medium text-foreground mb-3">Scan Information</h6>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Scan Name:</span>
                            <p className="font-medium">{nessusPrepManager.prepList.scan_info?.name || 'N/A'}</p>
                        </div>
                          <div>
                            <span className="text-muted-foreground">Total Hosts:</span>
                            <p>{nessusPrepManager.prepList.asset_info?.total_hosts || 'N/A'}</p>
                      </div>
                          <div>
                            <span className="text-muted-foreground">Source:</span>
                            <p>Nessus Vulnerability Scan</p>
                    </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h6 className="font-medium text-foreground mb-3">Selected Findings ({nessusPrepManager.prepList.selected_findings?.length || 0})</h6>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-destructive">{nessusPrepManager.prepList.summary?.critical || 0}</div>
                          <div className="text-xs text-muted-foreground">Critical</div>
                    </div>
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-destructive">{nessusPrepManager.prepList.summary?.high || 0}</div>
                          <div className="text-xs text-muted-foreground">High</div>
                        </div>
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-warning">{nessusPrepManager.prepList.summary?.medium || 0}</div>
                          <div className="text-xs text-muted-foreground">Medium</div>
                        </div>
                        <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-success">{nessusPrepManager.prepList.summary?.low || 0}</div>
                          <div className="text-xs text-muted-foreground">Low</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Finding IDs: {nessusPrepManager.prepList.selected_findings?.slice(0, 10).join(', ') || 'None'}
                        {(nessusPrepManager.prepList.selected_findings?.length || 0) > 10 && ` ... and ${(nessusPrepManager.prepList.selected_findings?.length || 0) - 10} more`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nessus Prep List Edit Dialog */}
      {nessusPrepEditDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Edit Nessus Prep List</h3>
                  <p className="text-sm text-muted-foreground">
                    Update prep list information
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNessusPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' })}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={nessusPrepEditDialog.name}
                  onChange={(e) => setNessusPrepEditDialog(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Enter prep list name"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={nessusPrepEditDialog.description}
                  onChange={(e) => setNessusPrepEditDialog(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
                  placeholder="Optional description"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
              <Button 
                variant="outline" 
                onClick={() => setNessusPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' })}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateNessusPrepList}
                disabled={!nessusPrepEditDialog.name.trim() || loading}
                loading={loading}
              >
                Update Prep List
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


