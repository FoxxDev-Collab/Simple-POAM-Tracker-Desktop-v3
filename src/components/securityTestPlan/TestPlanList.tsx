import { Plus, CheckCircle, Clock, AlertTriangle, Search, Trash2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

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

interface TestPlanListProps {
  testPlans: SecurityTestPlan[];
  loading: boolean;
  isDeleting: string | null;
  filter: string;
  setFilter: (filter: string) => void;
  onSelectPlan: (plan: SecurityTestPlan) => void;
  onCreateNew: () => void;
  onDeletePlan: (plan: SecurityTestPlan) => void;
  hasSTIGMappings: boolean;
  onImportEvidencePackage: () => void;
}

export default function TestPlanList({
  testPlans,
  loading,
  isDeleting,
  filter,
  setFilter,
  onSelectPlan,
  onCreateNew,
  onDeletePlan,
  hasSTIGMappings,
  onImportEvidencePackage
}: TestPlanListProps) {
  const getStatusBadge = (status: string) => {
    const config = {
      'Draft': { variant: 'secondary', icon: Clock },
      'In Progress': { variant: 'outline', icon: AlertTriangle },
      'Completed': { variant: 'success', icon: CheckCircle },
      'On Hold': { variant: 'warning', icon: AlertTriangle },
    };

    const { variant, icon: Icon } = config[status as keyof typeof config] || config['Draft'];

    return (
      <Badge variant={variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const calculateProgress = (plan: SecurityTestPlan) => {
    const total = plan.test_cases.length;
    const completed = plan.test_cases.filter(tc => 
      tc.status === 'Passed' || tc.status === 'Failed' || tc.status === 'Not Applicable'
    ).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const calculateEvidenceProgress = (plan: SecurityTestPlan) => {
    const total = plan.test_cases.length;
    const withEvidence = plan.test_cases.filter(tc => 
      tc.evidence_files && tc.evidence_files.length > 0
    ).length;
    return total > 0 ? Math.round((withEvidence / total) * 100) : 0;
  };

  const calculateOverallProgress = (plan: SecurityTestPlan) => {
    const testProgress = calculateProgress(plan);
    const evidenceProgress = calculateEvidenceProgress(plan);
    return Math.round((testProgress + evidenceProgress) / 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-muted-foreground">Loading test plans...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search test plans..."
            className="w-full px-3 py-2 pl-10 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Empty state for no saved mappings */}
      {!hasSTIGMappings && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <AlertTriangle className="w-16 h-16 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-foreground">No STIG Mappings Found</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              You need to create and save STIG mappings before creating test plans.
              <br />
              Go to <strong>STIG Center</strong> to create your first mapping.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Or</strong> import a complete evidence package if you have one:
            </p>
            <Button 
              variant="outline" 
              onClick={onImportEvidencePackage}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Evidence Package
            </Button>
          </div>
        </div>
      )}

      {/* Test Plans Grid */}
      {testPlans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testPlans.map(plan => (
            <Card key={plan.id} className="p-6 hover:shadow-lg transition-shadow relative group">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div 
                    className="cursor-pointer flex-1 mr-2"
                    onClick={() => onSelectPlan(plan)}
                  >
                    <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(plan.status)}
                    
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlan(plan);
                      }}
                      disabled={isDeleting === plan.id}
                      title="Delete test plan"
                    >
                      {isDeleting === plan.id ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div 
                  className="space-y-3 cursor-pointer"
                  onClick={() => onSelectPlan(plan)}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-foreground">
                      <span>Test Progress</span>
                      <span>{calculateProgress(plan)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${calculateProgress(plan)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-foreground">
                      <span>Evidence Collection</span>
                      <span>{calculateEvidenceProgress(plan)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${calculateEvidenceProgress(plan)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-1 border-t border-border">
                    <div className="flex justify-between text-sm font-medium text-foreground">
                      <span>Overall Completion</span>
                      <span>{calculateOverallProgress(plan)}%</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="flex justify-between text-sm text-muted-foreground cursor-pointer"
                  onClick={() => onSelectPlan(plan)}
                >
                  <span>{plan.test_cases.length} test cases</span>
                  <span>{new Date(plan.updated_date).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : hasSTIGMappings ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Plus className="w-16 h-16 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-foreground">No Test Plans Yet</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Create your first security test plan from a saved STIG mapping.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button 
                onClick={onCreateNew}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Test Plan
              </Button>
              <Button 
                variant="outline" 
                onClick={onImportEvidencePackage}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Evidence Package
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
} 