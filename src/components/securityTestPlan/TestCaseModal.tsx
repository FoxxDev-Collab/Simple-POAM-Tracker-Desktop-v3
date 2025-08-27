import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { useToast } from '../../context/ToastContext';
import EvidenceManager from './EvidenceManager';
import { TestCase, SecurityTestPlan } from '../../types/testPlan';


interface TestCaseModalProps {
  isOpen: boolean;
  testCase: TestCase;
  selectedPlan: SecurityTestPlan;
  isUpdating: boolean;
  onClose: () => void;
  onSave: (testCase: TestCase) => Promise<void>;
  onPreviewFile: (filePath: string) => void;
}

export default function TestCaseModal({
  isOpen,
  testCase: initialTestCase,
  selectedPlan,
  isUpdating,
  onClose,
  onSave,
  onPreviewFile
}: TestCaseModalProps) {
  const [editingTestCase, setEditingTestCase] = useState<TestCase>(initialTestCase);
  const [isUploadingEvidenceLocal, setIsUploadingEvidenceLocal] = useState(false);
  const { addToast } = useToast();

  // Update the editing test case when the prop changes (for evidence updates)
  useEffect(() => {
    setEditingTestCase(initialTestCase);
  }, [initialTestCase]);



  const handleSave = useCallback(async () => {
    try {
      await onSave({
        ...editingTestCase,
        tested_date: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      console.error('Error saving test case:', error);
      addToast('Failed to save test case', 'error');
    }
  }, [editingTestCase, onSave, onClose, addToast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl flex flex-col transition-all duration-200 w-full max-w-6xl h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Edit {editingTestCase.source_type === 'stig' ? 'STIG' : 'Nessus'} Test Case
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingTestCase.source_type === 'stig' ? (
                  <>
                    {editingTestCase.nist_control} • {editingTestCase.cci_ref} • {editingTestCase.stig_vuln_id}
                  </>
                ) : (
                  <>
                    {editingTestCase.cve_id && `${editingTestCase.cve_id} • `}
                    {editingTestCase.plugin_id && `Plugin ${editingTestCase.plugin_id} • `}
                    {editingTestCase.severity} Risk
                  </>
                )}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader className="pb-4">
              <h3 className="text-lg font-semibold">
                {editingTestCase.source_type === 'stig' ? 'STIG' : 'Nessus'} Test Information
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conditional rendering based on source type */}
              {editingTestCase.source_type === 'stig' ? (
                // STIG-specific fields
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">NIST Control</label>
                      <input
                        type="text"
                        value={editingTestCase.nist_control}
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">CCI Reference</label>
                      <input
                        type="text"
                        value={editingTestCase.cci_ref}
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">STIG Vulnerability ID</label>
                      <input
                        type="text"
                        value={editingTestCase.stig_vuln_id}
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Test Status *</label>
                      <select
                        value={editingTestCase.status}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          status: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">STIG Compliance Status</label>
                      <select
                        value={editingTestCase.stig_compliance_status || 'Not_Reviewed'}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          stig_compliance_status: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Not_Reviewed">Not Reviewed</option>
                        <option value="Open">Open (Non-Compliant)</option>
                        <option value="NotAFinding">Not a Finding (Compliant)</option>
                        <option value="Not_Applicable">Not Applicable</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This updates the original STIG mapping compliance status
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Risk Rating</label>
                      <select
                        value={editingTestCase.risk_rating}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          risk_rating: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                // Nessus-specific fields
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {editingTestCase.cve_id && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">CVE ID</label>
                        <input
                          type="text"
                          value={editingTestCase.cve_id}
                          className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                          disabled
                        />
                      </div>
                    )}
                    {editingTestCase.plugin_id && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Plugin ID</label>
                        <input
                          type="text"
                          value={editingTestCase.plugin_id}
                          className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                          disabled
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Plugin Name</label>
                      <input
                        type="text"
                        value={editingTestCase.plugin_name || 'Unknown Plugin'}
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Test Status *</label>
                      <select
                        value={editingTestCase.status}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          status: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Severity</label>
                      <input
                        type="text"
                        value={editingTestCase.severity || 'Unknown'}
                        className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                        disabled
                      />
                    </div>
                    {editingTestCase.cvss_score && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">CVSS Score</label>
                        <input
                          type="text"
                          value={editingTestCase.cvss_score}
                          className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground"
                          disabled
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Nessus Compliance Status</label>
                      <select
                        value={editingTestCase.nessus_compliance_status || 'Open'}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          nessus_compliance_status: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Open">Open (Needs Remediation)</option>
                        <option value="Fixed">Fixed (Remediated)</option>
                        <option value="Exception">Exception (Approved)</option>
                        <option value="Not_Applicable">Not Applicable</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current remediation status for this vulnerability
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Risk Rating</label>
                      <select
                        value={editingTestCase.risk_rating}
                        onChange={(e) => setEditingTestCase(prev => ({
                          ...prev,
                          risk_rating: e.target.value as any
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  
                  {editingTestCase.affected_hosts && editingTestCase.affected_hosts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Affected Hosts ({editingTestCase.affected_hosts.length})</label>
                      <div className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-muted-foreground max-h-20 overflow-y-auto">
                        {editingTestCase.affected_hosts.join(', ')}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Common fields for both types */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Tested By</label>
                  <input
                    type="text"
                    value={editingTestCase.tested_by || ''}
                    onChange={(e) => setEditingTestCase(prev => ({
                      ...prev,
                      tested_by: e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    placeholder="Enter tester name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Test Date</label>
                  <input
                    type="datetime-local"
                    value={editingTestCase.tested_date ? new Date(editingTestCase.tested_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingTestCase(prev => ({
                      ...prev,
                      tested_date: e.target.value ? new Date(e.target.value).toISOString() : undefined
                    }))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Details Card */}
          <Card>
            <CardHeader className="pb-4">
              <h3 className="text-lg font-semibold">Test Details</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Test Description</label>
                <textarea
                  value={editingTestCase.test_description}
                  onChange={(e) => setEditingTestCase(prev => ({
                    ...prev,
                    test_description: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-24 resize-y"
                  placeholder="Brief description of what this test validates..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Test Procedure</label>
                <textarea
                  value={editingTestCase.test_procedure}
                  onChange={(e) => setEditingTestCase(prev => ({
                    ...prev,
                    test_procedure: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-32 resize-y"
                  placeholder="Detailed step-by-step procedure for conducting this test..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Expected Result</label>
                <textarea
                  value={editingTestCase.expected_result}
                  onChange={(e) => setEditingTestCase(prev => ({
                    ...prev,
                    expected_result: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-28 resize-y"
                  placeholder="What should happen when the test is performed correctly..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Results Card */}
          <Card>
            <CardHeader className="pb-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Actual Result</label>
                <textarea
                  value={editingTestCase.actual_result || ''}
                  onChange={(e) => setEditingTestCase(prev => ({
                    ...prev,
                    actual_result: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-48 resize-y"
                  placeholder="Document the actual test results, observations, and any deviations from expected results..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Notes & Additional Information</label>
                <textarea
                  value={editingTestCase.notes || ''}
                  onChange={(e) => setEditingTestCase(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-48 resize-y"
                  placeholder="Additional notes, observations, recommendations, or any other relevant information..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Evidence Files Card */}
          <Card>
            <CardContent>
              <EvidenceManager
                testCase={editingTestCase}
                selectedPlan={selectedPlan}
                onTestCaseUpdate={async (updatedTestCase) => {
                  setEditingTestCase(updatedTestCase);
                  await onSave(updatedTestCase);
                }}
                onPreviewFile={onPreviewFile}
                isUploadingEvidence={isUploadingEvidenceLocal}
                setIsUploadingEvidence={setIsUploadingEvidenceLocal}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-card rounded-b-lg flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            Last updated: {editingTestCase.tested_date ? new Date(editingTestCase.tested_date).toLocaleString() : 'Never'}
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              disabled={isUpdating}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              loading={isUpdating}
              disabled={isUpdating}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 