import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { 
  Plus, 
  Download, 
  Upload, 
  CheckCircle, 
  Clock,
  Search,
  Paperclip,
  X,
  Shield,
  BarChart3,
  Calendar,
  Settings,
  Filter,
  FileText,
  Image,
  Trash2} from 'lucide-react';
import { Icon } from '../ui/icon';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useTabNavigation } from '../../context/TabContext';
import TestPlanList from './TestPlanList';
import TestCaseModal from './TestCaseModal';
// Unified styles via global patterns and Tailwind

interface TestCase {
  id: string;
  nist_control: string;
  cci_ref: string;
  stig_vuln_id: string;
  test_description: string;
  test_procedure: string;
  expected_result: string;
  actual_result?: string;
  status: 'Not Started' | 'In Progress' | 'Passed' | 'Failed' | 'Not Applicable';
  stig_compliance_status?: 'Open' | 'NotAFinding' | 'Not_Applicable' | 'Not_Reviewed';
  notes?: string;
  evidence_files?: string[];
  tested_by?: string;
  tested_date?: string;
  risk_rating: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface SecurityTestPlan {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  status: 'Draft' | 'In Progress' | 'Completed' | 'On Hold';
  poam_id?: number;
  stig_mapping_id?: string;
  test_cases: TestCase[];
  overall_score?: number;
}

interface STIGMapping {
  id: string;
  name: string;
  description?: string;
  stig_info: {
    title: string;
    version: string;
  };
  mapping_result: {
    mapped_controls: Array<{
      nist_control: string;
      ccis: string[];
      stigs: Array<{
        vuln_num: string;
        rule_id: string;
        rule_title: string;
        severity: string;
        status: string;
        stig_id: string;
      }>;
    }>;
  };
}

interface CreatePlanForm {
  name: string;
  description: string;
  selectedPrepList: string;
}

interface StpPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  source_mapping_id: string;
  stig_info: any;
  asset_info: any;
  prep_status: string;
  selected_controls: Array<{
    nist_control: string;
    ccis: string[];
    stigs: any[];
    compliance_status: string;
    risk_level: string;
    notes?: string;
    selected_for_stp: boolean;
  }>;
  control_count: number;
}

interface NessusPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  source_scan_id?: string;
  asset_info: any;
  selected_findings: string[];
  finding_count: number;
  scan_info?: any;
  summary?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface CombinedPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  type: 'stig' | 'nessus';
  count: number;
  source: string;
}

export default function SecurityTestPlan() {
  const [testPlans, setTestPlans] = useState<SecurityTestPlan[]>([]);
  const [stigMappings, setStigMappings] = useState<STIGMapping[]>([]);
  const [stpPrepLists, setStpPrepLists] = useState<StpPrepList[]>([]);
  const [nessusPrepLists, setNessusPrepLists] = useState<NessusPrepList[]>([]);
  const [combinedPrepLists, setCombinedPrepLists] = useState<CombinedPrepList[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SecurityTestPlan | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestCaseModal, setShowTestCaseModal] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createForm, setCreateForm] = useState<CreatePlanForm>({ name: '', description: '', selectedPrepList: '' });
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  
  // Evidence file states
  const [previewFile, setPreviewFile] = useState<{ 
    name: string; 
    path: string; 
    type: string; 
    testCaseId?: string; 
  } | null>(null);

  const { addToast } = useToast();
  const { currentSystem } = useSystem();
  const { setActiveTab } = useTabNavigation();

  // Combine STIG and Nessus prep lists for display
  const combinePrepLists = useCallback(() => {
    const combined: CombinedPrepList[] = [];
    
    // Add STIG prep lists
    stpPrepLists.forEach(list => {
      combined.push({
        id: `stig_${list.id}`,
        name: list.name,
        description: list.description,
        created_date: list.created_date,
        updated_date: list.updated_date,
        type: 'stig',
        count: list.control_count,
        source: `STIG Mapping: ${list.stig_info?.title || 'Unknown'}`
      });
    });
    
    // Add Nessus prep lists
    nessusPrepLists.forEach(list => {
      combined.push({
        id: `nessus_${list.id}`,
        name: list.name,
        description: list.description,
        created_date: list.created_date,
        updated_date: list.updated_date,
        type: 'nessus',
        count: list.finding_count,
        source: `Nessus Scan: ${list.scan_info?.name || 'Unknown'}`
      });
    });
    
    // Sort by updated date, most recent first
    combined.sort((a, b) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime());
    
    setCombinedPrepLists(combined);
  }, [stpPrepLists, nessusPrepLists]);

  // Load data on component mount
  useEffect(() => {
    if (currentSystem?.id) {
      loadInitialData();
    }
  }, [currentSystem]);

  // Combine prep lists when STIG or Nessus prep lists change
  useEffect(() => {
    combinePrepLists();
  }, [combinePrepLists]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTestPlans(), loadSTIGMappings(), loadStpPrepLists(), loadNessusPrepLists()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStpPrepLists = useCallback(async () => {
    if (!currentSystem?.id) return;
    
    try {
      const prepLists = await invoke<StpPrepList[]>('get_all_stp_prep_lists', { systemId: currentSystem.id });
      setStpPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading STP prep lists:', error);
      addToast('Failed to load STP prep lists', 'error');
    }
  }, [addToast, currentSystem]);

  const loadNessusPrepLists = useCallback(async () => {
    if (!currentSystem?.id) return;
    
    try {
      const prepLists = await invoke<NessusPrepList[]>('get_all_nessus_prep_lists', { systemId: currentSystem.id });
      setNessusPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading Nessus prep lists:', error);
      addToast('Failed to load Nessus prep lists', 'error');
    }
  }, [addToast, currentSystem]);

  const loadTestPlans = useCallback(async () => {
    if (!currentSystem?.id) return;
    
    try {
      const plans = await invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: currentSystem.id });
      setTestPlans(plans);
    } catch (error) {
      console.error('Error loading test plans:', error);
      addToast('Failed to load test plans', 'error');
    }
  }, [addToast, currentSystem]);

  const loadSTIGMappings = useCallback(async () => {
    if (!currentSystem?.id) return;
    
    try {
      const mappings = await invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: currentSystem.id });
      setStigMappings(mappings);
    } catch (error) {
      console.error('Error loading STIG mappings:', error);
      addToast('Failed to load STIG mappings', 'error');
    }
  }, [addToast, currentSystem]);

  const createTestPlanFromMapping = useCallback(async () => {
    if (!currentSystem?.id) {
      addToast('No system selected', 'error');
      return;
    }

    if (!createForm.name.trim()) {
      addToast('Please enter a test plan name', 'warning');
      return;
    }

    if (!createForm.selectedPrepList) {
      addToast('Please select a prep list', 'warning');
      return;
    }

    // Determine if it's a STIG or Nessus prep list
    const isNessus = createForm.selectedPrepList.startsWith('nessus_');
    const actualId = createForm.selectedPrepList.replace(/^(stig_|nessus_)/, '');
    
    let prepListData: any = null;
    let testCases: TestCase[] = [];

    if (isNessus) {
      // Handle Nessus prep list
      const nessusPrepList = nessusPrepLists.find(p => p.id === actualId);
      if (!nessusPrepList) {
        addToast('Selected Nessus prep list not found', 'error');
        return;
      }
      
      // Create individual test cases for each CVE/finding
      const selectedFindings = nessusPrepList.selected_findings || [];
      
      if (Array.isArray(selectedFindings) && selectedFindings.length > 0) {
        // Group findings by CVE or Plugin ID for efficient test case creation
        const findingGroups = new Map<string, any[]>();
        
        selectedFindings.forEach((finding: any) => {
          const identifier = finding.cve || finding.plugin_id || `PLUGIN-${finding.plugin_name || 'UNKNOWN'}`;
          if (!findingGroups.has(identifier)) {
            findingGroups.set(identifier, []);
          }
          findingGroups.get(identifier)?.push(finding);
        });
        
        // Create test cases for each CVE/Plugin group
        testCases = Array.from(findingGroups.entries()).map(([identifier, findings]) => {
          const firstFinding = findings[0];
          const affectedHosts = [...new Set(findings.map(f => f.host).filter(h => h))];
          const severity = firstFinding.severity || firstFinding.risk_factor || 'Medium';
          
          // Determine risk rating based on severity
          const getRiskRating = (sev: string) => {
            const s = sev.toLowerCase();
            if (s.includes('critical')) return 'Critical';
            if (s.includes('high')) return 'High';
            if (s.includes('medium')) return 'Medium';
            if (s.includes('low')) return 'Low';
            return 'Medium';
          };
          
          const isCVE = identifier.startsWith('CVE-');
          const testId = isCVE ? identifier : `PLUGIN-${firstFinding.plugin_id || 'UNK'}`;
          
          return {
            id: crypto.randomUUID(),
            nist_control: isCVE ? `CVE-${identifier.split('-')[1]}-${identifier.split('-')[2]}` : `NESSUS-${firstFinding.plugin_id || 'UNKNOWN'}`,
            cci_ref: isCVE ? identifier : 'N/A',
            stig_vuln_id: testId,
            test_description: `Validate and remediate ${identifier}: ${firstFinding.plugin_name || 'Unknown vulnerability'}`,
            test_procedure: `1. Verify presence of vulnerability on affected hosts: ${affectedHosts.join(', ') || 'Unknown hosts'}
2. Assess the risk and impact of this ${isCVE ? 'CVE' : 'vulnerability'}
3. Implement appropriate remediation measures
4. Validate remediation effectiveness
5. Document findings and remediation steps`,
            expected_result: `Vulnerability ${identifier} is successfully remediated on all affected systems with proper validation and documentation`,
            status: 'Not Started',
            risk_rating: getRiskRating(severity),
            notes: `${isCVE ? 'CVE' : 'Plugin'}: ${identifier}
Severity: ${severity}
Affected Hosts: ${affectedHosts.length} host(s) - ${affectedHosts.join(', ') || 'Unknown'}
Plugin: ${firstFinding.plugin_name || 'Unknown'}
CVSS Score: ${firstFinding.cvss_score || firstFinding.cvss_base_score || 'N/A'}
Description: ${firstFinding.synopsis || firstFinding.description || 'No description available'}
Solution: ${firstFinding.solution || 'Refer to vendor guidance'}
Source: Nessus Scan - ${nessusPrepList.scan_info?.name || 'Unknown scan'}`
          };
        });
      } else {
        // Fallback: Create a single test case if no detailed findings are available
        testCases = [
          {
            id: crypto.randomUUID(),
            nist_control: 'NESSUS-VALIDATION',
            cci_ref: 'N/A',
            stig_vuln_id: 'NESSUS-001',
            test_description: `Validate ${nessusPrepList.finding_count} Nessus vulnerability findings`,
            test_procedure: 'Review and validate the identified vulnerabilities from Nessus scan',
            expected_result: 'All vulnerabilities are properly documented and remediation plans are in place',
            status: 'Not Started',
            risk_rating: 'High',
            notes: `Nessus scan findings from: ${nessusPrepList.scan_info?.name || 'Unknown scan'}
Note: Detailed finding data not available for individual CVE test case generation.`
          }
        ];
      }
      
      prepListData = {
        source_type: 'nessus',
        source_id: nessusPrepList.id,
        name: nessusPrepList.name,
        finding_count: nessusPrepList.finding_count,
        test_case_count: testCases.length
      };
    } else {
      // Handle STIG prep list (existing logic)
      const prepList = stpPrepLists.find(p => p.id === actualId);
      if (!prepList) {
        addToast('Selected STIG prep list not found', 'error');
        return;
      }

      // Create test cases from STIG controls
      testCases = prepList.selected_controls
        .filter(control => control.selected_for_stp)
        .flatMap(control => 
          control.stigs.map(stig => ({
            id: crypto.randomUUID(),
            nist_control: control.nist_control,
            cci_ref: control.ccis.join(', '),
            stig_vuln_id: stig.vuln_num || stig.rule_id || 'Unknown',
            test_description: `Test NIST Control ${control.nist_control} - ${stig.rule_title || 'STIG Requirement'}`,
            test_procedure: stig.check_content || `Verify implementation of NIST Control ${control.nist_control}`,
            expected_result: stig.fix_text || 'Control is properly implemented and compliant',
            status: 'Not Started' as const,
            stig_compliance_status: stig.status || 'Not_Reviewed' as const,
            risk_rating: (stig.severity?.toLowerCase() === 'high' ? 'High' : 
                         stig.severity?.toLowerCase() === 'medium' ? 'Medium' : 'Low') as 'Low' | 'Medium' | 'High' | 'Critical',
            notes: control.notes
          }))
        );
      
      prepListData = {
        source_type: 'stig',
        source_id: prepList.id,
        stig_mapping_id: prepList.source_mapping_id,
        name: prepList.name,
        control_count: prepList.control_count
      };
    }

    setIsCreating(true);
    try {

      const newPlan: SecurityTestPlan = {
        id: crypto.randomUUID(),
        name: createForm.name,
        description: createForm.description || `Test plan generated from prep list: ${prepListData.name}`,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        status: 'Draft',
        stig_mapping_id: prepListData.source_type === 'stig' ? (prepListData.stig_mapping_id || null) : null,
        test_cases: testCases,
      };

      await invoke('save_security_test_plan', { plan: newPlan, systemId: currentSystem.id });
      
      setTestPlans(prev => [...prev, newPlan]);
      addToast(`Created test plan "${createForm.name}" with ${testCases.length} test cases`, 'success');
      
      // Reset form and close modal
      setCreateForm({ name: '', description: '', selectedPrepList: '' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating test plan:', error);
      addToast('Failed to create test plan', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [createForm.name, createForm.description, createForm.selectedPrepList, stpPrepLists, nessusPrepLists, addToast, currentSystem]);

  const updateTestCase = useCallback(async (plan_id: string, testCase: TestCase) => {
    if (!currentSystem?.id) return;

    setIsUpdating(true);
    try {
      const updatedPlans = testPlans.map(plan => {
        if (plan.id === plan_id) {
          const updatedTestCases = plan.test_cases.map(tc => 
            tc.id === testCase.id ? testCase : tc
          );
          return {
            ...plan,
            test_cases: updatedTestCases,
            updated_date: new Date().toISOString(),
          };
        }
        return plan;
      });

      const updatedPlan = updatedPlans.find(p => p.id === plan_id);
      if (updatedPlan) {
        await invoke('save_security_test_plan', { plan: updatedPlan, systemId: currentSystem.id });
        
        setTestPlans(updatedPlans);
        if (selectedPlan && selectedPlan.id === plan_id) {
          setSelectedPlan(updatedPlan);
        }
        
        addToast('Test case updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving test plan:', error);
      addToast('Failed to save test plan', 'error');
    } finally {
      setIsUpdating(false);
    }
  }, [testPlans, selectedPlan, addToast, currentSystem]);

  const handleDeleteTestPlan = useCallback(async (plan: SecurityTestPlan) => {
    if (!currentSystem?.id) return;

    setIsDeleting(plan.id);
    try {
      await invoke('delete_security_test_plan', { id: plan.id, systemId: currentSystem.id });
      
      setTestPlans(prev => prev.filter(p => p.id !== plan.id));
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null);
      }
      
      addToast(`Test plan "${plan.name}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting test plan:', error);
      addToast('Failed to delete test plan', 'error');
    } finally {
      setIsDeleting(null);
    }
  }, [selectedPlan, addToast, currentSystem]);

  const handleUpdatePlanStatus = useCallback(async (plan_id: string, newStatus: SecurityTestPlan['status']) => {
    if (!currentSystem?.id) return;

    setIsUpdating(true);
    try {
      const updatedPlans = testPlans.map(plan => {
        if (plan.id === plan_id) {
          return {
            ...plan,
            status: newStatus,
            updated_date: new Date().toISOString(),
          };
        }
        return plan;
      });

      const updatedPlan = updatedPlans.find(p => p.id === plan_id);
      if (updatedPlan) {
        await invoke('save_security_test_plan', { plan: updatedPlan, systemId: currentSystem.id });
        setTestPlans(updatedPlans);
        
        if (selectedPlan?.id === plan_id) {
          setSelectedPlan(updatedPlan);
        }
        
        addToast(`Test plan status updated to "${newStatus}"`, 'success');
      }
    } catch (error) {
      console.error('Error updating test plan status:', error);
      addToast('Failed to update test plan status', 'error');
    } finally {
      setIsUpdating(false);
    }
  }, [testPlans, selectedPlan, addToast, currentSystem]);



  const handleImportEvidencePackage = useCallback(async () => {
    if (!currentSystem?.id) return;

    setIsImporting(true);
    try {
      const selected = await open({
        filters: [{
          name: 'Evidence Package (ZIP)',
          extensions: ['zip']
        }]
      });
      
      if (!selected || selected === null) {
        addToast('Import cancelled', 'info');
        return;
      }

      // Try multiple parameter formats to debug the naming issue
      console.log('=== EVIDENCE PACKAGE IMPORT DEBUG ===');
      console.log('Selected file:', selected);
      console.log('System ID:', currentSystem.id);
      
      try {
        // Attempt 1: snake_case (what backend expects)
        console.log('Attempt 1: snake_case parameters');
        await invoke('import_evidence_package', {
          zip_file_path: selected,
          system_id: currentSystem.id
        });
        console.log('SUCCESS with snake_case parameters');
      } catch (error1) {
        console.log('FAILED with snake_case:', error1);
        
        try {
          // Attempt 2: camelCase
          console.log('Attempt 2: camelCase parameters');
          await invoke('import_evidence_package', {
            zipFilePath: selected,
            systemId: currentSystem.id
          });
          console.log('SUCCESS with camelCase parameters');
        } catch (error2) {
          console.log('FAILED with camelCase:', error2);
          
          try {
            // Attempt 3: Mixed format
            console.log('Attempt 3: Mixed parameters');
            await invoke('import_evidence_package', {
              zipFilePath: selected,
              system_id: currentSystem.id
            });
            console.log('SUCCESS with mixed parameters');
          } catch (error3) {
            console.log('FAILED all attempts');
            console.log('Error 1 (snake_case):', error1);
            console.log('Error 2 (camelCase):', error2);
            console.log('Error 3 (mixed):', error3);
            throw error3;
          }
        }
      }
      
      await loadTestPlans();
      addToast('Evidence package imported successfully', 'success');
    } catch (error) {
      console.error('Evidence package import error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      addToast(`Evidence package import failed: ${error}`, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [addToast, loadTestPlans, currentSystem]);

  const handleExportEvidencePackage = useCallback(async (plan: SecurityTestPlan) => {
    if (!currentSystem?.id) return;

    setIsExporting(true);
    try {
      const savePath = await save({
        filters: [{
          name: 'ZIP Files (Evidence Package)',
          extensions: ['zip']
        }],
        defaultPath: `${currentSystem.name}_${plan.name}_evidence_package.zip`
      });

      if (!savePath) {
        addToast('Export cancelled', 'info');
        return;
      }

      await invoke('export_evidence_package', {
        exportPath: savePath,
        testPlan: plan
      });
      
      addToast(`Evidence package exported successfully for "${plan.name}"`, 'success');
    } catch (error) {
      console.error('Evidence export error:', error);
      addToast(`Evidence export failed: ${error}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [addToast, currentSystem]);



  const handleDeleteEvidence = useCallback(async (testCaseId: string, fileName: string) => {
    if (!currentSystem?.id || !selectedPlan) {
      addToast('No test plan selected', 'error');
      return;
    }

    try {
      // Delete the physical file
      await invoke('delete_evidence_file', {
        plan_id: selectedPlan.id,
        test_case_id: testCaseId,
        file_name: fileName
      });

      // Update the test case to remove the file reference
      const updatedTestCases = selectedPlan.test_cases.map(tc => {
        if (tc.id === testCaseId) {
          return {
            ...tc,
            evidence_files: tc.evidence_files?.filter(filePath => 
              !filePath.endsWith(fileName)
            ) || []
          };
        }
        return tc;
      });

      const updatedPlan = {
        ...selectedPlan,
        test_cases: updatedTestCases,
        updated_date: new Date().toISOString()
      };

      // Save the updated test plan
      await invoke('save_security_test_plan', { 
        plan: updatedPlan, 
        systemId: currentSystem.id 
      });

      // Update local state
      setTestPlans(prev => prev.map(plan => 
        plan.id === selectedPlan.id ? updatedPlan : plan
      ));
      setSelectedPlan(updatedPlan);

      addToast(`Evidence file "${fileName}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting evidence:', error);
      addToast('Failed to delete evidence file', 'error');
    }
  }, [addToast, currentSystem, selectedPlan]);

    const handlePreviewFile = useCallback(async (filePath: string, testCaseId?: string) => {
    setPreviewFile({
      name: filePath.split('/').pop() || 'Unknown',
      path: filePath,
      type: filePath.split('.').pop()?.toLowerCase() || 'unknown',
      testCaseId
    });
  }, []);

  const openTestCaseModal = useCallback((testCase: TestCase) => {
    setEditingTestCase(testCase);
    setShowTestCaseModal(true);
  }, []);

  const filteredTestCases = selectedPlan?.test_cases.filter(tc => {
    const matchesFilter = tc.nist_control.toLowerCase().includes(filter.toLowerCase()) ||
                         tc.test_description.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tc.status === statusFilter;
    return matchesFilter && matchesStatus;
  }) || [];

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="mb-8 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon icon={Shield} size="lg" tone="primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Security Test Plans</h1>
                <p className="text-muted-foreground">Create and manage security testing procedures from STIG mappings</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-muted-foreground">Loading test plans...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show no system selected state
  if (!currentSystem) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No System Selected</h3>
          <p className="text-muted-foreground">Please select a system to manage security test plans.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="test-plan-main-header flex items-center justify-between flex-wrap lg:flex-nowrap">
          <div className="test-plan-header-content flex items-center gap-3 mb-4 lg:mb-0 title-row">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon={Shield} size="lg" tone="primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Security Test Plans</h1>
              <p className="text-muted-foreground">
                Create and manage security testing procedures for <strong>{currentSystem.name}</strong>
              </p>
            </div>
          </div>
          
          <div className="test-plan-header-actions flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={loading || isImporting || isExporting}
              onClick={handleImportEvidencePackage}
              title="Import a complete evidence package (ZIP file with test plan and evidence files)"
              className="flex-shrink-0"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Evidence Package'}</span>
              <span className="sm:hidden">{isImporting ? 'Importing...' : 'Import Package'}</span>
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              size="sm"
              disabled={loading || stpPrepLists.length === 0 || isImporting || isExporting}
              className="flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Test Plan
            </Button>
          </div>
        </div>
      </div>

      {/* Action Bar - Only show when there are test plans */}
      {testPlans.length > 0 && (
        <div className="mb-6 test-plan-action-bar flex items-center justify-between bg-muted/30 rounded-lg p-4 flex-wrap lg:flex-nowrap">
          <div className="test-plan-stats flex items-center gap-6 text-sm text-muted-foreground mb-4 lg:mb-0 w-full lg:w-auto">
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span>{testPlans.length} Plans</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>{testPlans.filter(p => p.status === 'Completed').length} Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{testPlans.filter(p => p.status === 'In Progress').length} In Progress</span>
            </div>
          </div>
          
          <div className="test-plan-actions flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={loading || isImporting || isExporting}
              onClick={handleImportEvidencePackage}
              title="Import complete evidence package (ZIP with test plan and evidence files)"
              className="flex-shrink-0"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Package'}</span>
              <span className="sm:hidden">{isImporting ? 'Importing...' : 'Import'}</span>
            </Button>
            {selectedPlan && (
            <Button 
                variant="outline" 
              size="sm"
                disabled={loading || isExporting || isImporting}
                onClick={() => handleExportEvidencePackage(selectedPlan)}
                title="Export complete evidence package (ZIP with test plan and evidence files)"
                className="flex-shrink-0"
            >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export Package</span>
                <span className="sm:hidden">Export</span>
            </Button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-full">
        {!selectedPlan ? (
          // Test Plan List View
          <TestPlanList
            testPlans={testPlans}
            loading={loading}
            isDeleting={isDeleting}
            filter={filter}
            setFilter={setFilter}
            onSelectPlan={setSelectedPlan}
            onCreateNew={() => setShowCreateModal(true)}
            onDeletePlan={handleDeleteTestPlan}
            hasSTIGMappings={stigMappings.length > 0}
            onImportEvidencePackage={handleImportEvidencePackage}
          />
        ) : (
          // Selected Test Plan Detail View
          <div className="space-y-6">
            {/* Plan Header */}
            <Card>
              <CardHeader>
                <div className="card-header-responsive flex items-center justify-between flex-wrap lg:flex-nowrap">
            <div className="flex items-center gap-3 mb-4 lg:mb-0">
              <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedPlan(null)}
                    >
                      ← Back to Plans
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedPlan.name}</h2>
                      <p className="text-muted-foreground">{selectedPlan.description}</p>
                    </div>
                  </div>
                  <div className="card-header-actions flex items-center gap-2 w-full lg:w-auto flex-wrap">
                    <Badge variant="outline" className="flex items-center gap-1">
                    <Icon icon={Calendar} size="sm" />
                      <span className="hidden sm:inline">{new Date(selectedPlan.created_date).toLocaleDateString()}</span>
                      <span className="sm:hidden">{new Date(selectedPlan.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </Badge>
                    <Badge variant="outline">
                      {selectedPlan.test_cases.length} Test Cases
                    </Badge>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground hidden sm:inline">Status:</label>
                      <select
                        value={selectedPlan.status}
                        onChange={(e) => handleUpdatePlanStatus(selectedPlan.id, e.target.value as SecurityTestPlan['status'])}
                        disabled={isUpdating}
                        className="px-2 py-1 border border-input rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Draft">Draft</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        try {
                          sessionStorage.setItem('createPOAMFromSTP', selectedPlan.id);
                        } catch (_) {}
                        setActiveTab('create-poam');
                      }}
                      title="Create a POAM from this Security Test Plan"
                    >
                      Create POAM from STP
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Test Cases Table */}
            <Card>
              <CardHeader>
                <div className="card-header-responsive flex items-center justify-between flex-wrap lg:flex-nowrap">
                  <CardTitle className="card-header-title mb-4 lg:mb-0">Test Cases</CardTitle>
                  <div className="test-case-filters flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search test cases..."
                        className="pl-10 pr-4 py-2 border border-input rounded-md text-sm w-full lg:w-auto"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </div>
                    <div className="relative flex-1 lg:flex-none">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-input rounded-md text-sm appearance-none w-full lg:w-auto"
                      >
                        <option value="all">All Status</option>
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                    <Button variant="outline" size="sm" title="Test Plan Settings" className="flex-shrink-0">
                      <Settings className="w-4 h-4" />
                      <span className="sr-only">Settings</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTestCases.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No test cases found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTestCases.map((testCase) => (
                      <div 
                        key={testCase.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => openTestCaseModal(testCase)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {testCase.nist_control}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {testCase.cci_ref}
                            </Badge>
                          </div>
                          <p className="font-medium">{testCase.test_description}</p>
                          <p className="text-sm text-muted-foreground">{testCase.test_procedure}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              testCase.status === 'Passed' ? 'success' :
                              testCase.status === 'Failed' ? 'destructive' :
                              testCase.status === 'In Progress' ? 'outline' :
                              'secondary'
                            }
                          >
                            {testCase.status}
                          </Badge>
                          {testCase.evidence_files && testCase.evidence_files.length > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {testCase.evidence_files.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Test Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Create New Test Plan</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Test Plan Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                  placeholder="Enter test plan name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                  rows={3}
                  placeholder="Enter test plan description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Prep List *</label>
                <select
                  value={createForm.selectedPrepList}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, selectedPrepList: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                >
                  <option value="">Select a prep list</option>
                  {combinedPrepLists.map((prepList) => (
                    <option key={prepList.id} value={prepList.id}>
                      {prepList.name} ({prepList.count} {prepList.type === 'nessus' ? 'findings' : 'controls'}) - {prepList.type.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={createTestPlanFromMapping}
                disabled={isCreating || !createForm.name.trim() || !createForm.selectedPrepList}
              >
                {isCreating ? 'Creating...' : 'Create Test Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test Case Modal */}
      {showTestCaseModal && editingTestCase && selectedPlan && (() => {
        // Find the current test case from the updated plan state
        const currentTestCase = selectedPlan.test_cases.find(tc => tc.id === editingTestCase.id) || editingTestCase;
        
        return (
          <TestCaseModal
            isOpen={showTestCaseModal}
            testCase={currentTestCase}
            selectedPlan={selectedPlan}
            isUpdating={isUpdating}
            onClose={() => {
              setShowTestCaseModal(false);
              setEditingTestCase(null);
            }}
            onSave={(testCase) => updateTestCase(selectedPlan.id, testCase)}
            onPreviewFile={(filePath) => handlePreviewFile(filePath, currentTestCase.id)}
          />
        );
      })()}

            {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {previewFile.type === 'pdf' ? (
                    <FileText className="w-5 h-5 text-red-500" />
                  ) : ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(previewFile.type) ? (
                    <Image className="w-5 h-5 text-blue-500" />
                  ) : previewFile.type === 'txt' ? (
                    <FileText className="w-5 h-5 text-green-500" />
                  ) : ['doc', 'docx'].includes(previewFile.type) ? (
                    <FileText className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{previewFile.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {previewFile.type.toUpperCase()} Evidence File
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewFile.testCaseId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Delete "${previewFile.name}"?`)) {
                        handleDeleteEvidence(previewFile.testCaseId!, previewFile.name);
                        setPreviewFile(null);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewFile(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-6 overflow-auto">
              {['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(previewFile.type) ? (
                // Image Preview - This would need backend support to actually load the image
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-4 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Image className="w-16 h-16 text-blue-500" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Screenshot Evidence</h4>
                    <p className="text-muted-foreground mb-4">
                      Image files contain visual evidence such as screenshots, configuration panels, or security findings.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>File:</strong> {previewFile.name}
                    </p>
                  </div>
                </div>
              ) : previewFile.type === 'pdf' ? (
                // PDF Preview
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-4 bg-red-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-16 h-16 text-red-500" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">PDF Document</h4>
                    <p className="text-muted-foreground mb-4">
                      PDF documents typically contain detailed reports, compliance documentation, or official security findings.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>File:</strong> {previewFile.name}
                    </p>
                  </div>
                </div>
              ) : previewFile.type === 'txt' ? (
                // Text File Preview  
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-4 bg-green-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-16 h-16 text-green-500" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Text Document</h4>
                    <p className="text-muted-foreground mb-4">
                      Text files often contain configuration details, log files, command outputs, or technical documentation.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>File:</strong> {previewFile.name}
                    </p>
                  </div>
                </div>
              ) : ['doc', 'docx'].includes(previewFile.type) ? (
                // Word Document Preview
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-4 bg-blue-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-16 h-16 text-blue-600" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Word Document</h4>
                    <p className="text-muted-foreground mb-4">
                      Word documents typically contain detailed analysis, test procedures, findings documentation, or formal reports.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>File:</strong> {previewFile.name}
                    </p>
                  </div>
                </div>
              ) : (
                // Generic File
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                      <Paperclip className="w-16 h-16 text-muted-foreground" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">{previewFile.type.toUpperCase()} File</h4>
                    <p className="text-muted-foreground mb-4">
                      This file contains evidence related to the security test case.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>File:</strong> {previewFile.name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with file path */}
            <div className="px-6 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground truncate" title={previewFile.path}>
                <strong>Path:</strong> {previewFile.path}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
