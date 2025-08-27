export interface TestCase {
  id: string;
  test_description: string;
  test_procedure: string;
  expected_result: string;
  actual_result?: string;
  status: 'Not Started' | 'In Progress' | 'Passed' | 'Failed' | 'Not Applicable';
  notes?: string;
  evidence_files?: string[];
  tested_by?: string;
  tested_date?: string;
  risk_rating: 'Low' | 'Medium' | 'High' | 'Critical';
  
  // Type indicator
  source_type: 'stig' | 'nessus';
  
  // STIG-specific fields
  nist_control?: string;
  cci_ref?: string;
  stig_vuln_id?: string;
  stig_compliance_status?: 'Open' | 'NotAFinding' | 'Not_Applicable' | 'Not_Reviewed';
  
  // Nessus-specific fields
  cve_id?: string;
  plugin_id?: string;
  plugin_name?: string;
  cvss_score?: string;
  severity?: string;
  affected_hosts?: string[];
  nessus_compliance_status?: 'Open' | 'Fixed' | 'Exception' | 'Not_Applicable';
}

export interface SecurityTestPlan {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  status: 'Draft' | 'In Progress' | 'Completed' | 'On Hold';
  source_type: 'stig' | 'nessus' | 'mixed';
  poam_id?: number;
  stig_mapping_id?: string;
  test_cases: TestCase[];
  overall_score?: number;
}

export interface STIGMapping {
  id: string;
  name: string;
  description?: string;
  stig_info: {
    title: string;
    version: string;
  };
  mapping_result: {
    mapped_controls: Array<{
      nist_control: string;
      ccis: string[];
      stigs: Array<{
        vuln_num: string;
        rule_id: string;
        rule_title: string;
        severity: string;
        status: string;
        stig_id: string;
      }>;
    }>;
  };
}

export interface CreatePlanForm {
  name: string;
  description: string;
  selectedPrepList: string;
}

export interface StpPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  source_mapping_id: string;
  stig_info: any;
  asset_info: any;
  prep_status: string;
  selected_controls: Array<{
    nist_control: string;
    ccis: string[];
    stigs: any[];
    compliance_status: string;
    risk_level: string;
    notes?: string;
    selected_for_stp: boolean;
  }>;
  control_count: number;
}

export interface NessusPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  source_scan_id?: string;
  asset_info: any;
  selected_findings: string[];
  finding_count: number;
  scan_info?: any;
  summary?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface CombinedPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  type: 'stig' | 'nessus';
  count: number;
  source: string;
}