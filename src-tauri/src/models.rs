use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct POAMData {
    pub poams: Vec<POAM>,
    pub notes: Vec<Note>,
    pub stig_mappings: Option<Vec<STIGMappingData>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct POAM {
    pub id: i64,
    pub title: String,
    pub description: String,
    #[serde(rename = "startDate")]
    pub start_date: String,
    #[serde(rename = "endDate")]
    pub end_date: String,
    pub status: String,
    pub priority: String,
    #[serde(rename = "riskLevel")]
    pub risk_level: String,
    pub milestones: Vec<Milestone>,
    // Enhanced fields (optional for backward compatibility)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<String>,
    #[serde(rename = "sourceIdentifyingVulnerability", skip_serializing_if = "Option::is_none")]
    pub source_identifying_vulnerability: Option<String>,
    // Risk Analysis fields
    #[serde(rename = "rawSeverity", skip_serializing_if = "Option::is_none")]
    pub raw_severity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    #[serde(rename = "relevanceOfThreat", skip_serializing_if = "Option::is_none")]
    pub relevance_of_threat: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub likelihood: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub impact: Option<String>,
    #[serde(rename = "residualRisk", skip_serializing_if = "Option::is_none")]
    pub residual_risk: Option<String>,
    // Additional optional fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mitigations: Option<String>,
    #[serde(rename = "devicesAffected", skip_serializing_if = "Option::is_none")]
    pub devices_affected: Option<String>,
    // STIG and vulnerability tracking fields
    #[serde(rename = "sourceStigMappingId", skip_serializing_if = "Option::is_none")]
    pub source_stig_mapping_id: Option<String>,
    #[serde(rename = "selectedVulnerabilities", skip_serializing_if = "Option::is_none")]
    pub selected_vulnerabilities: Option<Vec<String>>, // Array of vuln_num values
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: String,
    pub title: String,
    #[serde(rename = "dueDate")]
    pub due_date: String,
    pub status: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub date: String,
    pub poam_ids: Option<Vec<i64>>,
    pub poam_titles: Option<Vec<String>>,
    pub folder: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotePOAMAssociation {
    pub note_id: String,
    pub poam_id: i64,
}

// STIG Mapping Data Structures for Storage
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct STIGMappingData {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub stig_info: STIGInfo,
    pub asset_info: AssetInfo,
    pub mapping_result: STIGMappingResult,
    pub cci_mappings: Option<Vec<CCIMapping>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CCIMapping {
    pub cci_id: String,
    pub control_number: String,
    pub definition: String,
    pub enhancement: Option<String>,
    pub nist_control: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct STIGInfo {
    pub title: String,
    pub version: String,
    pub release_info: String,
    pub classification: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AssetInfo {
    pub asset_type: String,
    pub host_name: Option<String>,
    pub host_ip: Option<String>,
    pub host_mac: Option<String>,
    pub host_fqdn: Option<String>,
    pub target_comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct STIGMappingResult {
    pub total_vulnerabilities: i32,
    pub mapped_controls: Vec<MappedControl>,
    pub summary: MappingSummary,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MappedControl {
    pub nist_control: String,
    pub ccis: Vec<String>,
    pub stigs: Vec<STIGVulnerability>,
    pub compliance_status: String,
    pub risk_level: String,
    pub findings_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct STIGVulnerability {
    pub vuln_num: String,
    pub severity: String,
    pub group_title: String,
    pub rule_id: String,
    pub rule_ver: String,
    pub rule_title: String,
    pub vuln_discuss: String,
    pub check_content: String,
    pub fix_text: String,
    pub cci_refs: Vec<String>,
    pub status: String,
    pub finding_details: String,
    pub comments: String,
    pub severity_override: Option<String>,
    pub severity_justification: Option<String>,
    pub stig_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MappingSummary {
    pub total_controls: i32,
    pub compliant_controls: i32,
    pub non_compliant_controls: i32,
    pub not_applicable_controls: i32,
    pub not_reviewed_controls: i32,
    pub high_risk_findings: i32,
    pub medium_risk_findings: i32,
    pub low_risk_findings: i32,
}

// Security Test Plan Data Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecurityTestPlan {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub status: String,
    pub poam_id: Option<i64>,
    pub stig_mapping_id: Option<String>,
    pub test_cases: Vec<TestCase>,
    pub overall_score: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub id: String,
    pub nist_control: String,
    pub cci_ref: String,
    pub stig_vuln_id: String,
    pub test_description: String,
    pub test_procedure: String,
    pub expected_result: String,
    pub actual_result: Option<String>,
    pub status: String, // Not Started, In Progress, Passed, Failed, Not Applicable
    pub notes: Option<String>,
    pub evidence_files: Option<Vec<String>>,
    pub tested_by: Option<String>,
    pub tested_date: Option<String>,
    pub risk_rating: String,
}

// STP Prep List Data Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StpPrepList {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub source_mapping_id: Option<String>,
    pub stig_info: STIGInfo,
    pub asset_info: AssetInfo,
    pub prep_status: String, // ready, in_use, archived
    pub selected_controls: Vec<PrepControl>,
    pub control_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrepControl {
    pub nist_control: String,
    pub ccis: Vec<String>,
    pub stigs: Vec<STIGVulnerability>,
    pub compliance_status: String,
    pub risk_level: String,
    pub notes: Option<String>,
    pub selected_for_stp: bool,
}

// Control-POAM Association Structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ControlPOAMAssociation {
    pub id: String,
    pub control_id: String,
    pub poam_id: i64,
    pub association_date: String,
    pub created_by: Option<String>,
    pub notes: Option<String>,
}

// Baseline Control Structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BaselineControl {
    pub id: String,          // Control ID (e.g., AC-1, SI-4)
    pub family: String,      // Control family (e.g., AC, SI)
    pub title: String,       // Control title
    pub implementation_status: String, // Implemented, Partially Implemented, Not Implemented, etc.
    pub date_added: String,  // ISO date string
    pub responsible_party: String, // Who is responsible for implementing this control
    pub notes: String,       // Any notes about this control's implementation
    pub system_id: String,   // The system this baseline control belongs to
}

// System Package Data Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct System {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub owner: Option<String>,
    pub classification: Option<String>, // For security classification
    pub tags: Option<Vec<String>>,
    pub is_active: bool,
    pub poam_count: Option<i32>,
    pub last_accessed: Option<String>,
    pub group_id: Option<String>, // Reference to system group
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner: Option<String>,
    pub classification: Option<String>,
    pub tags: Option<Vec<String>>,
    pub poam_count: i32,
    pub notes_count: i32,
    pub stig_mappings_count: i32,
    pub test_plans_count: i32,
    pub last_accessed: Option<String>,
    pub created_date: String,
    pub group_id: Option<String>, // Reference to system group
}

// Update POAMData to include system information
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemExportData {
    pub system: System,
    pub poams: Vec<POAM>,
    pub notes: Vec<Note>,
    pub stig_mappings: Option<Vec<STIGMappingData>>,
    pub test_plans: Option<Vec<SecurityTestPlan>>,
    pub prep_lists: Option<Vec<StpPrepList>>,
    pub baseline_controls: Option<Vec<BaselineControl>>,
    pub poam_control_associations: Option<Vec<ControlPOAMAssociation>>,
    pub export_date: Option<String>,
    pub export_version: Option<String>,
}

// System Group Data Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>, // For UI theming
    pub created_date: String,
    pub updated_date: String,
    pub created_by: Option<String>,
    pub is_active: bool,
    pub system_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupSystemAssociation {
    pub id: String,
    pub group_id: String,
    pub system_id: String,
    pub added_date: String,
    pub added_by: Option<String>,
    pub display_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub system_count: i32,
    pub total_poam_count: i32,
    pub total_notes_count: i32,
    pub total_stig_mappings_count: i32,
    pub total_test_plans_count: i32,
    pub created_date: String,
    pub last_accessed: Option<String>,
    pub systems: Option<Vec<SystemSummary>>, // For detailed group views
}

// Enhanced export data to include group information
#[derive(Debug, Serialize, Deserialize)]
pub struct GroupExportData {
    pub group: SystemGroup,
    pub systems: Vec<SystemExportData>,
    pub export_date: Option<String>,
    pub export_version: Option<String>,
}

// Group-level POAM structure for cross-system POAMs
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupPOAM {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub priority: String,
    pub risk_level: String,
    pub group_id: String,
    pub affected_systems: Vec<String>, // System IDs that this POAM affects
    pub milestones: Vec<Milestone>,
    // All the enhanced fields from regular POAMs
    pub resources: Option<String>,
    pub source_identifying_vulnerability: Option<String>,
    pub raw_severity: Option<String>,
    pub severity: Option<String>,
    pub relevance_of_threat: Option<String>,
    pub likelihood: Option<String>,
    pub impact: Option<String>,
    pub residual_risk: Option<String>,
    pub mitigations: Option<String>,
    pub devices_affected: Option<String>,
}

// Group-level Security Test Plan
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupSecurityTestPlan {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub status: String,
    pub group_id: String,
    pub included_systems: Vec<String>, // System IDs included in this test plan
    pub group_poam_id: Option<i64>,
    pub test_cases: Vec<TestCase>,
    pub overall_score: Option<f64>,
}