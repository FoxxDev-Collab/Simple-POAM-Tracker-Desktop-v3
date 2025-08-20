import React from 'react';
import { Shield, FileText, Info, Edit3, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface NessusPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  finding_count: number;
  cve_analysis?: {
    total_cves: number;
    critical_cves: number;
    high_cves: number;
    medium_cves: number;
    low_cves: number;
    exploitable_cves: number;
  };
  milestones?: Array<{
    id: string;
    title: string;
    description: string;
    cve_id: string;
    priority: string;
    severity: string;
    finding_count: number;
    affected_hosts: string[];
    target_date: string;
  }>;
  summary?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  selected_findings?: Array<{
    plugin_name: string;
    host: string;
    cve?: string;
    cvss_score?: number;
  }>;
}

interface NessusPrepListManagerProps {
  prepLists: NessusPrepList[];
  onViewPrepList: (id: string) => void;
  onEditPrepList: (prepList: NessusPrepList) => void;
  onDeletePrepList: (id: string, name: string) => void;
  onOpenManager: () => void;
}

export const NessusPrepListManager: React.FC<NessusPrepListManagerProps> = ({
  prepLists,
  onViewPrepList,
  onEditPrepList,
  onDeletePrepList,
  onOpenManager
}) => {
  return (
    <div className="mb-8 p-6 bg-card border border-border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Nessus Prep List Manager
        </h3>
        <Button
          onClick={onOpenManager}
          variant="outline"
          size="sm"
        >
          <FileText className="w-4 h-4 mr-2" />
          Manage Lists ({prepLists.length})
        </Button>
      </div>
      
      {prepLists.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {prepLists.slice(0, 6).map((prepList) => (
              <div key={prepList.id} className="bg-background border border-input rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-foreground truncate">{prepList.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {prepList.finding_count} findings
                  </Badge>
                </div>
                
                {prepList.cve_analysis && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-600 font-medium">
                        {prepList.cve_analysis.total_cves} CVEs
                      </span>
                      {prepList.cve_analysis.exploitable_cves > 0 && (
                        <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded">
                          {prepList.cve_analysis.exploitable_cves} exploitable
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {prepList.description || 'No description provided'}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(prepList.created_date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewPrepList(prepList.id)}
                      className="h-6 px-2"
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditPrepList(prepList)}
                      className="h-6 px-2"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {prepLists.length > 6 && (
            <div className="text-center">
              <Button
                onClick={onOpenManager}
                variant="ghost"
                size="sm"
              >
                View all {prepLists.length} prep lists
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No Nessus Prep Lists Yet</p>
          <p className="text-sm">Create your first prep list by selecting findings and clicking "Create Prep List"</p>
        </div>
      )}
    </div>
  );
};