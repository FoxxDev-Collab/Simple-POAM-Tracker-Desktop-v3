import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, Eye, Trash2, Paperclip, FileText, Image } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';

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

interface EvidenceManagerProps {
  testCase: TestCase;
  selectedPlan: SecurityTestPlan;
  onTestCaseUpdate: (updatedTestCase: TestCase) => Promise<void>;
  onPreviewFile: (filePath: string) => void;
  isUploadingEvidence: boolean;
  setIsUploadingEvidence: (loading: boolean) => void;
}

export default function EvidenceManager({
  testCase,
  selectedPlan,
  onTestCaseUpdate,
  onPreviewFile,
  isUploadingEvidence,
  setIsUploadingEvidence
}: EvidenceManagerProps) {
  const { addToast } = useToast();
  const { currentSystem } = useSystem();

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(extension)) {
      return <Image className="w-4 h-4 text-blue-500" />;
    } else if (['pdf'].includes(extension)) {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else if (['txt'].includes(extension)) {
      return <FileText className="w-4 h-4 text-green-500" />;
    } else if (['doc', 'docx'].includes(extension)) {
      return <FileText className="w-4 h-4 text-blue-600" />;
    } else {
      return <Paperclip className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleEvidenceUpload = useCallback(async () => {
    if (!currentSystem?.id || !selectedPlan) {
      addToast('No test plan selected', 'error');
      return;
    }

    console.log('=== EVIDENCE UPLOAD DEBUG ===');
    console.log('Current System ID:', currentSystem.id);
    console.log('Selected Plan ID:', selectedPlan.id);
    console.log('Test Case ID:', testCase.id);

    setIsUploadingEvidence(true);
    try {
      // File selection
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Evidence Files',
          extensions: ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'doc', 'docx', 'xlsx', 'pptx']
        }]
      });
      
      if (!selected || !Array.isArray(selected) || selected.length === 0) {
        addToast('No files selected', 'info');
        return;
      }

      console.log('Selected files:', selected);

      // Prepare parameters - trying multiple variations to debug the issue
      const params1 = {
        plan_id: selectedPlan.id,
        test_case_id: testCase.id,
        file_paths: selected
      };

      const params2 = {
        planId: selectedPlan.id,
        testCaseId: testCase.id,
        filePaths: selected
      };

      const params3 = {
        plan_id: selectedPlan.id,
        test_case_id: testCase.id,
        file_paths: selected,
        system_id: currentSystem.id
      };

      console.log('Attempt 1 - snake_case params:', params1);
      
      try {
        // First attempt with snake_case (what the backend expects)
        const copiedFilePaths = await invoke<string[]>('copy_evidence_files', params1);
        console.log('SUCCESS with snake_case params. Copied files:', copiedFilePaths);
        
        // Update the test case with new evidence files
        const updatedTestCase = {
          ...testCase,
          evidence_files: [...(testCase.evidence_files || []), ...copiedFilePaths]
        };

        await onTestCaseUpdate(updatedTestCase);
        addToast(`${selected.length} evidence files uploaded successfully`, 'success');
        return;

      } catch (error1) {
        console.log('FAILED with snake_case params:', error1);
        console.log('Attempt 2 - camelCase params:', params2);
        
        try {
          // Second attempt with camelCase
          const copiedFilePaths = await invoke<string[]>('copy_evidence_files', params2);
          console.log('SUCCESS with camelCase params. Copied files:', copiedFilePaths);
          
          const updatedTestCase = {
            ...testCase,
            evidence_files: [...(testCase.evidence_files || []), ...copiedFilePaths]
          };

          await onTestCaseUpdate(updatedTestCase);
          addToast(`${selected.length} evidence files uploaded successfully`, 'success');
          return;

        } catch (error2) {
          console.log('FAILED with camelCase params:', error2);
          console.log('Attempt 3 - snake_case with system_id:', params3);
          
          try {
            // Third attempt with system_id included
            const copiedFilePaths = await invoke<string[]>('copy_evidence_files', params3);
            console.log('SUCCESS with system_id included. Copied files:', copiedFilePaths);
            
            const updatedTestCase = {
              ...testCase,
              evidence_files: [...(testCase.evidence_files || []), ...copiedFilePaths]
            };

            await onTestCaseUpdate(updatedTestCase);
            addToast(`${selected.length} evidence files uploaded successfully`, 'success');
            return;

          } catch (error3) {
            console.log('FAILED all attempts');
            console.log('Error 1 (snake_case):', error1);
            console.log('Error 2 (camelCase):', error2);
            console.log('Error 3 (with system_id):', error3);
            throw error3;
          }
        }
      }

    } catch (error) {
      console.error('=== FINAL ERROR ===');
      console.error('Error uploading evidence:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      addToast('Failed to upload evidence files', 'error');
    } finally {
      setIsUploadingEvidence(false);
      console.log('=== END EVIDENCE UPLOAD DEBUG ===');
    }
  }, [currentSystem, selectedPlan, testCase, onTestCaseUpdate, addToast, setIsUploadingEvidence]);

  const handleDeleteEvidence = useCallback(async (fileName: string) => {
    if (!currentSystem?.id || !selectedPlan) {
      addToast('No test plan selected', 'error');
      return;
    }

    console.log('=== EVIDENCE DELETE DEBUG ===');
    console.log('Deleting file:', fileName);
    console.log('Plan ID:', selectedPlan.id);
    console.log('Test Case ID:', testCase.id);

    try {
      // Try multiple parameter variations for delete as well
      const params1 = {
        plan_id: selectedPlan.id,
        test_case_id: testCase.id,
        file_name: fileName
      };

      const params2 = {
        planId: selectedPlan.id,
        testCaseId: testCase.id,
        fileName: fileName
      };

      console.log('Delete attempt 1 - snake_case:', params1);

      try {
        await invoke('delete_evidence_file', params1);
        console.log('SUCCESS deleting with snake_case');
      } catch (error1) {
        console.log('FAILED delete with snake_case:', error1);
        console.log('Delete attempt 2 - camelCase:', params2);
        
        try {
          await invoke('delete_evidence_file', params2);
          console.log('SUCCESS deleting with camelCase');
        } catch (error2) {
          console.log('FAILED delete with camelCase:', error2);
          throw error2;
        }
      }

      // Update the test case to remove the file reference
      const updatedTestCase = {
        ...testCase,
        evidence_files: testCase.evidence_files?.filter(filePath => 
          !filePath.endsWith(fileName)
        ) || []
      };

      await onTestCaseUpdate(updatedTestCase);
      addToast(`Evidence file "${fileName}" deleted successfully`, 'success');

    } catch (error) {
      console.error('=== FINAL DELETE ERROR ===');
      console.error('Error deleting evidence:', error);
      addToast('Failed to delete evidence file', 'error');
    } finally {
      console.log('=== END EVIDENCE DELETE DEBUG ===');
    }
  }, [currentSystem, selectedPlan, testCase, onTestCaseUpdate, addToast]);

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Evidence Files</h3>
          <p className="text-sm text-muted-foreground">
            Upload screenshots, documents, code samples, and other evidence to support your test results
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEvidenceUpload}
          disabled={isUploadingEvidence}
          loading={isUploadingEvidence}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploadingEvidence ? 'Uploading...' : 'Upload Files'}
        </Button>
      </div>

      {/* Files List */}
      {testCase.evidence_files && testCase.evidence_files.length > 0 ? (
        <div className="space-y-3">
          {testCase.evidence_files.map((filePath, index) => {
            const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
            return (
              <div key={`evidence-${index}-${fileName}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  {getFileIcon(fileName)}
                  <div>
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {filePath.includes('/') ? filePath.split('/').slice(-2, -1)[0] : 'Evidence'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreviewFile(filePath)}
                    className="h-8 w-8 p-0"
                    title="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
                        handleDeleteEvidence(fileName);
                      }
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Paperclip className="w-12 h-12 text-muted-foreground" />
            <h4 className="text-lg font-medium text-foreground">No Evidence Files</h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Upload screenshots, documents, or other files to document your test evidence.
              This will help build your compliance evidence package.
            </p>
            <Button
              variant="outline"
              onClick={handleEvidenceUpload}
              disabled={isUploadingEvidence}
              loading={isUploadingEvidence}
              className="mt-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload First File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 