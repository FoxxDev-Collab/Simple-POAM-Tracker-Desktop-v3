import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { 
  Shield, 
  BarChart3, 
  Search, 
  Filter, 
  ExternalLink,
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface TestCase {
  id: string;
  status: 'Not Started' | 'In Progress' | 'Passed' | 'Failed' | 'Not Applicable';
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
  test_cases: TestCase[];
  overall_score?: number;
}

interface SystemSTPData {
  systemId: string;
  systemName: string;
  testPlans: SecurityTestPlan[];
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  draftPlans: number;
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  overallProgress: number;
  lastUpdated: string;
}

interface GroupSTPs {
  groupId: string;
  systems: any[];
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

export default function GroupSTPs({ systems, onSwitchToSystem }: GroupSTPs) {
  const [systemSTPs, setSystemSTPs] = useState<SystemSTPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  
  const { showToast } = useToast();

  // Load STPs for all systems in the group
  const loadGroupSTPs = useCallback(async () => {
    if (!systems || systems.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('GroupSTPs: Loading STPs for all systems in group');
      
      // Load STPs for each system in parallel
      const systemPromises = systems.map(async (system) => {
        try {
          const testPlans = await invoke<SecurityTestPlan[]>('get_all_security_test_plans', { 
            systemId: system.id 
          });
          
          // Calculate statistics
          const totalPlans = testPlans.length;
          const completedPlans = testPlans.filter(p => p.status === 'Completed').length;
          const inProgressPlans = testPlans.filter(p => p.status === 'In Progress').length;
          const draftPlans = testPlans.filter(p => p.status === 'Draft').length;
          
          const allTestCases = testPlans.flatMap(p => p.test_cases || []);
          const totalTestCases = allTestCases.length;
          const passedTestCases = allTestCases.filter(tc => tc.status === 'Passed').length;
          const failedTestCases = allTestCases.filter(tc => tc.status === 'Failed').length;
          
          const overallProgress = totalTestCases > 0 ? Math.round((passedTestCases / totalTestCases) * 100) : 0;
          
          // Find most recent update
          const lastUpdated = testPlans.length > 0 
            ? testPlans.reduce((latest, plan) => 
                plan.updated_date > latest ? plan.updated_date : latest, 
                testPlans[0].updated_date
              )
            : '';
          
          return {
            systemId: system.id,
            systemName: system.name,
            testPlans,
            totalPlans,
            completedPlans,
            inProgressPlans,
            draftPlans,
            totalTestCases,
            passedTestCases,
            failedTestCases,
            overallProgress,
            lastUpdated
          };
        } catch (error) {
          console.error(`Error loading STPs for system ${system.name}:`, error);
          return {
            systemId: system.id,
            systemName: system.name,
            testPlans: [],
            totalPlans: 0,
            completedPlans: 0,
            inProgressPlans: 0,
            draftPlans: 0,
            totalTestCases: 0,
            passedTestCases: 0,
            failedTestCases: 0,
            overallProgress: 0,
            lastUpdated: ''
          };
        }
      });
      
      const results = await Promise.all(systemPromises);
      setSystemSTPs(results);
      
    } catch (error) {
      console.error('Error loading group STPs:', error);
      showToast('error', `Failed to load group STPs: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [systems, showToast]);

  useEffect(() => {
    loadGroupSTPs();
  }, [loadGroupSTPs]);

  // Filter and sort systems
  const filteredSystems = systemSTPs.filter(system => {
    const matchesSearch = system.systemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         system.testPlans.some(plan => plan.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (statusFilter === 'has-stps') return matchesSearch && system.totalPlans > 0;
    if (statusFilter === 'no-stps') return matchesSearch && system.totalPlans === 0;
    if (statusFilter === 'active') return matchesSearch && system.inProgressPlans > 0;
    if (statusFilter === 'completed') return matchesSearch && system.completedPlans > 0;
    
    return matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.systemName.localeCompare(b.systemName);
      case 'plans': return b.totalPlans - a.totalPlans;
      case 'progress': return b.overallProgress - a.overallProgress;
      case 'updated': return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      default: return 0;
    }
  });

  // Calculate group-wide statistics
  const groupStats = {
    totalSystems: systems.length,
    systemsWithSTPs: systemSTPs.filter(s => s.totalPlans > 0).length,
    totalSTPs: systemSTPs.reduce((sum, s) => sum + s.totalPlans, 0),
    totalTestCases: systemSTPs.reduce((sum, s) => sum + s.totalTestCases, 0),
    passedTestCases: systemSTPs.reduce((sum, s) => sum + s.passedTestCases, 0),
    averageProgress: systemSTPs.length > 0 ? 
      Math.round(systemSTPs.reduce((sum, s) => sum + s.overallProgress, 0) / systemSTPs.length) : 0
  };

  const handleViewSystemSTP = (systemId: string) => {
    if (onSwitchToSystem) {
      onSwitchToSystem(systemId, 'security-test-plan');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'On Hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600';
    if (progress >= 60) return 'text-blue-600';
    if (progress >= 40) return 'text-yellow-600';
    return 'text-red-600';
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
            <h1 className="text-3xl font-bold text-foreground">Group Security Test Plans</h1>
            <p className="text-muted-foreground">
              Monitor and manage STPs across all group systems
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <Button
            onClick={loadGroupSTPs}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Group Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Systems with STPs</p>
                <p className="text-2xl font-bold text-foreground">
                  {groupStats.systemsWithSTPs}/{groupStats.totalSystems}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total STPs</p>
                <p className="text-2xl font-bold text-foreground">{groupStats.totalSTPs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Test Cases</p>
                <p className="text-2xl font-bold text-foreground">
                  {groupStats.passedTestCases}/{groupStats.totalTestCases}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
                <p className={`text-2xl font-bold ${getProgressColor(groupStats.averageProgress)}`}>
                  {groupStats.averageProgress}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search systems or STPs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Systems</SelectItem>
                <SelectItem value="has-stps">Systems with STPs</SelectItem>
                <SelectItem value="no-stps">Systems without STPs</SelectItem>
                <SelectItem value="active">Active Testing</SelectItem>
                <SelectItem value="completed">Has Completed STPs</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">System Name</SelectItem>
                <SelectItem value="plans">STP Count</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="updated">Last Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Systems Overview */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading group STPs...</p>
        </div>
      ) : filteredSystems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {systemSTPs.length === 0 
                ? 'No systems found in this group.' 
                : 'No systems match the current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSystems.map((system) => (
            <Card key={system.systemId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{system.systemName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {system.totalPlans} STPs • {system.totalTestCases} test cases
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {system.totalPlans > 0 && (
                      <div className={`text-right ${getProgressColor(system.overallProgress)}`}>
                        <div className="text-sm font-medium">{system.overallProgress}% Complete</div>
                        <div className="text-xs text-muted-foreground">
                          {system.passedTestCases}/{system.totalTestCases} tests passed
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={() => handleViewSystemSTP(system.systemId)}
                      variant={system.totalPlans > 0 ? "default" : "outline"}
                      className="flex items-center gap-2"
                    >
                      {system.totalPlans > 0 ? (
                        <>
                          <ExternalLink className="h-4 w-4" />
                          View STPs
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Create STP
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {system.totalPlans > 0 ? (
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${system.overallProgress}%` }}
                      />
                    </div>
                    
                    {/* STP Status Summary */}
                    <div className="flex flex-wrap gap-2">
                      {system.completedPlans > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {system.completedPlans} Completed
                        </Badge>
                      )}
                      {system.inProgressPlans > 0 && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {system.inProgressPlans} In Progress
                        </Badge>
                      )}
                      {system.draftPlans > 0 && (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                          {system.draftPlans} Draft
                        </Badge>
                      )}
                    </div>

                    {/* Recent STPs */}
                    {system.testPlans.slice(0, 3).map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{plan.name}</div>
                          {plan.description && (
                            <div className="text-xs text-muted-foreground truncate">{plan.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
                          <div className="text-xs text-muted-foreground">
                            {plan.test_cases?.length || 0} tests
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {system.testPlans.length > 3 && (
                      <div className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewSystemSTP(system.systemId)}
                          className="text-xs"
                        >
                          View {system.testPlans.length - 3} more STPs...
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No Security Test Plans created yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
