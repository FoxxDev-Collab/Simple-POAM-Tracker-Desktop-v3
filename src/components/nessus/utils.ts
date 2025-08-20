import { 
  NessusFinding, 
  NessusHost, 
  NessusScanSummary, 
  NessusScanStatistics, 
  CVEInformation,
  NessusScanComparison,
  VulnerabilitySeverityChange,
  ComparisonSummary,
  FilterType,
  SortField,
  SortDirection
} from './types';

// Enhanced CVE grouping with better organization
export function groupFindingsByCve(findings: NessusFinding[], includeHeaders: boolean, groupedMode: boolean): NessusFinding[] {
  if (!findings || findings.length === 0) return [];

  const cveGroups = new Map<string, NessusFinding[]>();
  for (const f of findings) {
    const cves = extractCVEs(f.cve);
    if (cves.length === 0) {
      const key = 'No CVE';
      const arr = cveGroups.get(key) ?? [];
      arr.push(f);
      cveGroups.set(key, arr);
    } else {
      // Handle multiple CVEs in a single finding
      cves.forEach(cve => {
        const key = cve.trim();
        const arr = cveGroups.get(key) ?? [];
        arr.push({ ...f, cve: key }); // Create separate entries for each CVE
        cveGroups.set(key, arr);
      });
    }
  }

  const result: NessusFinding[] = [];
  
  // Sort CVE groups by severity and count
  const sortedGroups = Array.from(cveGroups.entries()).sort(([cveA, findingsA], [cveB, findingsB]) => {
    if (cveA === 'No CVE') return 1;
    if (cveB === 'No CVE') return -1;
    
    const maxSeverityA = Math.max(...findingsA.map(f => getSeverityScore(f.severity, f.risk_factor)));
    const maxSeverityB = Math.max(...findingsB.map(f => getSeverityScore(f.severity, f.risk_factor)));
    
    if (maxSeverityA !== maxSeverityB) return maxSeverityB - maxSeverityA;
    return findingsB.length - findingsA.length;
  });

  for (const [cve, items] of sortedGroups) {
    if (includeHeaders && cve !== 'No CVE') {
      const maxSeverity = Math.max(...items.map(f => getSeverityScore(f.severity, f.risk_factor)));
      const affectedHosts = Array.from(new Set(items.map(i => i.host || i.ip_address).filter(Boolean)));
      
      result.push({
        ...items[0],
        id: `cve-header-${cve}`,
        plugin_name: `CVE Group: ${cve}`,
        description: `${items.length} finding(s) affecting ${affectedHosts.length} host(s)`,
        isCveHeader: true,
        cveGroupSize: items.length,
        host: affectedHosts.slice(0, 3).join(', ') + (affectedHosts.length > 3 ? ` +${affectedHosts.length - 3} more` : ''),
        severity: maxSeverity.toString(),
        risk_factor: getSeverityLabel(maxSeverity)
      });
    }
    if (!groupedMode || cve === 'No CVE') {
      result.push(...items);
    }
  }

  return result;
}

// Extract multiple CVEs from a comma-separated string
export function extractCVEs(cveString?: string): string[] {
  if (!cveString) return [];
  return cveString.split(',').map(cve => cve.trim()).filter(cve => cve.length > 0);
}

// Enhanced severity scoring
export function getSeverityScore(severity?: string, riskFactor?: string): number {
  const risk = riskFactor?.toLowerCase();
  const sev = severity;
  
  if (risk === 'critical' || sev === '4') return 4;
  if (risk === 'high' || sev === '3') return 3;
  if (risk === 'medium' || sev === '2') return 2;
  if (risk === 'low' || sev === '1') return 1;
  if (risk === 'none' || sev === '0') return 0;
  return 0;
}

export function getSeverityLabel(score: number): string {
  switch (score) {
    case 4: return 'Critical';
    case 3: return 'High';
    case 2: return 'Medium';
    case 1: return 'Low';
    case 0: return 'Info';
    default: return 'Unknown';
  }
}

// Build host aggregates from findings when a dedicated hosts API is unavailable
export function buildHostsFromFindings(findings: NessusFinding[]): NessusHost[] {
  const map = new Map<string, NessusHost>();

  for (const f of findings) {
    const key = (f.host || f.hostname || f.ip_address || 'unknown').toString();
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        report_id: f.scan_id,
        hostname: f.hostname || f.host || key,
        ip_address: f.ip_address || key,
        total_vulnerabilities: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
      });
    }

    const host = map.get(key)!;
    host.total_vulnerabilities += 1;
    const sev = getSeverityScore(f.severity, f.risk_factor);
    if (sev === 4) host.critical_count += 1;
    else if (sev === 3) host.high_count += 1;
    else if (sev === 2) host.medium_count += 1;
    else if (sev === 1) host.low_count += 1;
    else host.info_count += 1;
  }

  return Array.from(map.values());
}

// Enhanced scan summary calculation
export function calculateScanSummary(findings: NessusFinding[], hosts: NessusHost[]): NessusScanSummary {
  const criticalFindings = findings.filter(f => getSeverityScore(f.severity, f.risk_factor) === 4).length;
  const highFindings = findings.filter(f => getSeverityScore(f.severity, f.risk_factor) === 3).length;
  const mediumFindings = findings.filter(f => getSeverityScore(f.severity, f.risk_factor) === 2).length;
  const lowFindings = findings.filter(f => getSeverityScore(f.severity, f.risk_factor) === 1).length;
  const infoFindings = findings.filter(f => getSeverityScore(f.severity, f.risk_factor) === 0).length;
  
  const uniqueCves = new Set(findings.flatMap(f => extractCVEs(f.cve)).filter(cve => cve && cve !== 'No CVE')).size;
  const uniquePlugins = new Set(findings.map(f => f.plugin_id).filter(Boolean)).size;
  const vulnerableHosts = hosts.filter(h => h.total_vulnerabilities > 0).length;
  const complianceFindings = findings.filter(f => f.compliance === true).length;
  const exploitableFindings = findings.filter(f => f.exploit_available === true).length;

  return {
    total_findings: findings.length,
    critical_findings: criticalFindings,
    high_findings: highFindings,
    medium_findings: mediumFindings,
    low_findings: lowFindings,
    info_findings: infoFindings,
    total_hosts: hosts.length,
    vulnerable_hosts: vulnerableHosts,
    compliance_findings: complianceFindings,
    exploitable_findings: exploitableFindings,
    unique_cves: uniqueCves,
    unique_plugins: uniquePlugins
  };
}

// Calculate scan statistics
export function calculateScanStatistics(findings: NessusFinding[], hosts: NessusHost[], scanMetadata?: any): NessusScanStatistics {
  const pluginsUsed = new Set(findings.map(f => f.plugin_id).filter(Boolean)).size;
  const totalOpenPorts = findings.filter(f => f.port && f.port > 0).length;
  const credentialedFindings = findings.filter(f => f.plugin_name?.toLowerCase().includes('authenticated')).length;
  const credentialedPercentage = findings.length > 0 ? (credentialedFindings / findings.length) * 100 : 0;

  return {
    plugins_used: pluginsUsed,
    credentialed_scan_percentage: credentialedPercentage,
    port_coverage: {
      total_open_ports: totalOpenPorts
    },
    scan_duration: scanMetadata?.scanDuration,
    average_scan_time_per_host: hosts.length > 0 ? (parseFloat(scanMetadata?.scanDuration?.replace(/[^0-9.]/g, '') || '0') / hosts.length) : 0
  };
}

// Enhanced filtering
export function filterFindings(findings: NessusFinding[], filterType: FilterType, searchTerm: string = ''): NessusFinding[] {
  let filtered = findings;

  // Apply severity filter
  if (filterType !== 'all') {
    filtered = filtered.filter(finding => {
      const severity = getSeverityScore(finding.severity, finding.risk_factor);
      switch (filterType) {
        case 'critical': return severity === 4;
        case 'high': return severity === 3;
        case 'medium': return severity === 2;
        case 'low': return severity === 1;
        case 'info': return severity === 0;
        case 'exploitable': return finding.exploit_available === true;
        case 'compliance': return finding.compliance === true;
        case 'has_cve': return finding.cve && finding.cve !== 'No CVE' && finding.cve.trim().length > 0;
        default: return true;
      }
    });
  }

  // Apply search filter
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(finding => 
      finding.plugin_name?.toLowerCase().includes(term) ||
      finding.host?.toLowerCase().includes(term) ||
      finding.hostname?.toLowerCase().includes(term) ||
      finding.ip_address?.toLowerCase().includes(term) ||
      finding.synopsis?.toLowerCase().includes(term) ||
      finding.description?.toLowerCase().includes(term) ||
      finding.cve?.toLowerCase().includes(term) ||
      finding.plugin_id?.toString().includes(term) ||
      finding.plugin_family?.toLowerCase().includes(term) ||
      finding.solution?.toLowerCase().includes(term)
    );
  }

  return filtered;
}

// Enhanced sorting
export function sortFindings(findings: NessusFinding[], sortField: SortField, sortDirection: SortDirection): NessusFinding[] {
  return [...findings].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'severity':
        aValue = getSeverityScore(a.severity, a.risk_factor);
        bValue = getSeverityScore(b.severity, b.risk_factor);
        break;
      case 'cvss_score':
        aValue = a.cvss_base_score || 0;
        bValue = b.cvss_base_score || 0;
        break;
      case 'host':
        aValue = a.host || a.ip_address || '';
        bValue = b.host || b.ip_address || '';
        break;
      case 'plugin_name':
        aValue = a.plugin_name || '';
        bValue = b.plugin_name || '';
        break;
      case 'plugin_family':
        aValue = a.plugin_family || '';
        bValue = b.plugin_family || '';
        break;
      case 'port':
        aValue = a.port || 0;
        bValue = b.port || 0;
        break;
      case 'risk_factor':
        aValue = a.risk_factor || '';
        bValue = b.risk_factor || '';
        break;
      case 'cve':
        aValue = a.cve || 'zzzz';
        bValue = b.cve || 'zzzz';
        break;
      default:
        aValue = a.plugin_name || '';
        bValue = b.plugin_name || '';
    }

    // Handle CVE header items
    if (a.isCveHeader && !b.isCveHeader) return -1;
    if (!a.isCveHeader && b.isCveHeader) return 1;

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

// Compare two scans for differences
export function compareScans(baselineFindings: NessusFinding[], comparisonFindings: NessusFinding[]): {
  new: NessusFinding[];
  resolved: NessusFinding[];
  common: NessusFinding[];
  severityChanges: VulnerabilitySeverityChange[];
} {
  const baselineMap = new Map<string, NessusFinding>();
  const comparisonMap = new Map<string, NessusFinding>();

  // Create unique keys for findings (plugin_id + host)
  baselineFindings.forEach(f => {
    const key = `${f.plugin_id}-${f.host || f.ip_address}`;
    baselineMap.set(key, f);
  });

  comparisonFindings.forEach(f => {
    const key = `${f.plugin_id}-${f.host || f.ip_address}`;
    comparisonMap.set(key, f);
  });

  const newFindings: NessusFinding[] = [];
  const resolvedFindings: NessusFinding[] = [];
  const commonFindings: NessusFinding[] = [];
  const severityChanges: VulnerabilitySeverityChange[] = [];

  // Find new findings
  comparisonMap.forEach((finding, key) => {
    if (!baselineMap.has(key)) {
      newFindings.push(finding);
    } else {
      const baselineFinding = baselineMap.get(key)!;
      const baselineSeverity = getSeverityScore(baselineFinding.severity, baselineFinding.risk_factor);
      const comparisonSeverity = getSeverityScore(finding.severity, finding.risk_factor);
      
      commonFindings.push(finding);
      
      if (baselineSeverity !== comparisonSeverity) {
        severityChanges.push({
          plugin_id: finding.plugin_id || 0,
          plugin_name: finding.plugin_name || '',
          host: finding.host || finding.ip_address || '',
          old_severity: getSeverityLabel(baselineSeverity),
          new_severity: getSeverityLabel(comparisonSeverity),
          change_type: comparisonSeverity > baselineSeverity ? 'increased' : 'decreased'
        });
      }
    }
  });

  // Find resolved findings
  baselineMap.forEach((finding, key) => {
    if (!comparisonMap.has(key)) {
      resolvedFindings.push(finding);
    }
  });

  return {
    new: newFindings,
    resolved: resolvedFindings,
    common: commonFindings,
    severityChanges
  };
}

// Calculate risk score for comparison
export function calculateRiskScore(findings: NessusFinding[]): number {
  return findings.reduce((score, finding) => {
    const severity = getSeverityScore(finding.severity, finding.risk_factor);
    const cvssMultiplier = finding.cvss_base_score ? finding.cvss_base_score / 10 : 1;
    const exploitMultiplier = finding.exploit_available ? 1.5 : 1;
    
    return score + (severity * cvssMultiplier * exploitMultiplier);
  }, 0);
}

// Extract and enrich CVE information
export function enrichCVEInformation(cveId: string): Promise<CVEInformation | null> {
  // This would typically call an external API like NVD
  // For now, return a placeholder implementation
  return Promise.resolve(null);
}

// Generate CVSS color coding
export function getCvssColor(score?: number): string {
  if (!score) return '#6b7280'; // gray
  if (score >= 9.0) return '#dc2626'; // red
  if (score >= 7.0) return '#ea580c'; // orange
  if (score >= 4.0) return '#d97706'; // amber
  return '#65a30d'; // green
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export findings to various formats
export function exportFindings(findings: NessusFinding[], format: 'csv' | 'json' | 'xlsx'): string | Blob {
  switch (format) {
    case 'csv':
      return exportToCsv(findings);
    case 'json':
      return JSON.stringify(findings, null, 2);
    case 'xlsx':
      // Would require a library like xlsx
      throw new Error('XLSX export not implemented');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function exportToCsv(findings: NessusFinding[]): string {
  const headers = [
    'Plugin ID', 'Plugin Name', 'Plugin Family', 'Severity', 'CVSS Score', 
    'CVE', 'Host', 'Port', 'Protocol', 'Synopsis', 'Description', 'Solution'
  ];
  
  const rows = findings.map(f => [
    f.plugin_id || '',
    f.plugin_name || '',
    f.plugin_family || '',
    f.risk_factor || '',
    f.cvss_base_score || '',
    f.cve || '',
    f.host || f.ip_address || '',
    f.port || '',
    f.protocol || '',
    f.synopsis || '',
    f.description || '',
    f.solution || ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

// Validate Nessus file format
export function validateNessusFile(content: string): { valid: boolean; error?: string } {
  try {
    if (!content.includes('<NessusClientData_v2>') && !content.includes('<Report>')) {
      return { valid: false, error: 'Not a valid Nessus file format' };
    }
    
    if (!content.includes('</NessusClientData_v2>') && !content.includes('</Report>')) {
      return { valid: false, error: 'Incomplete Nessus file' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Failed to validate file content' };
  }
}
