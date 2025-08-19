import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Building,
  Target,
  Shield,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Zap,
  Activity,
  Database,
  Settings,
  Search,
  Filter,
  Eye,
  ExternalLink,
  BarChart3,
  
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
 
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';

interface GroupOverviewProps {
  group: any;
  systems: any[];
  onExit: () => void;
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

interface SystemStats {
  systemId: string;
  systemName: string;
  systemDescription?: string;
  systemOwner?: string;
  systemClassification?: string;
  systemTags?: string[];
  poamCount: number;
  openPoams: number;
  closedPoams: number;
  overduePoams: number;
  criticalPoams: number;
  highPoams: number;
  mediumPoams: number;
  lowPoams: number;
  noteCount: number;
  stigMappingCount: number;
  testPlanCount: number;
  nessusScans: any[];
  lastAccessed?: string;
  riskScore: number;
  complianceScore: number;
  topVulnerabilities: VulnerabilityIssue[];
  recentActivity: ActivityItem[];
  securityHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

interface VulnerabilityIssue {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  type: 'POAM' | 'STIG' | 'Nessus';
  daysOpen: number;
  source: string;
}

interface ActivityItem {
  id: string;
  type: 'poam_created' | 'poam_closed' | 'milestone_completed' | 'test_plan_updated' | 'note_added';
  title: string;
  timestamp: string;
  user?: string;
}

interface AggregatedStats {
  totalSystems: number;
  totalPoams: number;
  totalOpenPoams: number;
  totalClosedPoams: number;
  totalOverduePoams: number;
  totalNotes: number;
  totalStigMappings: number;
  totalTestPlans: number;
}

export default function EnhancedGroupOverview({ group, systems, onExit, onSwitchToSystem }: GroupOverviewProps) {
  const [systemStats, setSystemStats] = useState<SystemStats[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats>({
    totalSystems: 0,
    totalPoams: 0,
    totalOpenPoams: 0,
    totalClosedPoams: 0,
    totalOverduePoams: 0,
    totalNotes: 0,
    totalStigMappings: 0,
    totalTestPlans: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'riskScore', 
    direction: 'desc' 
  });
  const [filterBy, setFilterBy] = useState<'all' | 'high-risk' | 'overdue' | 'active'>('all');
  
  const { showToast } = useToast();
  const { setCurrentSystem, systems: allSystems } = useSystem();

  // Handle system action buttons
  const handleSystemAction = async (systemId: string, action: 'view' | 'manage' | 'reports') => {
    try {
      // Find the system in allSystems to get full SystemSummary object
      const targetSystem = allSystems.find(s => s.id === systemId);
      if (!targetSystem) {
        showToast('error', 'System not found');
        return;
      }

      // Switch to the target system
      await setCurrentSystem(targetSystem);

      // Determine target tab based on action
      let targetTab: string;
      switch (action) {
        case 'view':
          targetTab = 'dashboard';
          break;
        case 'manage':
          targetTab = 'settings';
          break;
        case 'reports':
          targetTab = 'metrics';
          break;
        default:
          targetTab = 'dashboard';
      }

      // Use callback if provided, otherwise exit group view
      if (onSwitchToSystem) {
        onSwitchToSystem(systemId, targetTab);
      } else {
        onExit();
      }

      showToast('success', `Switched to ${targetSystem.name}`);
    } catch (error) {
      console.error('Failed to switch system:', error);
      showToast('error', 'Failed to switch to system');
    }
  };

  useEffect(() => {
    if (systems.length > 0) {
      loadSystemsStats();
    }
  }, [systems]);

  const calculateComprehensiveRiskScore = (
    poams: any[], 
    stigMappings: any[], 
    testPlans: any[], 
    nessusScans?: any[]
  ): number => {
    let riskFactors = 0;
    let maxRiskFactors = 0;
    
    // 1. POAM Risk Assessment (40% weight)
    let poamRisk = 0;
    let poamWeight = 40;
    
    if (poams.length > 0) {
      const openPoams = poams.filter(p => p.status !== 'Closed' && p.status !== 'Completed');
      const criticalPoams = openPoams.filter(p => p.priority === 'Critical').length;
      const highPoams = openPoams.filter(p => p.priority === 'High').length;
      const mediumPoams = openPoams.filter(p => p.priority === 'Medium').length;
      const lowPoams = openPoams.filter(p => p.priority === 'Low').length;
      
      // Calculate overdue POAMs
      const now = new Date();
      const overduePoams = openPoams.filter(p => {
        const endDate = new Date(p.endDate || p.end_date);
        return endDate < now;
      }).length;
      
      // Risk scoring based on POAM severity and status
      poamRisk = (criticalPoams * 25) + (highPoams * 15) + (mediumPoams * 8) + (lowPoams * 3) + (overduePoams * 10);
      poamRisk = Math.min(poamRisk, 100); // Cap at 100
    }
    
    // 2. STIG Compliance Risk Assessment (30% weight)
    let stigRisk = 0;
    let stigWeight = 30;
    
    if (stigMappings.length > 0) {
      let totalFindings = 0;
      let highSevFindings = 0;
      let mediumSevFindings = 0;
      let lowSevFindings = 0;
      
      stigMappings.forEach(mapping => {
        if (mapping.mapping_result?.mapped_controls) {
          mapping.mapping_result.mapped_controls.forEach((control: any) => {
            if (control.stigs) {
              control.stigs.forEach((stig: any) => {
                totalFindings++;
                switch (stig.severity?.toLowerCase()) {
                  case 'high':
                  case 'cat i':
                    highSevFindings++;
                    break;
                  case 'medium':
                  case 'cat ii':
                    mediumSevFindings++;
                    break;
                  case 'low':
                  case 'cat iii':
                    lowSevFindings++;
                    break;
                }
              });
            }
          });
        }
      });
      
      if (totalFindings > 0) {
        stigRisk = ((highSevFindings * 20) + (mediumSevFindings * 10) + (lowSevFindings * 3)) / totalFindings * 100;
        stigRisk = Math.min(stigRisk, 100);
      }
    }
    
    // 3. Security Testing Coverage Risk (20% weight)
    let testingRisk = 0;
    let testingWeight = 20;
    
    if (testPlans.length > 0) {
      let totalTests = 0;
      let failedTests = 0;
      let passedTests = 0;
      
      testPlans.forEach(plan => {
        if (plan.test_cases) {
          plan.test_cases.forEach((testCase: any) => {
            totalTests++;
            if (testCase.status === 'Failed') {
              failedTests++;
            } else if (testCase.status === 'Passed') {
              passedTests++;
            }
          });
        }
      });
      
      if (totalTests > 0) {
        const failureRate = failedTests / totalTests;
        const testCoverage = passedTests / totalTests;
        testingRisk = (failureRate * 70) + ((1 - testCoverage) * 30); // Emphasize failures
        testingRisk = Math.min(testingRisk * 100, 100);
      } else {
        testingRisk = 50; // No testing data = moderate risk
      }
    } else {
      testingRisk = 60; // No test plans = higher risk
    }
    
    // 4. Nessus Vulnerability Risk (10% weight) - if available
    let nessusRisk = 0;
    let nessusWeight = 10;
    
    if (nessusScans && nessusScans.length > 0) {
      // This would require actual Nessus data analysis
      // For now, assume some risk if scans exist but no remediation
      nessusRisk = 30; // Placeholder - would need actual vulnerability data
    }
    
    // Calculate weighted risk score
    const totalWeight = poamWeight + stigWeight + testingWeight + nessusWeight;
    const weightedRisk = (
      (poamRisk * poamWeight) + 
      (stigRisk * stigWeight) + 
      (testingRisk * testingWeight) + 
      (nessusRisk * nessusWeight)
    ) / totalWeight;
    
    // Convert to security score (inverse of risk)
    const securityScore = Math.max(0, Math.min(100, 100 - weightedRisk));
    
    return Math.round(securityScore);
  };

  const calculateSecurityHealth = (riskScore: number, overdueCount: number, criticalCount: number): SystemStats['securityHealth'] => {
    if (criticalCount > 5 || riskScore < 20) return 'critical';
    if (criticalCount > 2 || overdueCount > 10 || riskScore < 40) return 'poor';
    if (overdueCount > 5 || riskScore < 60) return 'fair';
    if (riskScore < 80) return 'good';
    return 'excellent';
  };

  const getTopVulnerabilities = (poams: any[], stigMappings: any[], testPlans: any[]): VulnerabilityIssue[] => {
    const vulnerabilities: VulnerabilityIssue[] = [];
    const now = new Date();
    
    // Add critical/high POAMs
    poams.filter(p => ['Critical', 'High'].includes(p.priority) && p.status !== 'Closed' && p.status !== 'Completed')
          .slice(0, 3)
          .forEach(poam => {
            const startDate = new Date(poam.startDate || poam.start_date);
            const daysOpen = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            
            vulnerabilities.push({
              id: poam.id.toString(),
              title: poam.title,
              severity: poam.priority as any,
              type: 'POAM',
              daysOpen,
              source: 'POAM Tracker'
            });
          });
    
    // Add high-severity STIG findings
    stigMappings.forEach(mapping => {
      if (mapping.mapping_result?.mapped_controls) {
        mapping.mapping_result.mapped_controls.forEach((control: any) => {
          if (control.stigs && control.compliance_status !== 'Compliant') {
            control.stigs.forEach((stig: any) => {
              if (['high', 'cat i'].includes(stig.severity?.toLowerCase())) {
                vulnerabilities.push({
                  id: `stig-${stig.vuln_num}`,
                  title: `${stig.group_title} (${stig.vuln_num})`,
                  severity: stig.severity === 'Cat I' ? 'Critical' : 'High',
                  type: 'STIG',
                  daysOpen: 60, // Estimate based on typical remediation timeframes
                  source: `STIG ${mapping.name}`
                });
              }
            });
          }
        });
      }
    });
    
    // Add failed security tests
    testPlans.forEach(plan => {
      if (plan.test_cases) {
        plan.test_cases.filter((tc: any) => tc.status === 'Failed').slice(0, 2).forEach((testCase: any) => {
          vulnerabilities.push({
            id: `test-${testCase.id}`,
            title: `Failed Test: ${testCase.name}`,
            severity: testCase.risk_level || 'Medium',
            type: 'Test',
            daysOpen: testCase.last_tested ? Math.floor((now.getTime() - new Date(testCase.last_tested).getTime()) / (1000 * 60 * 60 * 24)) : 30,
            source: `Test Plan: ${plan.name}`
          });
        });
      }
    });
    
    // Sort by severity and limit to top 5
    const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    return vulnerabilities
      .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0))
      .slice(0, 5);
  };

  const loadSystemsStats = async () => {
    setIsLoadingStats(true);
    try {
      const statsPromises = systems.map(async (system) => {
        try {
          // Load comprehensive data for each system including Nessus scans
          const [poams, notes, stigMappings, testPlans, nessusScans] = await Promise.all([
            invoke<any[]>('get_all_poams', { systemId: system.id }),
            invoke<any[]>('get_all_notes', { systemId: system.id }),
            invoke<any[]>('get_all_stig_mappings', { systemId: system.id }),
            invoke<any[]>('get_all_security_test_plans', { systemId: system.id }),
            invoke<any[]>('get_nessus_scans', { systemId: system.id }).catch(() => [])
          ]);

          const now = new Date();
          const openPoams = poams.filter(p => p.status !== 'Closed' && p.status !== 'Completed').length;
          const closedPoams = poams.filter(p => p.status === 'Closed' || p.status === 'Completed').length;
          const overduePoams = poams.filter(p => {
            if (p.status === 'Closed' || p.status === 'Completed') return false;
            const endDate = new Date(p.endDate || p.end_date);
            return endDate < now;
          }).length;

          // Calculate priority breakdown
          const criticalPoams = poams.filter(p => p.priority === 'Critical' && p.status !== 'Closed' && p.status !== 'Completed').length;
          const highPoams = poams.filter(p => p.priority === 'High' && p.status !== 'Closed' && p.status !== 'Completed').length;
          const mediumPoams = poams.filter(p => p.priority === 'Medium' && p.status !== 'Closed' && p.status !== 'Completed').length;
          const lowPoams = poams.filter(p => p.priority === 'Low' && p.status !== 'Closed' && p.status !== 'Completed').length;

          // Use comprehensive risk calculation
          const riskScore = calculateComprehensiveRiskScore(poams, stigMappings, testPlans, nessusScans);
          
          // Calculate STIG compliance score based on actual findings
          let complianceScore = 0;
          if (stigMappings.length > 0) {
            let totalControls = 0;
            let compliantControls = 0;
            
            stigMappings.forEach(mapping => {
              if (mapping.mapping_result?.mapped_controls) {
                mapping.mapping_result.mapped_controls.forEach((control: any) => {
                  totalControls++;
                  if (control.compliance_status === 'Compliant') {
                    compliantControls++;
                  }
                });
              }
            });
            
            complianceScore = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;
          }
          
          const securityHealth = calculateSecurityHealth(riskScore, overduePoams, criticalPoams);
          const topVulnerabilities = getTopVulnerabilities(poams, stigMappings, testPlans);

          // Generate recent activity (simplified for demo)
          const recentActivity: ActivityItem[] = [
            ...poams.slice(0, 2).map((poam, index) => ({
              id: `activity-${index}`,
              type: 'poam_created' as const,
              title: `POAM Created: ${poam.title}`,
              timestamp: poam.startDate || poam.start_date,
            })),
            ...notes.slice(0, 1).map((note, index) => ({
              id: `note-${index}`,
              type: 'note_added' as const,
              title: `Note Added: ${note.title}`,
              timestamp: note.createdDate || note.created_date,
            }))
          ].slice(0, 3);

          return {
            systemId: system.id,
            systemName: system.name,
            systemDescription: system.description,
            systemOwner: system.owner,
            systemClassification: system.classification,
            systemTags: system.tags,
            poamCount: poams.length,
            openPoams,
            closedPoams,
            overduePoams,
            criticalPoams,
            highPoams,
            mediumPoams,
            lowPoams,
            noteCount: notes.length,
            stigMappingCount: stigMappings.length,
            testPlanCount: testPlans.length,
            nessusScans: nessusScans || [],
            lastAccessed: system.last_accessed,
            riskScore,
            complianceScore,
            topVulnerabilities,
            recentActivity,
            securityHealth,
          };
        } catch (error) {
          console.error(`Failed to load stats for system ${system.id}:`, error);
          return {
            systemId: system.id,
            systemName: system.name,
            systemDescription: system.description,
            systemOwner: system.owner,
            systemClassification: system.classification,
            systemTags: system.tags,
            poamCount: 0,
            openPoams: 0,
            closedPoams: 0,
            overduePoams: 0,
            criticalPoams: 0,
            highPoams: 0,
            mediumPoams: 0,
            lowPoams: 0,
            noteCount: 0,
            stigMappingCount: 0,
            testPlanCount: 0,
            nessusScans: [],
            lastAccessed: system.last_accessed,
            riskScore: 20, // Low score for systems with errors
            complianceScore: 0,
            topVulnerabilities: [],
            recentActivity: [],
            securityHealth: 'critical' as const,
          };
        }
      });

      const stats = await Promise.all(statsPromises);
      setSystemStats(stats);

      // Calculate aggregated stats
      const aggregated = stats.reduce(
        (acc, stat) => ({
          totalSystems: acc.totalSystems + 1,
          totalPoams: acc.totalPoams + stat.poamCount,
          totalOpenPoams: acc.totalOpenPoams + stat.openPoams,
          totalClosedPoams: acc.totalClosedPoams + stat.closedPoams,
          totalOverduePoams: acc.totalOverduePoams + stat.overduePoams,
          totalNotes: acc.totalNotes + stat.noteCount,
          totalStigMappings: acc.totalStigMappings + stat.stigMappingCount,
          totalTestPlans: acc.totalTestPlans + stat.testPlanCount,
        }),
        {
          totalSystems: 0,
          totalPoams: 0,
          totalOpenPoams: 0,
          totalClosedPoams: 0,
          totalOverduePoams: 0,
          totalNotes: 0,
          totalStigMappings: 0,
          totalTestPlans: 0,
        }
      );

      setAggregatedStats(aggregated);
    } catch (error) {
      console.error('Failed to load systems stats:', error);
      showToast('error', 'Failed to load group statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatLastAccessed = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const toggleSystemExpansion = (systemId: string) => {
    const newExpanded = new Set(expandedSystems);
    if (newExpanded.has(systemId)) {
      newExpanded.delete(systemId);
    } else {
      newExpanded.add(systemId);
    }
    setExpandedSystems(newExpanded);
  };

  const getSecurityHealthColor = (health: SystemStats['securityHealth']) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGroupSecurityScoreColor = (systems: SystemStats[]) => {
    if (systems.length === 0) return 'text-gray-500';
    const avgScore = systems.reduce((sum, s) => sum + s.riskScore, 0) / systems.length;
    return getRiskScoreColor(avgScore);
  };

  // Filter and sort systems
  const filteredAndSortedSystems = systemStats
    .filter(system => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          system.systemName.toLowerCase().includes(searchLower) ||
          system.systemDescription?.toLowerCase().includes(searchLower) ||
          system.systemOwner?.toLowerCase().includes(searchLower) ||
          system.systemTags?.some(tag => tag.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      // Status filter
      switch (filterBy) {
        case 'high-risk':
          return system.riskScore < 60 || system.criticalPoams > 0;
        case 'overdue':
          return system.overduePoams > 0;
        case 'active':
          return system.openPoams > 0;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      if (!key) return 0;
      
      let aVal = a[key as keyof SystemStats] ?? '';
      let bVal = b[key as keyof SystemStats] ?? '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="title-row">
          <Building className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{group?.name || 'Group Overview'}</h1>
            {group?.description && (
              <p className="text-muted-foreground mt-1">{group.description}</p>
            )}
          </div>
        </div>
        <div className="button-group">
          <Button variant="outline" onClick={onExit}>
            <ExternalLink className="h-4 w-4" />
            <span className="hide-mobile">Exit Group</span>
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards with Better Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Systems</CardTitle>
            <Building className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalSystems}</div>
            <p className="text-xs text-muted-foreground">Active systems in group</p>
            <div className="flex items-center mt-2 text-xs">
              <Activity className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-600">
                {systemStats.filter(s => s.poamCount > 0 || s.stigMappingCount > 0).length} systems with data
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">POAMs</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalPoams}</div>
            <p className="text-xs text-muted-foreground">
              {aggregatedStats.totalOpenPoams} open, {aggregatedStats.totalClosedPoams} closed
            </p>
            <div className="flex items-center mt-2 text-xs">
              <div className="flex-1 bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ 
                    width: `${aggregatedStats.totalPoams > 0 ? (aggregatedStats.totalClosedPoams / aggregatedStats.totalPoams) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <span className="ml-2 text-muted-foreground">
                {aggregatedStats.totalPoams > 0 
                  ? Math.round((aggregatedStats.totalClosedPoams / aggregatedStats.totalPoams) * 100)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{aggregatedStats.totalOverduePoams}</div>
            <p className="text-xs text-muted-foreground">Overdue POAMs requiring attention</p>
            <div className="flex items-center mt-2 text-xs">
              {aggregatedStats.totalOverduePoams > 0 ? (
                <>
                  <Zap className="h-3 w-3 mr-1 text-red-500" />
                  <span className="text-red-600">Immediate action required</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  <span className="text-green-600">No overdue items</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              systemStats.length > 0 ? getGroupSecurityScoreColor(systemStats) : 'text-gray-500'
            }`}>
              {systemStats.length > 0 ? Math.round(systemStats.reduce((sum, s) => sum + s.riskScore, 0) / systemStats.length) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Average across all systems</p>
            <div className="flex items-center mt-2 text-xs">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-600">{aggregatedStats.totalStigMappings} STIG mappings</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics with Real Vulnerability Data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentation</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalNotes}</div>
            <p className="text-xs text-muted-foreground">Notes and documentation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STIG Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {systemStats.reduce((total, system) => {
                return total + (system.topVulnerabilities.filter(v => v.type === 'STIG').length);
              }, 0)}
            </div>
            <p className="text-xs text-muted-foreground">High/Critical STIG issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalTestPlans}</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.reduce((total, system) => total + system.testPlanCount, 0)} total plans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerability Scans</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {systemStats.reduce((total, system) => total + (system.nessusScans?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Nessus scans across {systemStats.filter(s => s.nessusScans?.length > 0).length} systems
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Systems Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Systems Overview
              </CardTitle>
              <CardDescription>
                Comprehensive view of all systems with detailed security metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search systems..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  <SelectItem value="high-risk">High Risk</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="active">Active Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Loading system statistics...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedSystems.map((system) => (
                <div key={system.systemId} className="border border-border rounded-lg">
                  {/* Main System Row */}
                  <div 
                    className="flex items-center p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => toggleSystemExpansion(system.systemId)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-6 h-6 flex items-center justify-center">
                        {expandedSystems.has(system.systemId) ? 
                          <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{system.systemName}</div>
                          <div className="text-sm text-muted-foreground">
                            {system.systemOwner && (
                              <span>Owner: {system.systemOwner} • </span>
                            )}
                            {system.systemClassification && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {system.systemClassification}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{system.poamCount}</div>
                        <div className="text-xs text-muted-foreground">POAMs</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <span className={getRiskScoreColor(system.riskScore)}>{system.riskScore}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Risk Score</div>
                      </div>
                      
                      <div className="text-center">
                        <Badge 
                          className={`text-xs ${getSecurityHealthColor(system.securityHealth)}`}
                          variant="outline"
                        >
                          {system.securityHealth}
                        </Badge>
                      </div>
                      
                      {system.overduePoams > 0 && (
                        <div className="text-center">
                          <Badge variant="destructive" className="text-xs">
                            {system.overduePoams} Overdue
                          </Badge>
                        </div>
                      )}
                      
                      <div className="text-center text-xs text-muted-foreground">
                        {formatLastAccessed(system.lastAccessed)}
                      </div>

                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded System Details */}
                  {expandedSystems.has(system.systemId) && (
                    <div className="border-t border-border bg-muted/20 p-6 space-y-6">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-background border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">POAM Breakdown</h4>
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Critical:</span>
                              <Badge variant="destructive" className="text-xs">{system.criticalPoams}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>High:</span>
                              <Badge className="text-xs bg-orange-100 text-orange-700">{system.highPoams}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Medium:</span>
                              <Badge className="text-xs bg-yellow-100 text-yellow-700">{system.mediumPoams}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Low:</span>
                              <Badge variant="secondary" className="text-xs">{system.lowPoams}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="bg-background border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Security Status</h4>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Security Score:</span>
                              <span className={getRiskScoreColor(system.riskScore)}>{system.riskScore}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>STIG Compliance:</span>
                              <span className={system.complianceScore >= 80 ? 'text-green-600' : system.complianceScore >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                                {system.complianceScore}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>STIG Mappings:</span>
                              <span>{system.stigMappingCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Test Plans:</span>
                              <span>{system.testPlanCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Nessus Scans:</span>
                              <span className={system.nessusScans?.length > 0 ? 'text-green-600' : 'text-orange-600'}>
                                {system.nessusScans?.length || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-background border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Top Vulnerabilities</h4>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            {system.topVulnerabilities.length > 0 ? (
                              system.topVulnerabilities.slice(0, 3).map((vuln, index) => (
                                <div key={index} className="text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="truncate flex-1">{vuln.title}</span>
                                    <Badge 
                                      className={`ml-2 text-xs ${getSeverityColor(vuln.severity)}`}
                                      variant="outline"
                                    >
                                      {vuln.severity}
                                    </Badge>
                                  </div>
                                  <div className="text-muted-foreground">
                                    {vuln.type} • {vuln.daysOpen} days
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">No critical vulnerabilities</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-background border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Recent Activity</h4>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            {system.recentActivity.length > 0 ? (
                              system.recentActivity.map((activity, index) => (
                                <div key={index} className="text-xs">
                                  <div className="truncate font-medium">{activity.title}</div>
                                  <div className="text-muted-foreground">
                                    {new Date(activity.timestamp).toLocaleDateString()}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">No recent activity</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      {system.systemTags && system.systemTags.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {system.systemTags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-4 border-t border-border">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSystemAction(system.systemId, 'view')}
                          title="Switch to this system and view dashboard"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSystemAction(system.systemId, 'manage')}
                          title="Switch to this system and open settings"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSystemAction(system.systemId, 'reports')}
                          title="Switch to this system and view metrics"
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Reports
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredAndSortedSystems.length === 0 && (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-lg font-medium text-muted-foreground mb-2">
                    No systems found
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {searchTerm || filterBy !== 'all' 
                      ? 'Try adjusting your search or filter criteria'
                      : 'No systems are currently associated with this group'
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
