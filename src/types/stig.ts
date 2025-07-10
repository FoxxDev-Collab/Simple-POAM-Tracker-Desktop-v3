export interface CCIMapping {
  id: string;
  title: string;
  definition: string;
  nist_controls: string[];
  cci_type: string;
  status: string;
  publish_date: string;
}

export interface STIGVulnerability {
  vuln_num: string;
  severity: string;
  group_title: string;
  rule_id: string;
  rule_ver: string;
  rule_title: string;
  vuln_discuss: string;
  check_content: string;
  fix_text: string;
  cci_refs: string[];
  status: string;
  finding_details: string;
  comments: string;
  severity_override?: string;
  severity_justification?: string;
  stig_id: string;
}

export interface STIGChecklist {
  asset: {
    role: string;
    asset_type: string;
    marking: string;
    host_name: string;
    host_ip: string;
    host_mac: string;
    host_fqdn: string;
    target_comment: string;
    tech_area: string;
    target_key: string;
    web_or_database: boolean;
    web_db_site: string;
    web_db_instance: string;
  };
  stig_info: {
    version: string;
    classification: string;
    custom_name: string;
    stig_id: string;
    description: string;
    file_name: string;
    release_info: string;
    title: string;
    uuid: string;
    notice: string;
    source: string;
  };
  vulnerabilities: STIGVulnerability[];
}

export interface MappedControl {
  nist_control: string;
  ccis: string[];
  stigs: STIGVulnerability[];
  compliance_status: string;
  risk_level: string;
}

export interface MappingSummary {
  total_controls: number;
  compliant_controls: number;
  non_compliant_controls: number;
  not_applicable_controls: number;
  not_reviewed_controls: number;
  high_risk_findings: number;
  medium_risk_findings: number;
  low_risk_findings: number;
}

export interface STIGMappingResult {
  checklist: STIGChecklist;
  cci_mappings: CCIMapping[];
  mapped_controls: MappedControl[];
  summary: MappingSummary;
} 