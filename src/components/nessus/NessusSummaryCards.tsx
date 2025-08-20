import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { NessusScanSummary } from './types';

interface NessusSummaryCardsProps {
  summary: NessusScanSummary;
  selectedCount: number;
  onCreatePrepList: () => void;
}

export const NessusSummaryCards: React.FC<NessusSummaryCardsProps> = ({
  summary,
  selectedCount,
  onCreatePrepList
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <h3 className="text-2xl font-bold text-foreground">{summary.total_findings || 0}</h3>
          <p className="text-muted-foreground">Total Findings</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <h3 className="text-2xl font-bold text-destructive">{(summary.critical_findings || 0) + (summary.high_findings || 0)}</h3>
          <p className="text-muted-foreground">Critical + High</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <h3 className="text-2xl font-bold text-primary">{summary.unique_cves || 0}</h3>
          <p className="text-muted-foreground">Unique CVEs</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <h3 className="text-2xl font-bold text-warning">{summary.total_hosts || 0}</h3>
          <p className="text-muted-foreground">Hosts Scanned</p>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-destructive">{summary.critical_findings || 0}</div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-destructive">{summary.high_findings || 0}</div>
          <div className="text-xs text-muted-foreground">High</div>
        </div>
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-warning">{summary.medium_findings || 0}</div>
          <div className="text-xs text-muted-foreground">Medium</div>
        </div>
        <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-success">{summary.low_findings || 0}</div>
          <div className="text-xs text-muted-foreground">Low</div>
        </div>
        <div className="bg-muted/50 border border-muted rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-muted-foreground">{summary.info_findings || 0}</div>
          <div className="text-xs text-muted-foreground">Info</div>
        </div>
        {summary.exploitable_findings !== undefined && (
          <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-600">{summary.exploitable_findings}</div>
            <div className="text-xs text-muted-foreground">Exploitable</div>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedCount > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Selection Summary
              </h3>
              <p className="text-foreground">
                <strong>{selectedCount}</strong> finding(s) selected for prep list creation
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Selected findings will be analyzed for CVE-based milestones and remediation planning.
              </p>
            </div>
            <button
              onClick={onCreatePrepList}
              className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Prep List
            </button>
          </div>
        </div>
      )}
    </div>
  );
};