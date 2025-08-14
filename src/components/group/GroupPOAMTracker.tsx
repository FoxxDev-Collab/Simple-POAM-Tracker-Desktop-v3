import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Target,
  Plus,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '../../context/ToastContext';
import GroupVulnerabilityAnalysis from './GroupVulnerabilityAnalysis';
import CreateGroupPOAM from './CreateGroupPOAM';

interface GroupPOAMTrackerProps {
  groupId: string;
  systems: any[];
}

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  status: string;
  description: string;
}

interface GroupPOAM {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  risk_level: string;
  group_id: string;
  affected_systems: string[];
  milestones: Milestone[];
  resources?: string;
  source_identifying_vulnerability?: string;
  raw_severity?: string;
  severity?: string;
  relevance_of_threat?: string;
  likelihood?: string;
  impact?: string;
  residual_risk?: string;
  mitigations?: string;
  devices_affected?: string;
}

type ViewMode = 'poams' | 'vulnerabilities' | 'create';

export default function GroupPOAMTracker({ groupId, systems }: GroupPOAMTrackerProps) {
  const [groupPOAMs, setGroupPOAMs] = useState<GroupPOAM[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('poams');
  const [, setSelectedPOAM] = useState<GroupPOAM | null>(null);
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<any[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (groupId) {
      loadGroupPOAMs();
    }
  }, [groupId]);

  const loadGroupPOAMs = async () => {
    setIsLoading(true);
    try {
      const poams = await invoke<GroupPOAM[]>('get_group_poams', { groupId });
      setGroupPOAMs(poams);
      console.log('Loaded group POAMs:', poams);
    } catch (error) {
      console.error('Failed to load group POAMs:', error);
      showToast('error', 'Failed to load group POAMs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePOAM = async (poamId: number) => {
    if (!confirm('Are you sure you want to delete this Group POAM?')) {
      return;
    }

    try {
      await invoke('delete_group_poam', { id: poamId });
      setGroupPOAMs(prev => prev.filter(p => p.id !== poamId));
      showToast('success', 'Group POAM deleted successfully');
    } catch (error) {
      console.error('Failed to delete group POAM:', error);
      showToast('error', 'Failed to delete Group POAM');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'closed':
        return 'default';
      case 'in progress':
      case 'active':
        return 'secondary';
      case 'pending':
      case 'draft':
        return 'outline';
      case 'overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSystemName = (systemId: string) => {
    const system = systems.find(s => s.id === systemId);
    return system?.name || systemId;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const isOverdue = (endDate: string, status: string) => {
    if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'closed') {
      return false;
    }
    const end = new Date(endDate);
    const now = new Date();
    return end < now;
  };

  const calculateStats = () => {
    const total = groupPOAMs.length;
    const completed = groupPOAMs.filter(p => 
      p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'closed'
    ).length;
    const active = groupPOAMs.filter(p => 
      p.status.toLowerCase() === 'in progress' || p.status.toLowerCase() === 'active'
    ).length;
    const overdue = groupPOAMs.filter(p => isOverdue(p.end_date, p.status)).length;
    const totalSystems = new Set(groupPOAMs.flatMap(p => p.affected_systems)).size;

    return { total, completed, active, overdue, totalSystems };
  };

  const stats = calculateStats();

  const renderPOAMView = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Group POAMs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Cross-system action items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active POAMs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue POAMs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Systems Affected</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSystems}</div>
            <p className="text-xs text-muted-foreground">Unique systems involved</p>
          </CardContent>
        </Card>
      </div>

      {/* POAMs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Group POAMs</CardTitle>
              <CardDescription>
                Action items that span across multiple systems in the group
              </CardDescription>
            </div>
            <Button onClick={() => setViewMode('create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Group POAM
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading group POAMs...</div>
            </div>
          ) : groupPOAMs.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Group POAMs</h3>
              <p className="text-muted-foreground mb-4">
                Create your first Group POAM to track cross-system security issues
              </p>
              <Button onClick={() => setViewMode('create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Group POAM
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Affected Systems</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupPOAMs.map((poam) => (
                  <TableRow key={poam.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{poam.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {poam.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(poam.status)}>
                        {poam.status}
                      </Badge>
                      {isOverdue(poam.end_date, poam.status) && (
                        <Badge variant="destructive" className="ml-1">
                          OVERDUE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(poam.priority)}>
                        {poam.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${getRiskLevelColor(poam.risk_level)}`}>
                        {poam.risk_level}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{poam.affected_systems.length} systems</div>
                        <div className="text-sm text-muted-foreground">
                          {poam.affected_systems.slice(0, 2).map(systemId => getSystemName(systemId)).join(', ')}
                          {poam.affected_systems.length > 2 && ` +${poam.affected_systems.length - 2} more`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{formatDate(poam.end_date)}</div>
                        {poam.milestones.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            {poam.milestones.length} milestones
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedPOAM(poam)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeletePOAM(poam.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

  const renderVulnerabilityView = () => (
    <GroupVulnerabilityAnalysis 
      groupId={groupId} 
      systems={systems}
      onCreatePOAMsFromVulnerabilities={(vulnerabilities) => {
        setSelectedVulnerabilities(vulnerabilities);
        setViewMode('create');
      }}
    />
  );

  const renderCreateView = () => (
    <CreateGroupPOAM
      groupId={groupId}
      systems={systems}
      preSelectedVulnerabilities={selectedVulnerabilities}
      onCancel={() => {
        setSelectedVulnerabilities([]);
        setViewMode('poams');
      }}
      onSuccess={() => {
        setSelectedVulnerabilities([]);
        setViewMode('poams');
        loadGroupPOAMs();
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Group POAM Tracker</h1>
          <p className="text-muted-foreground">
            Manage cross-system security action items and vulnerabilities
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'poams' ? 'default' : 'outline'}
            onClick={() => setViewMode('poams')}
          >
            <Target className="w-4 h-4 mr-2" />
            POAMs
          </Button>
          <Button 
            variant={viewMode === 'vulnerabilities' ? 'default' : 'outline'}
            onClick={() => setViewMode('vulnerabilities')}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Vulnerabilities
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'poams' && renderPOAMView()}
      {viewMode === 'vulnerabilities' && renderVulnerabilityView()}
      {viewMode === 'create' && renderCreateView()}
    </div>
  );
}
