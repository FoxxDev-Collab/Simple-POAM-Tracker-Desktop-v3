import { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Shield, AlertTriangle, CheckCircle, XCircle, Info, Search, Save, Download, ChevronUp, ChevronDown, ChevronRight, Edit3, Check, X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { STIGMappingResult, CCIMapping, STIGChecklist } from '../../types/stig';
import { parseCCIListFile, parseMultipleSTIGChecklists, createSTIGMapping, getAllStigMappings, saveStpPrepList, getAllStpPrepLists, getStpPrepListById, updateStpPrepList, deleteStpPrepList } from '../../utils/tauriApi';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
// Unified styles moved to global patterns
import { compareNistControlIdStrings } from '../../lib/utils';

interface FileUploadState {
  cciFilePath: string | null;
  cciFileName: string | null;
  cciLoaded: boolean;
  checklistFilePath: string | null;
  checklistFileName: string | null;
  checklistLoaded: boolean;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface StpPrepDialog {
  isOpen: boolean;
  name: string;
  description: string;
}

interface StpPrepManagerDialog {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  prepList: any | null;
}

interface StpPrepEditDialog {
  isOpen: boolean;
  prepList: any | null;
  name: string;
  description: string;
}

interface EditingStigState {
  controlId: string;
  stigVulnNum: string;
  field: 'status' | 'finding_details' | 'comments' | 'severity_override';
  value: string;
}

type SortField = 'nist_control' | 'ccis' | 'stigs' | 'compliance' | 'risk';
type SortDirection = 'asc' | 'desc';

export default function STIGMapper() {
  const { currentSystem } = useSystem();
  const [fileState, setFileState] = useState<FileUploadState>({
    cciFilePath: null,
    cciFileName: null,
    cciLoaded: false,
    checklistFilePath: null,
    checklistFileName: null,
    checklistLoaded: false
  });

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to use STIG Mapper functionality.</p>
      </div>
    );
  }
  const [loading, setLoading] = useState(false);
  const [cciMappings, setCciMappings] = useState<CCIMapping[]>([]);
  const [mappingResult, setMappingResult] = useState<STIGMappingResult | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('nist_control');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [editingStig, setEditingStig] = useState<EditingStigState | null>(null);
  const [stpPrepDialog, setStpPrepDialog] = useState<StpPrepDialog>({
    isOpen: false,
    name: '',
    description: ''
  });
  const { addToast } = useToast();

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [savedMappingId, setSavedMappingId] = useState<string | null>(null);

  
  // STP Prep List Manager state
  const [stpPrepLists, setStpPrepLists] = useState<any[]>([]);
  const [stpPrepManager, setStpPrepManager] = useState<StpPrepManagerDialog>({
    isOpen: false,
    mode: 'view',
    prepList: null
  });
  const [stpPrepEditDialog, setStpPrepEditDialog] = useState<StpPrepEditDialog>({
    isOpen: false,
    prepList: null,
    name: '',
    description: ''
  });

  // STIG Status options
  const STIG_STATUS_OPTIONS = [
    { value: 'Open', label: 'Open', color: 'destructive' },
    { value: 'NotAFinding', label: 'Not a Finding', color: 'success' },
    { value: 'Not_Applicable', label: 'Not Applicable', color: 'secondary' },
    { value: 'Not_Reviewed', label: 'Not Reviewed', color: 'warning' }
  ];

  const SEVERITY_OPTIONS = [
    { value: '', label: 'No Override', color: 'secondary' },
    { value: 'high', label: 'High', color: 'destructive' },
    { value: 'medium', label: 'Medium', color: 'warning' },
    { value: 'low', label: 'Low', color: 'success' }
  ];

  // Load STP prep lists
  const loadStpPrepLists = useCallback(async () => {
    try {
      const prepLists = await getAllStpPrepLists(currentSystem.id);
      setStpPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading STP prep lists:', error);
    }
  }, [currentSystem.id]);

  // Load saved STIG mappings and restore the most recent one on component mount
  useEffect(() => {
    const loadSavedMappings = async () => {
      try {
        setLoading(true);
        const mappings = await getAllStigMappings(currentSystem.id);
        
        if (mappings.length > 0) {
          // Get the most recent mapping
          const mostRecent = mappings[0]; // Already sorted by created_date DESC in backend
          
          // Restore the mapping data
          setMappingResult({
            checklist: {
              stig_info: mostRecent.stig_info,
              asset: mostRecent.asset_info,
              vulnerabilities: mostRecent.mapping_result.mapped_controls.flatMap((control: any) => control.stigs || [])
            },
            cci_mappings: mostRecent.cci_mappings || [],
            mapped_controls: mostRecent.mapping_result.mapped_controls,
            summary: mostRecent.mapping_result.summary
          });
          
          // Restore CCI mappings to state (transform back from backend format)
          if (mostRecent.cci_mappings && mostRecent.cci_mappings.length > 0) {
            const transformedMappings = mostRecent.cci_mappings.map((backendCci: any) => ({
              id: backendCci.cci_id,
              title: `CCI-${backendCci.cci_id}`,
              definition: backendCci.definition,
              nist_controls: [backendCci.nist_control],
              cci_type: 'technical',
              status: 'approved',
              publish_date: new Date().toISOString()
            }));
            setCciMappings(transformedMappings);
          }
          
          setSavedMappingId(mostRecent.id);
          
          // Update file state to show that we have data loaded
          setFileState({
            cciFilePath: 'Previously loaded',
            cciFileName: 'CCI mappings from saved mapping',
            cciLoaded: true,
            checklistFilePath: 'Previously loaded',
            checklistFileName: `${mostRecent.name}`,
            checklistLoaded: true
          });
          
          setIsProcessingComplete(true);
          
          console.log(`Restored STIG mapping: ${mostRecent.name}`);
        }
      } catch (error) {
        console.error('Error loading saved mappings:', error);
        // Don't show error toast on startup - just log it
      } finally {
        setLoading(false);
      }
    };

    loadSavedMappings();
    loadStpPrepLists();
  }, []); // Empty dependency array - only run once on mount



  // Enhanced CCI file handler that also restores CCI mappings if needed
  const handleCCIFileSelect = useCallback(async () => {
    setLoading(true);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'XML Files', extensions: ['xml'] }],
        multiple: false,
      });
      
      if (selected && typeof selected === 'string') {
        console.log('Selected CCI file:', selected);
        const mappings = await parseCCIListFile(selected);
        console.log('Parsed CCI mappings:', mappings.length);
        
        if (!mappings || mappings.length === 0) {
          throw new Error('No CCI mappings found in the file');
        }
        
        setCciMappings(mappings);
        setFileState(prev => ({
          ...prev,
          cciFilePath: selected,
          cciFileName: selected.split(/[\\/]/).pop() || 'Unknown',
          cciLoaded: true
        }));
        
        addToast(`Successfully loaded ${mappings.length} CCI mappings.`, 'success');
      }
    } catch (error) {
      console.error('Error parsing CCI file:', error);
      addToast(`Failed to parse CCI file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      
      setCciMappings([]);
      setFileState(prev => ({
        ...prev,
        cciFilePath: null,
        cciFileName: null,
        cciLoaded: false
      }));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Update processing step status
  const updateProcessingStep = useCallback((stepId: string, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  }, []);

  // Initialize processing steps
  const initializeProcessingSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      { id: 'parse', label: 'Parsing STIG checklist files', status: 'pending' },
      { id: 'map', label: 'Mapping vulnerabilities to NIST controls', status: 'pending' },
      { id: 'analyze', label: 'Analyzing compliance status', status: 'pending' },
      { id: 'save', label: 'Saving to database', status: 'pending' },
      { id: 'complete', label: 'Processing complete', status: 'pending' }
    ];
    setProcessingSteps(steps);
    setIsProcessingComplete(false);
  }, []);

  // Handle checklist file selection for multiple files with auto-save
  const handleChecklistFileSelect = useCallback(async () => {
    if (!fileState.cciLoaded) {
      addToast('Please upload the CCI list XML file first.', 'warning');
      return;
    }

    if (!cciMappings || cciMappings.length === 0) {
      addToast('CCI mappings not available. Please reload the CCI list file.', 'error');
      return;
    }

    setLoading(true);
    initializeProcessingSteps();
    
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'Checklist Files', extensions: ['ckl'] }],
        multiple: true,
      });
      
      const filePaths = Array.isArray(selected) ? selected : (selected ? [selected] : []);

      if (filePaths.length > 0) {
        console.log(`Selected ${filePaths.length} checklist file(s):`, filePaths);
        
        // Step 1: Parse files
        updateProcessingStep('parse', 'processing', `Parsing ${filePaths.length} file(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for animation
        
        const checklist = await parseMultipleSTIGChecklists(filePaths);
        console.log('Parsed and merged checklist:', checklist);
        
        if (!checklist) {
          throw new Error('Failed to parse checklist files');
        }
        
        // Handle array result from parseMultipleSTIGChecklists
        const singleChecklist = (Array.isArray(checklist) ? checklist[0] : checklist) as STIGChecklist;
        updateProcessingStep('parse', 'completed', `Parsed ${singleChecklist?.vulnerabilities?.length || 0} vulnerabilities`);
        
        // Step 2: Create mapping
        updateProcessingStep('map', 'processing', 'Creating STIG mapping...');
        const result = await createSTIGMapping(singleChecklist, cciMappings);
        console.log('Mapping result:', result);
        
        if (!result) {
          throw new Error('Failed to create STIG mapping');
        }
        
        const controlCount = result.mapped_controls?.length || 0;
        updateProcessingStep('map', 'completed', `Mapped ${controlCount} NIST controls`);
        
        // Step 3: Analyze compliance
        updateProcessingStep('analyze', 'processing', 'Analyzing compliance status...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const vulnsWithCCIs = singleChecklist.vulnerabilities.filter((v: { cci_refs: string[] }) => v.cci_refs && v.cci_refs.length > 0);
        updateProcessingStep('analyze', 'completed', `Analyzed ${vulnsWithCCIs.length} vulnerabilities with CCI references`);
        
        // Step 4: Auto-save to database
        updateProcessingStep('save', 'processing', 'Saving mapping to database...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { invoke } = await import('@tauri-apps/api/core');
        const mappingId = crypto.randomUUID();
        
        // Generate automatic name based on STIG info
        const stigTitle = result.checklist?.stig_info?.title || 'Unknown STIG';
        const autoName = `${stigTitle} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        
        const mappingData = {
          id: mappingId,
          name: autoName,
          description: `Auto-saved STIG mapping with ${controlCount} controls`,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          stig_info: {
            title: result.checklist?.stig_info?.title || '',
            version: result.checklist?.stig_info?.version || '',
            release_info: result.checklist?.stig_info?.release_info || '',
            classification: result.checklist?.stig_info?.classification || '',
            description: null,
          },
          asset_info: {
            asset_type: result.checklist?.asset?.asset_type || '',
            host_name: result.checklist?.asset?.host_name || null,
            host_ip: result.checklist?.asset?.host_ip || null,
            host_mac: result.checklist?.asset?.host_mac || null,
            host_fqdn: result.checklist?.asset?.host_fqdn || null,
            target_comment: result.checklist?.asset?.target_comment || null,
          },
          mapping_result: {
            total_vulnerabilities: result.checklist?.vulnerabilities?.length || 0,
            mapped_controls: result.mapped_controls?.map(control => ({
              ...control,
              findings_count: control.stigs?.length || 0
            })) || [],
            summary: result.summary || {
              total_controls: 0,
              compliant_controls: 0,
              non_compliant_controls: 0,
              not_applicable_controls: 0,
              not_reviewed_controls: 0,
              high_risk_findings: 0,
              medium_risk_findings: 0,
              low_risk_findings: 0,
            },
          },
          cci_mappings: cciMappings && cciMappings.length > 0 ? cciMappings.map(cci => ({
            cci_id: cci.id,
            control_number: cci.nist_controls?.[0] || '',
            definition: cci.definition,
            enhancement: null,
            nist_control: cci.nist_controls?.[0] || ''
          })) : null,
        };

        await invoke('save_stig_mapping', { mappingData, systemId: currentSystem.id });
        setSavedMappingId(mappingId);
        updateProcessingStep('save', 'completed', 'Successfully saved to database');
        
        // Step 5: Complete
        updateProcessingStep('complete', 'processing', 'Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 200));
        updateProcessingStep('complete', 'completed', 'Ready for Security Test Plan creation');
        
        // Update state
        setMappingResult(result);
        setSelectedControls(new Set()); // Reset selections
        setFileState(prev => ({
          ...prev,
          checklistFilePath: filePaths.join(', '),
          checklistFileName: `${filePaths.length} file(s) selected`,
          checklistLoaded: true
        }));
        
        setIsProcessingComplete(true);
        
        const vulnCount = result.checklist?.vulnerabilities?.length || 0;
        addToast(`Successfully processed and saved STIG mapping with ${controlCount} NIST controls from ${vulnCount} vulnerabilities.`, 'success');
      }
    } catch (error) {
      console.error('Error processing checklist file(s):', error);
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
      
      addToast(`Failed to process checklist file(s): ${errorMessage}`, 'error');
      
      setMappingResult(null);
      setFileState(prev => ({
        ...prev,
        checklistFilePath: null,
        checklistFileName: null,
        checklistLoaded: false
      }));
    } finally {
      setLoading(false);
    }
  }, [addToast, fileState.cciLoaded, cciMappings, initializeProcessingSteps, updateProcessingStep]);

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
  const handleControlSelection = (controlId: string, checked: boolean) => {
    const newSelected = new Set(selectedControls);
    if (checked) {
      newSelected.add(controlId);
    } else {
      newSelected.delete(controlId);
    }
    setSelectedControls(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allControlIds = new Set(filteredAndSortedControls.map(control => control.nist_control));
      setSelectedControls(allControlIds);
    } else {
      setSelectedControls(new Set());
    }
  };

  // Handle expanding/collapsing control details
  const toggleControlExpansion = (controlId: string) => {
    const newExpanded = new Set(expandedControls);
    if (newExpanded.has(controlId)) {
      newExpanded.delete(controlId);
    } else {
      newExpanded.add(controlId);
    }
    setExpandedControls(newExpanded);
  };

  // Handle STIG editing
  const handleStigEdit = (controlId: string, stigVulnNum: string, field: EditingStigState['field'], currentValue: string) => {
    setEditingStig({
      controlId,
      stigVulnNum,
      field,
      value: currentValue
    });
  };

  const handleStigUpdate = () => {
    if (!editingStig || !mappingResult) return;

    // Find and update the STIG in the mapping result
    const updatedResult = { ...mappingResult };
    const control = updatedResult.mapped_controls.find(c => c.nist_control === editingStig.controlId);
    
    if (control) {
      const stig = control.stigs.find(s => s.vuln_num === editingStig.stigVulnNum);
      if (stig) {
        // Update the field
        switch (editingStig.field) {
          case 'status':
            stig.status = editingStig.value;
            break;
          case 'finding_details':
            stig.finding_details = editingStig.value;
            break;
          case 'comments':
            stig.comments = editingStig.value;
            break;
          case 'severity_override':
            stig.severity_override = editingStig.value || undefined;
            break;
        }

        // Update the control's compliance status based on STIG statuses
        const stigStatuses = control.stigs.map(s => s.status);
        if (stigStatuses.some(s => s === 'Open')) {
          control.compliance_status = 'non-compliant';
          control.risk_level = 'high';
        } else if (stigStatuses.every(s => s === 'NotAFinding')) {
          control.compliance_status = 'compliant';
          control.risk_level = 'low';
        } else if (stigStatuses.every(s => s === 'Not_Applicable')) {
          control.compliance_status = 'not-applicable';
          control.risk_level = 'low';
        } else {
          control.compliance_status = 'partial';
          control.risk_level = 'medium';
        }

        setMappingResult(updatedResult);
        addToast('STIG updated successfully', 'success');
      }
    }

    setEditingStig(null);
  };

  const handleStigCancel = () => {
    setEditingStig(null);
  };

  // Handle opening STP prep dialog
  const handleOpenStpPrepDialog = useCallback(() => {
    if (!mappingResult || selectedControls.size === 0) {
      addToast('Please select at least one control to prep for STP.', 'warning');
      return;
    }
    
    // Generate default name based on STIG info and selection
    const stigTitle = mappingResult.checklist?.stig_info?.title || 'Unknown STIG';
    const defaultName = `STP Prep - ${stigTitle} - ${selectedControls.size} controls`;
    
    setStpPrepDialog({
      isOpen: true,
      name: defaultName,
      description: `STP prep list with ${selectedControls.size} selected controls from ${stigTitle}`
    });
  }, [mappingResult, selectedControls.size, addToast]);

  // Handle saving STP prep list
  const handleSaveStpPrep = useCallback(async () => {
    if (!mappingResult || !stpPrepDialog.name.trim() || selectedControls.size === 0) return;

    setLoading(true);
    try {
      
      // Get selected controls
      const controlsToPrep = mappingResult.mapped_controls?.filter(control => 
        selectedControls.has(control.nist_control)
      ) || [];

      // Create STP prep data structure (simpler than full STP)
      const stpPrepData = {
        id: crypto.randomUUID(),
        name: stpPrepDialog.name.trim(),
        description: stpPrepDialog.description.trim(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        source_mapping_id: savedMappingId,
        stig_info: mappingResult.checklist?.stig_info || {},
        asset_info: mappingResult.checklist?.asset || {},
        prep_status: 'ready',
        selected_controls: controlsToPrep.map(control => ({
          nist_control: control.nist_control,
          ccis: control.ccis || [],
          stigs: control.stigs || [],
          compliance_status: control.compliance_status,
          risk_level: control.risk_level,
          notes: `Prepped from STIG mapping: ${mappingResult.checklist?.stig_info?.title || 'Unknown'}`,
          selected_for_stp: true
        })),
        control_count: controlsToPrep.length
      };

      // Save as STP prep list to database
      await saveStpPrepList(stpPrepData, currentSystem.id);
      
      setStpPrepDialog({ isOpen: false, name: '', description: '' });
      setSelectedControls(new Set()); // Clear selection after saving
      
      // Refresh the prep lists
      await loadStpPrepLists();
      
      addToast(`STP prep list "${stpPrepDialog.name}" saved successfully with ${controlsToPrep.length} controls`, 'success');
    } catch (error) {
      console.error('Error saving STP prep list:', error);
      addToast(`Failed to save STP prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [mappingResult, stpPrepDialog, selectedControls, addToast, savedMappingId, currentSystem.id]);

  // Handle exporting data as JSON and updated .ckl file
  const handleExport = useCallback(async () => {
    if (!mappingResult) return;

    setLoading(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      // Prepare complete export data
      const exportData = {
        export_timestamp: new Date().toISOString(),
        stig_info: mappingResult.checklist.stig_info,
        asset_info: mappingResult.checklist.asset,
        mapping_summary: mappingResult.summary,
        mapped_controls: mappingResult.mapped_controls,
        vulnerabilities: mappingResult.checklist.vulnerabilities,
        cci_mappings: mappingResult.cci_mappings,
        metadata: {
          total_controls: mappingResult.mapped_controls?.length || 0,
          total_vulnerabilities: mappingResult.checklist.vulnerabilities?.length || 0,
          export_version: '1.0'
        }
      };

      // Export JSON data
      const jsonFilePath = await save({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        defaultPath: `stig-mapping-export-${new Date().toISOString().split('T')[0]}.json`
      });

      if (jsonFilePath) {
        await invoke('export_json_data', { 
          filePath: jsonFilePath, 
          data: JSON.stringify(exportData, null, 2) 
        });
        addToast('JSON export completed successfully', 'success');
      }

      // Export updated .ckl file
      const cklFilePath = await save({
        filters: [{ name: 'Checklist Files', extensions: ['ckl'] }],
        defaultPath: `updated-checklist-${new Date().toISOString().split('T')[0]}.ckl`
      });

      if (cklFilePath) {
        await invoke('export_updated_checklist', { 
          filePath: cklFilePath,
          checklist: mappingResult.checklist
        });
        addToast('Updated .ckl file exported successfully', 'success');
      }

    } catch (error) {
      console.error('Error exporting data:', error);
      addToast(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [mappingResult, addToast]);

  // Handle deleting mapping and restarting process
  const handleDeleteMapping = useCallback(() => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this mapping and restart?'
    );
    if (!confirmDelete) return;

    // Reset all state
    setMappingResult(null);
    setCciMappings([]);
    setFileState({
      cciFilePath: null,
      cciFileName: null,
      cciLoaded: false,
      checklistFilePath: null,
      checklistFileName: null,
      checklistLoaded: false
    });
    setSelectedControls(new Set());
    setExpandedControls(new Set());
    setEditingStig(null);
    setFilter('');
    setIsProcessingComplete(false);
    setSavedMappingId(null);
    setProcessingSteps([]);
    
    addToast('Mapping deleted. Ready to start a new mapping.', 'info');
  }, [addToast]);

  // STP Prep List Management Functions
  const handleOpenStpPrepManager = useCallback(() => {
    setStpPrepManager({ isOpen: true, mode: 'view', prepList: null });
    loadStpPrepLists();
  }, [loadStpPrepLists]);

  const handleViewStpPrepList = useCallback(async (prepListId: string) => {
    try {
      const prepList = await getStpPrepListById(prepListId, currentSystem.id);
      if (prepList) {
        setStpPrepManager({ isOpen: true, mode: 'view', prepList });
      }
    } catch (error) {
      console.error('Error loading prep list:', error);
      addToast('Failed to load prep list details', 'error');
    }
  }, [addToast, currentSystem.id]);

  const handleEditStpPrepList = useCallback((prepList: any) => {
    setStpPrepEditDialog({
      isOpen: true,
      prepList,
      name: prepList.name,
      description: prepList.description || ''
    });
  }, []);

  const handleUpdateStpPrepList = useCallback(async () => {
    if (!stpPrepEditDialog.prepList || !stpPrepEditDialog.name.trim()) return;

    setLoading(true);
    try {
      const updatedPrepList = {
        ...stpPrepEditDialog.prepList,
        name: stpPrepEditDialog.name.trim(),
        description: stpPrepEditDialog.description.trim()
      };

      await updateStpPrepList(updatedPrepList, currentSystem.id);
      
      setStpPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' });
      await loadStpPrepLists();
      
      addToast(`STP prep list "${stpPrepEditDialog.name}" updated successfully`, 'success');
    } catch (error) {
      console.error('Error updating STP prep list:', error);
      addToast(`Failed to update STP prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [stpPrepEditDialog, loadStpPrepLists, addToast, currentSystem.id]);

  const handleDeleteStpPrepList = useCallback(async (prepListId: string, prepListName: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the STP prep list "${prepListName}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteStpPrepList(prepListId, currentSystem.id);
      await loadStpPrepLists();
      
      addToast(`STP prep list "${prepListName}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting STP prep list:', error);
      addToast(`Failed to delete STP prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadStpPrepLists, addToast, currentSystem.id]);

  // Render compliance status badge
  const renderComplianceStatus = (status: string) => {
    const getStatusConfig = (status: string) => {
      switch (status.toLowerCase()) {
        case 'compliant':
        case 'not_a_finding':
        case 'notafinding':
          return { variant: 'success', icon: CheckCircle };
        case 'non-compliant':
        case 'open':
          return { variant: 'destructive', icon: XCircle };
        case 'not_applicable':
        case 'not applicable':
        case 'na':
          return { variant: 'secondary', icon: Info };
        case 'not_reviewed':
        case 'not reviewed':
          return { variant: 'outline', icon: AlertTriangle };
        default:
          return { variant: 'outline', icon: Info };
      }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  // Render risk level badge
  const renderRiskLevel = (risk: string) => {
    const getRiskConfig = (risk: string) => {
      switch (risk.toLowerCase()) {
        case 'very high':
        case 'critical':
          return 'destructive';
        case 'high':
          return 'warning';
        case 'medium':
        case 'moderate':
          return 'outline';
        case 'low':
          return 'success';
        default:
          return 'secondary';
      }
    };

    return (
      <Badge variant={getRiskConfig(risk) as any} className="text-xs font-medium">
        {risk.toUpperCase()}
      </Badge>
    );
  };

  // Sort and filter controls
  const filteredAndSortedControls = (() => {
    if (!mappingResult?.mapped_controls) return [];

    let filtered = mappingResult.mapped_controls.filter(control => {
      if (!filter.trim()) return true;
      const searchTerm = filter.toLowerCase();
      return (
        control.nist_control.toLowerCase().includes(searchTerm) ||
        control.ccis?.some(cci => cci.toLowerCase().includes(searchTerm)) ||
        control.stigs?.some(stig => 
          stig.rule_title?.toLowerCase().includes(searchTerm) ||
          stig.vuln_num?.toLowerCase().includes(searchTerm) ||
          stig.stig_id?.toLowerCase().includes(searchTerm)
        )
      );
    });

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'nist_control':
          {
            const cmp = compareNistControlIdStrings(a.nist_control, b.nist_control);
            return sortDirection === 'asc' ? cmp : -cmp;
          }
        case 'ccis':
          aValue = a.ccis?.length || 0;
          bValue = b.ccis?.length || 0;
          break;
        case 'stigs':
          aValue = a.stigs?.length || 0;
          bValue = b.stigs?.length || 0;
          break;
        case 'compliance':
          aValue = a.compliance_status;
          bValue = b.compliance_status;
          break;
        case 'risk':
          const riskOrder = { 'critical': 4, 'very high': 4, 'high': 3, 'medium': 2, 'moderate': 2, 'low': 1 };
          aValue = riskOrder[a.risk_level.toLowerCase() as keyof typeof riskOrder] || 0;
          bValue = riskOrder[b.risk_level.toLowerCase() as keyof typeof riskOrder] || 0;
          break;
        default:
          aValue = a.nist_control;
          bValue = b.nist_control;
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

  // Render detailed STIG information for expanded controls
  const renderExpandedControlDetails = (control: any) => {
    return (
      <tr className="bg-muted/30">
        <td colSpan={6} className="p-0">
          <div className="p-4 border-t border-border">
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">
                STIG Details for {control.nist_control}
              </h4>
              
              {/* CCIs Section */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">
                  Control Correlation Identifiers (CCIs):
                </h5>
                <div className="flex flex-wrap gap-2">
                  {control.ccis?.map((cci: string) => (
                    <Badge key={cci} variant="outline" className="text-xs">
                      {cci}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* STIGs Section */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">
                  Associated STIG Vulnerabilities ({control.stigs?.length || 0}):
                </h5>
                                 <div className="space-y-3">
                   {control.stigs?.map((stig: any, index: number) => (
                     <div key={`${control.nist_control}-${stig.vuln_num || stig.rule_id || index}`} className="bg-card border border-border rounded-lg p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">STIG ID:</span>
                            <div className="text-sm text-foreground mt-1">
                              {stig.stig_id && stig.stig_id.trim() ? stig.stig_id : 'Not Available'}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Vuln ID:</span>
                            <div className="text-sm text-foreground mt-1">
                              {stig.vuln_num}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Severity:</span>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant={
                                stig.severity?.toLowerCase() === 'high' ? 'destructive' :
                                stig.severity?.toLowerCase() === 'medium' ? 'warning' :
                                stig.severity?.toLowerCase() === 'low' ? 'success' : 'secondary'
                              }>
                                {stig.severity || 'Unknown'}
                              </Badge>
                              {stig.severity_override && (
                                <Badge variant="outline" className="text-xs">
                                  Override: {stig.severity_override}
                                </Badge>
                              )}
                                                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStigEdit(control.nist_control, stig.vuln_num, 'severity_override', stig.severity_override || '')}
                                    className="stig-edit-btn"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </Button>
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Status:</span>
                            <div className="mt-1 flex items-center gap-2">
                              {editingStig?.controlId === control.nist_control && 
                               editingStig?.stigVulnNum === stig.vuln_num && 
                               editingStig?.field === 'status' ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={editingStig.value}
                                    onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                                    className="stig-status-select"
                                  >
                                    {STIG_STATUS_OPTIONS.map(option => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={handleStigUpdate}
                                    className="icon-btn micro success"
                                    title="Save"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={handleStigCancel}
                                    className="icon-btn micro danger"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {renderComplianceStatus(stig.status || 'Unknown')}
                                  <button
                                    onClick={() => handleStigEdit(control.nist_control, stig.vuln_num, 'status', stig.status || 'Not_Reviewed')}
                                    className="stig-edit-btn"
                                    title="Edit Status"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      
                      <div className="mt-2">
                        <span className="font-medium text-muted-foreground">Rule Title:</span>
                        <p className="mt-1 text-sm text-foreground">
                          {stig.rule_title || 'No title available'}
                        </p>
                      </div>

                      {stig.cci_refs && stig.cci_refs.length > 0 && (
                        <div className="mt-2">
                          <span className="font-medium text-muted-foreground">CCI References:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {stig.cci_refs.map((cci: string) => (
                              <Badge key={cci} variant="secondary" className="text-xs">
                                {cci}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Editable Finding Details */}
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-muted-foreground">Finding Details:</span>
                          {!(editingStig?.controlId === control.nist_control && 
                            editingStig?.stigVulnNum === stig.vuln_num && 
                            editingStig?.field === 'finding_details') && (
                            <button
                              onClick={() => handleStigEdit(control.nist_control, stig.vuln_num, 'finding_details', stig.finding_details || '')}
                              className="stig-edit-btn"
                              title="Edit Finding Details"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editingStig?.controlId === control.nist_control && 
                         editingStig?.stigVulnNum === stig.vuln_num && 
                         editingStig?.field === 'finding_details' ? (
                          <div className="mt-1">
                            <textarea
                              value={editingStig.value}
                              onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                              className="form-control"
                              rows={4}
                              placeholder="Enter finding details..."
                            />
                            <div className="stig-edit-actions">
                              <button
                                className="stig-save-btn"
                                onClick={handleStigUpdate}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Save
                              </button>
                              <button
                                className="stig-cancel-btn"
                                onClick={handleStigCancel}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground bg-muted p-2 rounded">
                            {stig.finding_details || 'No finding details provided. Click edit to add details.'}
                          </div>
                        )}
                      </div>

                      {/* Editable Comments */}
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-muted-foreground">Comments:</span>
                          {!(editingStig?.controlId === control.nist_control && 
                            editingStig?.stigVulnNum === stig.vuln_num && 
                            editingStig?.field === 'comments') && (
                            <button
                              onClick={() => handleStigEdit(control.nist_control, stig.vuln_num, 'comments', stig.comments || '')}
                              className="stig-edit-btn"
                              title="Edit Comments"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {editingStig?.controlId === control.nist_control && 
                         editingStig?.stigVulnNum === stig.vuln_num && 
                         editingStig?.field === 'comments' ? (
                          <div className="mt-1">
                            <textarea
                              value={editingStig.value}
                              onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                              className="form-control"
                              rows={3}
                              placeholder="Enter comments..."
                            />
                            <div className="stig-edit-actions">
                              <button
                                className="stig-save-btn"
                                onClick={handleStigUpdate}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Save
                              </button>
                              <button
                                className="stig-cancel-btn"
                                onClick={handleStigCancel}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground bg-muted p-2 rounded">
                            {stig.comments || 'No comments provided. Click edit to add comments.'}
                          </div>
                        )}
                      </div>

                      {/* Severity Override */}
                      {editingStig?.controlId === control.nist_control && 
                       editingStig?.stigVulnNum === stig.vuln_num && 
                       editingStig?.field === 'severity_override' && (
                        <div className="mt-2">
                          <span className="font-medium text-muted-foreground">Severity Override:</span>
                          <div className="mt-1 flex items-center gap-2">
                            <select
                              value={editingStig.value}
                              onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                              className="stig-status-select"
                            >
                              {SEVERITY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              className="stig-save-btn"
                              onClick={handleStigUpdate}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Save
                            </button>
                            <button
                              className="stig-cancel-btn"
                              onClick={handleStigCancel}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">STIG Mapper</h1>
            <p className="text-muted-foreground">
              Map and analyze STIG compliance for {currentSystem.name}
            </p>
          </div>
        </div>

        <div className="button-group">
          {mappingResult && (
            <>
              <Button
                variant="outline" 
                onClick={handleOpenStpPrepDialog}
                disabled={loading}
                className="btn-responsive"
              >
                <Save className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Create STP Prep List</span>
                <span className="show-mobile">STP</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                className="btn-responsive"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Export</span>
                <span className="show-mobile">Export</span>
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteMapping}
                className="btn-responsive"
              >
                <X className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Delete Mapping</span>
                <span className="show-mobile">Delete</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* CCI List Upload */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Step 1: Upload CCI List (XML)
          </h3>
          <div className={`upload-zone ${fileState.cciLoaded ? 'uploaded' : ''}`}>
            <div className="upload-content" onClick={handleCCIFileSelect}>
              <Upload className="w-8 h-8 mb-2" />
              {fileState.cciLoaded ? (
                <div className="text-center">
                  <p className="text-success font-medium">✓ {fileState.cciFileName}</p>
                                      <p className="text-sm text-muted-foreground">{cciMappings.length} CCI mappings loaded</p>
                </div>
              ) : (
                                  <div className="text-center">
                    <p className="mb-1 text-foreground">Click to select CCI list XML file</p>
                    <p className="text-sm text-muted-foreground">Browse for file</p>
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Checklist Upload */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Step 2: Upload STIG Checklist(s) (.ckl)
          </h3>
          <div className={`upload-zone ${fileState.checklistLoaded ? 'uploaded' : ''} ${!fileState.cciLoaded ? 'disabled' : ''}`}>
            <div className="upload-content" onClick={handleChecklistFileSelect}>
              <Upload className="w-8 h-8 mb-2" />
              {fileState.checklistLoaded ? (
                <div className="text-center">
                  <p className="text-success font-medium">✓ {fileState.checklistFileName}</p>
                  <p className="text-sm text-muted-foreground">Mapping complete</p>
                </div>
              ) : (
                                  <div className="text-center">
                    <p className="mb-1 text-foreground">Click to select STIG checklist file(s)</p>
                    <p className="text-sm text-muted-foreground">Browse for .ckl file(s)</p>
                    {!fileState.cciLoaded && (
                      <p className="text-xs text-destructive mt-2">Upload CCI list first</p>
                    )}
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STP Prep List Manager */}
      <div className="mb-8 p-6 bg-card border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            STP Prep List Manager
          </h3>
          <Button
            onClick={handleOpenStpPrepManager}
            variant="outline"
            size="sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Manage Lists ({stpPrepLists.length})
          </Button>
        </div>
        
        {stpPrepLists.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stpPrepLists.slice(0, 6).map((prepList) => (
                <div key={prepList.id} className="bg-background border border-input rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-foreground truncate">{prepList.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {prepList.control_count} controls
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
                        onClick={() => handleViewStpPrepList(prepList.id)}
                        className="h-6 px-2"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStpPrepList(prepList)}
                        className="h-6 px-2"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stpPrepLists.length > 6 && (
              <div className="text-center">
                <Button
                  onClick={handleOpenStpPrepManager}
                  variant="ghost"
                  size="sm"
                >
                  View all {stpPrepLists.length} prep lists
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No STP Prep Lists Yet</p>
            <p className="text-sm">Create your first prep list by selecting controls below and clicking "Create STP Prep List"</p>
          </div>
        )}


      </div>

      {/* Processing Steps Animation */}
      {loading && processingSteps.length > 0 && (
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-semibold text-foreground">Processing STIG Mapping</h3>
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
      {isProcessingComplete && !loading && mappingResult && (
        <div className="mb-8 p-6 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-success/20 text-success rounded-full flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">STIG Mapping Complete!</h3>
              <p className="text-success/90">Your STIG data has been processed and automatically saved to the database.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Controls Mapped</div>
              <div className="text-lg font-bold text-success">
                {mappingResult.mapped_controls?.length || 0}
              </div>
            </div>
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Vulnerabilities</div>
              <div className="text-lg font-bold text-primary">
                {mappingResult.checklist?.vulnerabilities?.length || 0}
              </div>
            </div>
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Database Status</div>
              <div className="text-lg font-bold text-success flex items-center gap-1">
                <Check className="w-4 h-4" />
                Saved
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded">
            <div className="text-sm text-primary">
              <strong>Next Steps:</strong> Review the mapped controls below and use "Create STP Prep List" to generate test cases for compliance validation.
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
      {mappingResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-foreground">{mappingResult.summary?.total_controls || 0}</h3>
              <p className="text-muted-foreground">Total Controls</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-success">{mappingResult.summary?.compliant_controls || 0}</h3>
              <p className="text-muted-foreground">Compliant</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-destructive">{mappingResult.summary?.non_compliant_controls || 0}</h3>
              <p className="text-muted-foreground">Non-Compliant</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <h3 className="text-2xl font-bold text-warning">{mappingResult.summary?.high_risk_findings || 0}</h3>
              <p className="text-muted-foreground">High Risk</p>
            </div>
          </div>



          {/* Selection Summary */}
          {selectedControls.size > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Selection Summary
                  </h3>
                  <p className="text-foreground">
                    <strong>{selectedControls.size}</strong> control(s) selected for saving as a new mapping
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can save just the selected controls or all controls. Selected controls will be highlighted when you save.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOpenStpPrepDialog}
                  disabled={loading}
                  className="ml-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create STP Prep List
                </Button>
              </div>
            </div>
          )}

          {/* Mapped Controls Table */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">NIST Control Mappings</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Filter controls..." 
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
                          checked={filteredAndSortedControls.length > 0 && filteredAndSortedControls.every(control => selectedControls.has(control.nist_control))}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="mr-2"
                        />
                        Select
                      </th>
                    {renderSortHeader('nist_control', 'NIST Control')}
                    {renderSortHeader('ccis', 'CCIs')}
                    {renderSortHeader('stigs', 'STIG Count')}
                    {renderSortHeader('compliance', 'Compliance')}
                    {renderSortHeader('risk', 'Risk Level')}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedControls.length > 0 ? (
                    filteredAndSortedControls.map((control) => (
                      <>
                        <tr key={control.nist_control} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 border-b border-border">
                            <input
                              type="checkbox"
                              checked={selectedControls.has(control.nist_control)}
                              onChange={(e) => handleControlSelection(control.nist_control, e.target.checked)}
                            />
                          </td>
                          <td 
                            className="font-medium cursor-pointer group p-3 border-b border-border"
                            onClick={() => toggleControlExpansion(control.nist_control)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedControls.has(control.nist_control) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              )}
                              <span className="text-foreground group-hover:text-primary transition-colors">
                                {control.nist_control}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 border-b border-border">
                            <div className="flex flex-wrap gap-1">
                              {control.ccis?.slice(0, 3).map((cci) => (
                                <Badge key={cci} variant="outline" className="text-xs">
                                  {cci}
                                </Badge>
                              ))}
                              {(control.ccis?.length || 0) > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(control.ccis?.length || 0) - 3} more
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 border-b border-border">
                            <span className="font-medium text-primary">
                              {control.stigs?.length || 0}
                            </span>
                            {(control.stigs?.length || 0) > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (click to view)
                              </span>
                            )}
                          </td>
                          <td className="p-3 border-b border-border">{renderComplianceStatus(control.compliance_status)}</td>
                          <td className="p-3 border-b border-border">{renderRiskLevel(control.risk_level)}</td>
                        </tr>
                        {expandedControls.has(control.nist_control) && renderExpandedControlDetails(control)}
                      </>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {mappingResult.mapped_controls?.length === 0 ? 'No NIST control mappings found.' : 'No controls match your filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STP Prep Dialog */}
      {stpPrepDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Create STP Prep List</h3>
                                      <p className="text-sm text-muted-foreground">
                      Create a new STP preparation list
                    </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStpPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mapping Name *
                </label>
                <input
                  type="text"
                  value={stpPrepDialog.name}
                  onChange={(e) => setStpPrepDialog(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Enter a descriptive name for this mapping"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={stpPrepDialog.description}
                  onChange={(e) => setStpPrepDialog(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
                  placeholder="Optional description of this mapping"
                  disabled={loading}
                />
              </div>


            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
              <Button 
                variant="outline" 
                onClick={() => setStpPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveStpPrep}
                disabled={!stpPrepDialog.name.trim() || loading}
                loading={loading}
              >
                Save STP Prep List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STP Prep List Manager Modal */}
      {stpPrepManager.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">STP Prep List Manager</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your Security Test Plan preparation lists
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStpPrepManager({ isOpen: false, mode: 'view', prepList: null })}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {stpPrepManager.mode === 'view' && !stpPrepManager.prepList && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-foreground">All STP Prep Lists</h4>
                      <p className="text-sm text-muted-foreground">
                        {stpPrepLists.length} prep list{stpPrepLists.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>

                  {stpPrepLists.length > 0 ? (
                    <div className="space-y-4">
                      {stpPrepLists.map((prepList) => (
                        <div key={prepList.id} className="bg-card border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-medium text-foreground">{prepList.name}</h5>
                                <Badge variant="outline" className="text-xs">
                                  {prepList.control_count} controls
                                </Badge>
                                <Badge variant={prepList.prep_status === 'ready' ? 'default' : 'secondary'} className="text-xs">
                                  {prepList.prep_status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {prepList.description || 'No description provided'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Created: {new Date(prepList.created_date).toLocaleDateString()}</span>
                                <span>Updated: {new Date(prepList.updated_date).toLocaleDateString()}</span>
                                {prepList.stig_info?.title && (
                                  <span>STIG: {prepList.stig_info.title}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewStpPrepList(prepList.id)}
                              >
                                <Info className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditStpPrepList(prepList)}
                              >
                                <Edit3 className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStpPrepList(prepList.id, prepList.name)}
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
                      <h5 className="text-lg font-medium text-foreground mb-2">No STP Prep Lists</h5>
                      <p className="text-muted-foreground">
                        Create your first prep list by selecting controls from a STIG mapping and clicking "Create STP Prep List"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {stpPrepManager.mode === 'view' && stpPrepManager.prepList && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStpPrepManager({ isOpen: true, mode: 'view', prepList: null })}
                    >
                      ← Back to List
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStpPrepList(stpPrepManager.prepList)}
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteStpPrepList(stpPrepManager.prepList.id, stpPrepManager.prepList.name)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h5 className="font-medium text-foreground mb-2">{stpPrepManager.prepList.name}</h5>
                        <p className="text-sm text-muted-foreground mb-4">
                          {stpPrepManager.prepList.description || 'No description provided'}
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={stpPrepManager.prepList.prep_status === 'ready' ? 'default' : 'secondary'}>
                              {stpPrepManager.prepList.prep_status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Controls:</span>
                            <span className="font-medium">{stpPrepManager.prepList.control_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(stpPrepManager.prepList.created_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated:</span>
                            <span>{new Date(stpPrepManager.prepList.updated_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h6 className="font-medium text-foreground mb-3">STIG Information</h6>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Title:</span>
                            <p className="font-medium">{stpPrepManager.prepList.stig_info?.title || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Version:</span>
                            <p>{stpPrepManager.prepList.stig_info?.version || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Asset:</span>
                            <p>{stpPrepManager.prepList.asset_info?.asset_type || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h6 className="font-medium text-foreground mb-3">Selected Controls ({stpPrepManager.prepList.selected_controls?.length || 0})</h6>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {stpPrepManager.prepList.selected_controls?.map((control: any, index: number) => (
                          <div key={`${control.nist_control}-${index}`} className="bg-background border border-input rounded-lg p-4">
                                                         <div className="flex items-center justify-between mb-2">
                               <span className="font-medium text-foreground">{control.nist_control}</span>
                              <div className="flex items-center gap-2">
                                {renderComplianceStatus(control.compliance_status)}
                                {renderRiskLevel(control.risk_level)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">CCIs:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {control.ccis?.map((cci: string) => (
                                    <Badge key={cci} variant="outline" className="text-xs">{cci}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">STIGs:</span>
                                <p className="font-medium">{control.stigs?.length || 0} items</p>
                              </div>
                            </div>
                            {control.notes && (
                              <div className="mt-2">
                                <span className="text-muted-foreground text-sm">Notes:</span>
                                <p className="text-sm mt-1">{control.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STP Prep List Edit Dialog */}
      {stpPrepEditDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Edit STP Prep List</h3>
                  <p className="text-sm text-muted-foreground">
                    Update prep list information
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStpPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' })}
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
                  value={stpPrepEditDialog.name}
                  onChange={(e) => setStpPrepEditDialog(prev => ({ ...prev, name: e.target.value }))}
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
                  value={stpPrepEditDialog.description}
                  onChange={(e) => setStpPrepEditDialog(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
                  placeholder="Optional description"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
              <Button 
                variant="outline" 
                onClick={() => setStpPrepEditDialog({ isOpen: false, prepList: null, name: '', description: '' })}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateStpPrepList}
                disabled={!stpPrepEditDialog.name.trim() || loading}
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