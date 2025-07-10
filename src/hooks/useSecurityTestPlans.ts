import { useState, useCallback, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

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

export function useSecurityTestPlans() {
  const [testPlans, setTestPlans] = useState<SecurityTestPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SecurityTestPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { addToast } = useToast();

  // Load test plans from backend
  const loadTestPlans = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const plans = await invoke<SecurityTestPlan[]>('get_all_security_test_plans');
      setTestPlans(plans);
      
      // Update selectedPlan if it exists in the new plans (to keep it in sync)
      if (selectedPlan) {
        const updatedSelectedPlan = plans.find(p => p.id === selectedPlan.id);
        if (updatedSelectedPlan) {
          setSelectedPlan(updatedSelectedPlan);
        } else {
          // Plan was deleted, clear selection
          setSelectedPlan(null);
        }
      }
    } catch (error) {
      console.error('Error loading test plans:', error);
      addToast('Failed to load test plans', 'error');
    }
  }, [selectedPlan, addToast]);

  // Update test case and keep states in sync
  const updateTestCase = useCallback(async (plan_id: string, testCase: TestCase) => {
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
        const { invoke } = await import('@tauri-apps/api/core');
        
        // Save the updated test plan
        await invoke('save_security_test_plan', { plan: updatedPlan });
        
        // Update both states atomically to prevent sync issues
        setTestPlans(updatedPlans);
        if (selectedPlan && selectedPlan.id === plan_id) {
          setSelectedPlan(updatedPlan);
        }
        
        addToast('Test case updated successfully', 'success');
        return updatedPlan;
      }
    } catch (error) {
      console.error('Error saving test plan:', error);
      addToast('Failed to save test plan', 'error');
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [testPlans, selectedPlan, addToast]);

  // Update test plan status
  const updateTestPlanStatus = useCallback(async (plan_id: string, newStatus: SecurityTestPlan['status']) => {
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
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_security_test_plan', { plan: updatedPlan });
        
        setTestPlans(updatedPlans);
        if (selectedPlan && selectedPlan.id === plan_id) {
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
  }, [testPlans, selectedPlan, addToast]);

  // Delete test plan
  const deleteTestPlan = useCallback(async (plan_id: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_security_test_plan', { id: plan_id });
      
      // Remove from local state
      setTestPlans(prev => prev.filter(p => p.id !== plan_id));
      
      // If we're viewing the deleted plan, go back to list
      if (selectedPlan && selectedPlan.id === plan_id) {
        setSelectedPlan(null);
      }
      
      const planName = testPlans.find(p => p.id === plan_id)?.name || 'Plan';
      addToast(`Test plan "${planName}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting test plan:', error);
      addToast('Failed to delete test plan', 'error');
      throw error;
    }
  }, [testPlans, selectedPlan, addToast]);

  // Add new test plan
  const addTestPlan = useCallback((newPlan: SecurityTestPlan) => {
    setTestPlans(prev => [...prev, newPlan]);
  }, []);

  // Refresh selected plan to ensure it's up to date
  const refreshSelectedPlan = useCallback(() => {
    if (selectedPlan) {
      const updatedPlan = testPlans.find(p => p.id === selectedPlan.id);
      if (updatedPlan && JSON.stringify(updatedPlan) !== JSON.stringify(selectedPlan)) {
        setSelectedPlan(updatedPlan);
      }
    }
  }, [selectedPlan, testPlans]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await loadTestPlans();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Auto-refresh selected plan when testPlans change
  useEffect(() => {
    refreshSelectedPlan();
  }, [testPlans]);

  return {
    // State
    testPlans,
    selectedPlan,
    loading,
    isUpdating,
    
    // Actions
    setSelectedPlan,
    loadTestPlans,
    updateTestCase,
    updateTestPlanStatus,
    deleteTestPlan,
    addTestPlan,
    refreshSelectedPlan
  };
} 