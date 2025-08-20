import React, { useState } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronRight, ChevronDown as ChevronDownIcon, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { NessusFinding, NessusHost, SortField, SortDirection } from './types';
import { sortFindings, filterFindings, getSeverityScore, getCvssColor } from './utils';

interface NessusFindingsTableProps {
  findings: NessusFinding[];
  hosts: NessusHost[];
  selectedFindings: Set<string>;
  expandedFindings: Set<string>;
  filter: string;
  sortField: SortField;
  sortDirection: SortDirection;
  groupByCve: boolean;
  onFindingSelection: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleExpansion: (id: string) => void;
  onFilterChange: (filter: string) => void;
  onSort: (field: SortField) => void;
  onToggleCveGrouping: () => void;
  onCreatePrepList: () => void;
}

export const NessusFindingsTable: React.FC<NessusFindingsTableProps> = ({
  findings,
  hosts,
  selectedFindings,
  expandedFindings,
  filter,
  sortField,
  sortDirection,
  groupByCve,
  onFindingSelection,
  onSelectAll,
  onToggleExpansion,
  onFilterChange,
  onSort,
  onToggleCveGrouping,
  onCreatePrepList
}) => {
  // Enhanced filtering with better CVE handling
  const filteredAndSortedFindings = (() => {
    let filtered = filterFindings(findings, 'all', filter);
    return sortFindings(filtered, sortField, sortDirection);
  })();

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th 
        className="cursor-pointer hover:bg-muted/50 transition-colors bg-muted text-foreground font-semibold p-3 text-left border-b border-border"
        onClick={() => onSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive && (
            sortDirection === 'asc' ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </th>
    );
  };

  const renderSeverityBadge = (severity?: string, riskFactor?: string) => {
    const score = getSeverityScore(severity, riskFactor);
    const getVariant = (score: number) => {
      switch (score) {
        case 4: return 'destructive';
        case 3: return 'destructive';
        case 2: return 'warning';
        case 1: return 'success';
        default: return 'secondary';
      }
    };

    const getLabel = (score: number) => {
      switch (score) {
        case 4: return 'Critical';
        case 3: return 'High';
        case 2: return 'Medium';
        case 1: return 'Low';
        default: return 'Info';
      }
    };

    return (
      <Badge variant={getVariant(score) as any} className="text-xs font-medium">
        {getLabel(score)}
      </Badge>
    );
  };

  const renderExpandedFindingDetails = (finding: NessusFinding) => {
    const host = hosts.find(h => h.hostname === finding.host || h.ip_address === finding.host);
    
    return (
      <tr className="bg-muted/30">
        <td colSpan={6} className="p-0">
          <div className="p-4 border-t border-border">
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">
                Finding Details for {finding.plugin_name}
              </h4>
              
              {/* Technical Details Section */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">
                  Technical Information:
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Plugin ID:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.plugin_id || 'Not Available'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Plugin Family:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.plugin_family || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Protocol:</span>
                    <div className="text-sm text-foreground mt-1">
                      {finding.protocol || 'Unknown'} {finding.service && `(${finding.service})`}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Risk Factor:</span>
                    <div className="text-sm text-foreground mt-1">
                      {renderSeverityBadge(finding.severity, finding.risk_factor)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Host Information Section */}
              {host && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-foreground mb-2">
                    Host Information:
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-muted/30 p-3 rounded">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Hostname:</span>
                      <div className="text-sm text-foreground mt-1">
                        {host.hostname || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">IP Address:</span>
                      <div className="text-sm text-foreground mt-1">
                        {host.ip_address || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">MAC Address:</span>
                      <div className="text-sm text-foreground mt-1">
                        {host.mac_address || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Total Vulnerabilities:</span>
                      <div className="text-sm text-foreground mt-1">
                        <span className="font-medium text-destructive">{host.critical_count + host.high_count}</span> High+
                        <span className="mx-1">|</span>
                        <span className="font-medium text-warning">{host.medium_count}</span> Med
                        <span className="mx-1">|</span>
                        <span className="font-medium text-success">{host.low_count}</span> Low
                      </div>
                    </div>
                    {host.os_info && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="text-sm font-medium text-muted-foreground">Operating System:</span>
                        <div className="text-sm text-foreground mt-1">
                          {host.os_info}
                        </div>
                      </div>
                    )}
                    {host.fqdn && (
                      <div className="col-span-2">
                        <span className="text-sm font-medium text-muted-foreground">FQDN:</span>
                        <div className="text-sm text-foreground mt-1">
                          {host.fqdn}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CVE Information */}
              {finding.cve && finding.cve !== 'None' && (
                <div className="mt-2">
                  <span className="font-medium text-red-600">CVE Information:</span>
                  <div className="mt-1 text-sm bg-red-50 border border-red-200 p-3 rounded">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium text-red-800">CVE ID:</div>
                            <div className="text-red-700">{finding.cve}</div>
                          </div>
                          {finding.cvss_base_score && (
                            <div>
                              <div className="font-medium text-red-800">CVSS Base Score:</div>
                              <div className="flex items-center gap-2">
                                <span 
                                  className="px-2 py-1 rounded text-white text-sm font-medium"
                                  style={{ backgroundColor: getCvssColor(finding.cvss_base_score) }}
                                >
                                  {finding.cvss_base_score}
                                </span>
                                <span className="text-red-700 text-xs">
                                  {finding.cvss_base_score >= 9.0 ? 'Critical' :
                                   finding.cvss_base_score >= 7.0 ? 'High' :
                                   finding.cvss_base_score >= 4.0 ? 'Medium' : 'Low'}
                                </span>
                              </div>
                            </div>
                          )}
                          {finding.cvss_vector && (
                            <div className="col-span-1 md:col-span-2">
                              <div className="font-medium text-red-800">CVSS Vector:</div>
                              <div className="text-red-700 text-xs font-mono">{finding.cvss_vector}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 pt-2 border-t border-red-200">
                          {finding.exploit_available && (
                            <div className="flex items-center gap-1 text-red-800">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="font-medium text-sm">Exploit Available</span>
                            </div>
                          )}
                          <a 
                            href={`https://nvd.nist.gov/vuln/detail/${finding.cve}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                          >
                            View in NVD Database →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mt-2">
                <span className="font-medium text-muted-foreground">Description:</span>
                <div className="mt-1 text-sm text-foreground bg-muted p-3 rounded max-h-32 overflow-y-auto">
                  {finding.description || 'No description available.'}
                </div>
              </div>

              {/* Solution */}
              {finding.solution && (
                <div className="mt-2">
                  <span className="font-medium text-success">Solution:</span>
                  <div className="mt-1 text-sm text-foreground bg-success/10 border border-success/20 p-3 rounded">
                    {finding.solution}
                  </div>
                </div>
              )}

              {/* Plugin Output */}
              {finding.plugin_output && (
                <div className="mt-2">
                  <span className="font-medium text-muted-foreground">Plugin Output:</span>
                  <div className="mt-1 text-xs text-muted-foreground bg-muted p-3 rounded max-h-24 overflow-y-auto font-mono">
                    {finding.plugin_output}
                  </div>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Vulnerability Findings</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search findings..."
              className="pl-8 pr-4 py-2 w-full border rounded-md text-sm"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
            />
          </div>
          <Button
            onClick={onToggleCveGrouping}
            variant={groupByCve ? "default" : "outline"}
            className="whitespace-nowrap"
            size="sm"
          >
            {groupByCve ? "Grouped by CVE" : "Group by CVE"}
          </Button>
          <Button
            onClick={() => onFilterChange(filter.includes('CVE-') ? '' : 'CVE-')}
            variant={filter.includes('CVE-') ? "default" : "outline"}
            className="whitespace-nowrap"
            size="sm"
          >
            CVEs Only
          </Button>
          <Button
            onClick={onCreatePrepList}
            disabled={selectedFindings.size === 0}
            className="whitespace-nowrap"
            size="sm"
          >
            Create Prep List
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">
                <input
                  type="checkbox"
                  checked={filteredAndSortedFindings.length > 0 && filteredAndSortedFindings.every(finding => selectedFindings.has(finding.id))}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="mr-2"
                />
                Select
              </th>
              {renderSortHeader('plugin_name', 'Vulnerability')}
              {renderSortHeader('host', 'Host')}
              {renderSortHeader('port', 'Port')}
              {renderSortHeader('cve', 'CVE')}
              {renderSortHeader('severity', 'Severity')}
              <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Synopsis</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedFindings.length > 0 ? (
              filteredAndSortedFindings.map((finding) => (
                <React.Fragment key={finding.id}>
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 border-b border-border">
                      <div className="flex items-center">
                        {!finding.isCveHeader ? (
                          <input
                            type="checkbox"
                            checked={selectedFindings.has(finding.id)}
                            onChange={(e) => onFindingSelection(finding.id, e.target.checked)}
                            className="mr-3"
                          />
                        ) : (
                          <span className="mr-3 w-4"></span>
                        )}
                        <button
                          onClick={() => onToggleExpansion(finding.id)}
                          className="mr-2"
                        >
                          {expandedFindings.has(finding.id) ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 border-b border-border">
                      <span className={`${finding.isCveHeader ? 'text-red-500 font-medium' : 'text-foreground'}`}>
                        {finding.plugin_name}
                        {finding.isCveHeader && finding.cveGroupSize && (
                          <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                            {finding.cveGroupSize} findings
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3 border-b border-border">
                      <div className="space-y-1">
                        <span className="font-medium text-foreground">
                          {finding.host || 'N/A'}
                        </span>
                        {hosts && (() => {
                          const host = hosts.find(h => h.hostname === finding.host || h.ip_address === finding.host);
                          return host && host.mac_address ? (
                            <div className="text-xs text-muted-foreground">
                              {host.mac_address}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="p-3 border-b border-border">
                      <span className="text-foreground">
                        {finding.port || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 border-b border-border">
                      <div className="space-y-1">
                        <span className={`${finding.cve && finding.cve !== 'None' ? 'text-red-600 font-medium' : 'text-muted-foreground'} text-xs`}>
                          {finding.cve || 'None'}
                        </span>
                        {finding.cve && finding.cve !== 'None' && (
                          <div className="flex items-center gap-1">
                            {finding.cvss_base_score && (
                              <span 
                                className="px-1 py-0.5 rounded text-white text-xs font-medium"
                                style={{ backgroundColor: getCvssColor(finding.cvss_base_score) }}
                              >
                                {finding.cvss_base_score}
                              </span>
                            )}
                            {finding.exploit_available && (
                              <span className="text-red-600 text-xs font-medium bg-red-100 px-1 py-0.5 rounded">
                                EXP
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 border-b border-border">
                      {renderSeverityBadge(finding.severity, finding.risk_factor)}
                    </td>
                    <td className="p-3 border-b border-border max-w-md">
                      <span className="text-foreground text-sm truncate block" title={finding.synopsis || finding.description || ''}>
                        {finding.synopsis || finding.description || 'No synopsis available'}
                      </span>
                    </td>
                  </tr>
                  {expandedFindings.has(finding.id) && renderExpandedFindingDetails(finding)}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  {findings?.length === 0 ? 'No findings found in scan.' : 'No findings match your filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};