import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Building,
  Target,
  Shield,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '../../context/ToastContext';

interface GroupOverviewProps {
  group: any;
  systems: any[];
  onExit: () => void;
}

interface SystemStats {
  systemId: string;
  systemName: string;
  poamCount: number;
  openPoams: number;
  closedPoams: number;
  overduePoams: number;
  noteCount: number;
  stigMappingCount: number;
  testPlanCount: number;
  lastAccessed?: string;
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

export default function GroupOverview({ group, systems, onExit }: GroupOverviewProps) {
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
  const { showToast } = useToast();

  useEffect(() => {
    if (systems.length > 0) {
      loadSystemsStats();
    }
  }, [systems]);

  const loadSystemsStats = async () => {
    setIsLoadingStats(true);
    try {
      const statsPromises = systems.map(async (system) => {
        try {
          // Load POAMs for this system
          const poams = await invoke<any[]>('get_all_poams', { systemId: system.id });
          const notes = await invoke<any[]>('get_all_notes', { systemId: system.id });
          const stigMappings = await invoke<any[]>('get_all_stig_mappings', { systemId: system.id });
          const testPlans = await invoke<any[]>('get_all_security_test_plans', { systemId: system.id });

          const now = new Date();
          const openPoams = poams.filter(p => p.status !== 'Closed' && p.status !== 'Completed').length;
          const closedPoams = poams.filter(p => p.status === 'Closed' || p.status === 'Completed').length;
          const overduePoams = poams.filter(p => {
            if (p.status === 'Closed' || p.status === 'Completed') return false;
            const endDate = new Date(p.endDate);
            return endDate < now;
          }).length;

          return {
            systemId: system.id,
            systemName: system.name,
            poamCount: poams.length,
            openPoams,
            closedPoams,
            overduePoams,
            noteCount: notes.length,
            stigMappingCount: stigMappings.length,
            testPlanCount: testPlans.length,
            lastAccessed: system.last_accessed,
          };
        } catch (error) {
          console.error(`Failed to load stats for system ${system.id}:`, error);
          return {
            systemId: system.id,
            systemName: system.name,
            poamCount: 0,
            openPoams: 0,
            closedPoams: 0,
            overduePoams: 0,
            noteCount: 0,
            stigMappingCount: 0,
            testPlanCount: 0,
            lastAccessed: system.last_accessed,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{group?.name || 'Group Overview'}</h1>
          {group?.description && (
            <p className="text-muted-foreground mt-1">{group.description}</p>
          )}
        </div>
        <Button variant="outline" onClick={onExit}>Exit Group</Button>
      </div>

      {/* Aggregated Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Systems</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalSystems}</div>
            <p className="text-xs text-muted-foreground">Active systems in group</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total POAMs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalPoams}</div>
            <p className="text-xs text-muted-foreground">
              {aggregatedStats.totalOpenPoams} open, {aggregatedStats.totalClosedPoams} closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue POAMs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{aggregatedStats.totalOverduePoams}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalStigMappings}</div>
            <p className="text-xs text-muted-foreground">STIG mappings across all systems</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalNotes}</div>
            <p className="text-xs text-muted-foreground">Documentation entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Plans</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedStats.totalTestPlans}</div>
            <p className="text-xs text-muted-foreground">Security test plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregatedStats.totalPoams > 0 
                ? Math.round((aggregatedStats.totalClosedPoams / aggregatedStats.totalPoams) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Overall POAM completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Systems Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Systems Breakdown</CardTitle>
          <CardDescription>
            Detailed statistics for each system in the group
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading system statistics...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>POAMs</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>STIG</TableHead>
                  <TableHead>Test Plans</TableHead>
                  <TableHead>Last Accessed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemStats.map((stat) => (
                  <TableRow key={stat.systemId}>
                    <TableCell className="font-medium">{stat.systemName}</TableCell>
                    <TableCell>{stat.poamCount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stat.openPoams}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{stat.closedPoams}</Badge>
                    </TableCell>
                    <TableCell>
                      {stat.overduePoams > 0 ? (
                        <Badge variant="destructive">{stat.overduePoams}</Badge>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>{stat.noteCount}</TableCell>
                    <TableCell>{stat.stigMappingCount}</TableCell>
                    <TableCell>{stat.testPlanCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLastAccessed(stat.lastAccessed)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
