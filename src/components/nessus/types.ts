// Enhanced types for Nessus Center with comprehensive functionality

export interface FileUploadState {
  nessusFilePath: string | null;
  nessusFileName: string | null;
  nessusLoaded: boolean;
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

export interface NessusPrepDialog {
  isOpen: boolean;
  name: string;
  description: string;
}

export interface NessusPrepManagerDialog {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  prepList: any | null;
}

export interface NessusPrepEditDialog {
  isOpen: boolean;
  prepList: any | null;
  name: string;
  description: string;
}

export interface EditingFindingState {
  findingId: string;
  field: 'severity' | 'risk_factor' | 'synopsis' | 'solution' | 'plugin_output';
  value: string;
}

// Enhanced scan metadata with comprehensive information
export interface NessusScanMeta {
  id: string;
  name: string;
  description?: string;
  imported_date: string;
  version: number;
  source_file?: string;
  scan_info: any;
  filename?: string;
  scan_date?: string;
  total_hosts?: number;
  total_vulnerabilities?: number;
  scan_metadata?: NessusScanMetadata;
}

// Detailed scan metadata extracted from Nessus files
export interface NessusScanMetadata {
  nessusVersion?: string;
  nessusBuild?: string;
  pluginFeedVersion?: string;
  scannerEdition?: string;
  scannerOS?: string;
  scanType?: string;
  scanPolicy?: string;
  scannerIP?: string;
  portRange?: string;
  thoroughTests?: string;
  credentialedChecks?: string;
  scanStartDate?: string;
  scanDuration?: string;
  warnings?: string[];
}

// Enhanced host information
export interface NessusHost {
  id: string;
  report_id: string;
  hostname: string;
  ip_address: string;
  mac_address?: string;
  os_info?: string;
  total_vulnerabilities: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  first_seen?: string;
  last_seen?: string;
  netbios_name?: string;
  fqdn?: string;
}

// Enhanced finding with comprehensive vulnerability data
export interface NessusFinding {
  id: string;
  scan_id: string;
  host_id?: string;
  plugin_id?: number;
  plugin_name?: string;
  plugin_family?: string;
  severity?: string;
  risk_factor?: string;
  cve?: string;
  cvss_base_score?: number;
  cvss_temporal_score?: number;
  cvss_vector?: string;
  host?: string;
  hostname?: string;
  ip_address?: string;
  port?: number;
  protocol?: string;
  service?: string;
  synopsis?: string;
  description?: string;
  solution?: string;
  plugin_output?: string;
  see_also?: string[];
  xref?: string[];
  bid?: string[];
  cwe?: string[];
  iava?: string[];
  msft?: string[];
  osvdb?: string[];
  cert?: string[];
  edb_id?: string[];
  exploitability_ease?: string;
  exploit_available?: boolean;
  exploit_framework_core?: boolean;
  exploit_framework_metasploit?: boolean;
  exploit_framework_canvas?: boolean;
  patch_publication_date?: string;
  vuln_publication_date?: string;
  plugin_publication_date?: string;
  plugin_modification_date?: string;
  compliance?: boolean;
  // Custom properties for CVE grouping and UI
  isCveHeader?: boolean;
  cveGroupSize?: number;
  raw_json?: any;
  tags?: string[];
  remediation_priority?: 'critical' | 'high' | 'medium' | 'low';
  asset_criticality?: 'critical' | 'high' | 'medium' | 'low';
}

// Enhanced analysis result with comprehensive data
export interface NessusAnalysisResult {
  scan_meta: NessusScanMeta;
  findings: NessusFinding[];
  hosts: NessusHost[];
  summary: NessusScanSummary;
  scan_statistics?: NessusScanStatistics;
}

export interface NessusScanSummary {
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  info_findings: number;
  total_hosts: number;
  vulnerable_hosts: number;
  compliance_findings?: number;
  exploitable_findings?: number;
  pci_findings?: number;
  unique_cves: number;
  unique_plugins: number;
}

export interface NessusScanStatistics {
  scan_duration?: string;
  average_scan_time_per_host?: number;
  plugins_used?: number;
  credentialed_scan_percentage?: number;
  port_coverage?: {
    tcp_ports_scanned?: number;
    udp_ports_scanned?: number;
    total_open_ports?: number;
  };
  compliance_checks?: {
    total_checks?: number;
    passed_checks?: number;
    failed_checks?: number;
  };
}

// Scan comparison structures
export interface NessusScanComparison {
  baseline_scan: NessusScanMeta;
  comparison_scan: NessusScanMeta;
  new_vulnerabilities: NessusFinding[];
  resolved_vulnerabilities: NessusFinding[];
  common_vulnerabilities: NessusFinding[];
  severity_changes: VulnerabilitySeverityChange[];
  summary: ComparisonSummary;
}

export interface VulnerabilitySeverityChange {
  plugin_id: number;
  plugin_name: string;
  host: string;
  old_severity: string;
  new_severity: string;
  change_type: 'increased' | 'decreased';
}

export interface ComparisonSummary {
  total_new: number;
  total_resolved: number;
  total_common: number;
  severity_increased: number;
  severity_decreased: number;
  risk_score_change: number;
}

// Upload manager types
export interface NessusUploadManager {
  isOpen: boolean;
  uploads: NessusUpload[];
  selectedUploads: Set<string>;
  sortBy: 'date' | 'name' | 'size' | 'findings';
  sortDirection: 'asc' | 'desc';
  filterBy: 'all' | 'processing' | 'completed' | 'failed';
}

export interface NessusUpload {
  id: string;
  filename: string;
  size: number;
  upload_date: string;
  status: 'processing' | 'completed' | 'failed';
  scan_meta?: NessusScanMeta;
  error_message?: string;
  progress?: number;
}

// CVE integration types
export interface CVEInformation {
  cve_id: string;
  description: string;
  severity: string;
  cvss_score: number;
  cvss_vector?: string;
  published_date: string;
  modified_date: string;
  references: string[];
  cwe_ids: string[];
  affected_products: string[];
  exploit_available: boolean;
  exploit_maturity?: string;
}

export interface MilestoneIntegration {
  cve_id: string;
  finding_ids: string[];
  milestone_type: 'prep_list' | 'stp' | 'poam';
  priority: 'critical' | 'high' | 'medium' | 'low';
  target_date?: string;
  assigned_to?: string;
  notes?: string;
}

export type SortField = 'severity' | 'host' | 'plugin_name' | 'port' | 'risk_factor' | 'cve' | 'cvss_score' | 'plugin_family' | 'scan_date';
export type SortDirection = 'asc' | 'desc';

export type FilterType = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'exploitable' | 'compliance' | 'has_cve';

// Enhanced view modes
export type ViewMode = 'table' | 'cards' | 'timeline' | 'matrix' | 'cve_focused' | 'host_focused';

// Export formats
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json' | 'xml' | 'nessus' | 'stig_checklist';

// Dashboard widgets
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'heatmap';
  data: any;
  position: { x: number; y: number; w: number; h: number };
}
