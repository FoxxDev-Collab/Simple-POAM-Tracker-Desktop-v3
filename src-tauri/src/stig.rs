use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use quick_xml::Reader;
use quick_xml::events::Event;
// use regex::Regex;

#[derive(Debug, thiserror::Error)]
pub enum StigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("XML parsing error: {0}")]
    XmlParsing(String),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Invalid file format: {0}")]
    InvalidFormat(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCIMapping {
    pub id: String,
    pub title: String,
    pub definition: String,
    pub nist_controls: Vec<String>,
    pub cci_type: String,
    pub status: String,
    pub publish_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    pub role: String,
    pub asset_type: String,
    pub marking: String,
    pub host_name: String,
    pub host_ip: String,
    pub host_mac: String,
    pub host_fqdn: String,
    pub target_comment: String,
    pub tech_area: String,
    pub target_key: String,
    pub web_or_database: bool,
    pub web_db_site: String,
    pub web_db_instance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct STIGInfo {
    pub version: String,
    pub classification: String,
    pub custom_name: String,
    pub stig_id: String,
    pub description: String,
    pub file_name: String,
    pub release_info: String,
    pub title: String,
    pub uuid: String,
    pub notice: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct STIGChecklist {
    pub asset: AssetInfo,
    pub stig_info: STIGInfo,
    pub vulnerabilities: Vec<STIGVulnerability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappedControl {
    pub nist_control: String,
    pub ccis: Vec<String>,
    pub stigs: Vec<STIGVulnerability>,
    pub compliance_status: String,
    pub risk_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappingSummary {
    pub total_controls: usize,
    pub compliant_controls: usize,
    pub non_compliant_controls: usize,
    pub not_applicable_controls: usize,
    pub not_reviewed_controls: usize,
    pub high_risk_findings: usize,
    pub medium_risk_findings: usize,
    pub low_risk_findings: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct STIGMappingResult {
    pub checklist: STIGChecklist,
    pub cci_mappings: Vec<CCIMapping>,
    pub mapped_controls: Vec<MappedControl>,
    pub summary: MappingSummary,
}

pub fn parse_cci_list(file_path: String) -> Result<Vec<CCIMapping>, StigError> {
    let content = fs::read_to_string(&file_path)?;
    let mut reader = Reader::from_str(&content);
    reader.config_mut().trim_text(true);
    
    let mut buf = Vec::new();
    let mut cci_mappings = Vec::new();
    let mut current_cci: Option<CCIMapping> = None;
    let mut current_element = String::new();
    let mut current_text = String::new();
    let mut _in_cci_item = false;
    let mut in_references = false;
    
    println!("Starting CCI parsing...");
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_element = name.clone();
                match name.as_ref() {
                    "cci_item" => {
                        _in_cci_item = true;
                        current_cci = Some(CCIMapping {
                            id: String::new(),
                            title: String::new(),
                            definition: String::new(),
                            nist_controls: Vec::new(),
                            cci_type: String::new(),
                            status: String::new(),
                            publish_date: String::new(),
                        });
                        
                        if let Some(ref mut cci) = current_cci {
                            for attr in e.attributes() {
                                if let Ok(attr) = attr {
                                    if attr.key.as_ref() == b"id" {
                                        cci.id = String::from_utf8_lossy(&attr.value).to_string();
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    "references" => {
                        in_references = true;
                    }
                    _ => {}
                }
                current_text.clear();
            }
            Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "reference" && in_references {
                     if let Some(ref mut cci) = current_cci {
                        let title = e.attributes()
                            .find(|attr| attr.as_ref().map(|a| a.key.as_ref()) == Ok(b"title"))
                            .and_then(|attr| attr.ok())
                            .and_then(|attr| String::from_utf8(attr.value.to_vec()).ok())
                            .unwrap_or_default();
                        
                        let index = e.attributes()
                            .find(|attr| attr.as_ref().map(|a| a.key.as_ref()) == Ok(b"index"))
                            .and_then(|attr| attr.ok())
                            .and_then(|attr| String::from_utf8(attr.value.to_vec()).ok())
                            .unwrap_or_default();
                        
                        if title.contains("NIST SP 800-53") && !index.is_empty() {
                            let clean_index = index.trim().to_string();
                            if !clean_index.is_empty() && !cci.nist_controls.contains(&clean_index) {
                                cci.nist_controls.push(clean_index);
                            }
                        }
                    }
                }
            }
            Ok(Event::Text(e)) => {
                current_text.push_str(&e.unescape().unwrap_or_default());
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                
                if let Some(ref mut cci) = current_cci {
                    match current_element.as_str() {
                        "definition" => {
                            cci.definition = current_text.trim().to_string();
                            cci.title = cci.definition.split('.').next()
                                .unwrap_or(&cci.definition[..std::cmp::min(100, cci.definition.len())])
                                .to_string();
                        }
                        "type" => cci.cci_type = current_text.trim().to_string(),
                        "status" => cci.status = current_text.trim().to_string(),
                        "publishdate" => cci.publish_date = current_text.trim().to_string(),
                        _ => {}
                    }
                }
                
                if name == "cci_item" {
                    if let Some(cci) = current_cci.take() {
                        if !cci.id.is_empty() {
                            cci_mappings.push(cci);
                        }
                    }
                    _in_cci_item = false;
                } else if name == "references" {
                    in_references = false;
                }
                
                current_text.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(StigError::XmlParsing(format!("Error at position {}: {:?}", reader.buffer_position(), e))),
            _ => {}
        }
        buf.clear();
    }
    
    Ok(cci_mappings)
}

pub fn parse_stig_checklist(file_path: String) -> Result<STIGChecklist, StigError> {
    let content = fs::read_to_string(&file_path)?;
    let mut reader = Reader::from_str(&content);
    reader.config_mut().trim_text(true);
    
    println!("Starting STIG checklist parsing...");
    
    let mut buf = Vec::new();
    let mut asset = AssetInfo {
        role: String::new(),
        asset_type: String::new(),
        marking: String::new(),
        host_name: String::new(),
        host_ip: String::new(),
        host_mac: String::new(),
        host_fqdn: String::new(),
        target_comment: String::new(),
        tech_area: String::new(),
        target_key: String::new(),
        web_or_database: false,
        web_db_site: String::new(),
        web_db_instance: String::new(),
    };
    
    let mut stig_info = STIGInfo {
        version: String::new(),
        classification: String::new(),
        custom_name: String::new(),
        stig_id: String::new(),
        description: String::new(),
        file_name: String::new(),
        release_info: String::new(),
        title: String::new(),
        uuid: String::new(),
        notice: String::new(),
        source: String::new(),
    };
    
    let mut vulnerabilities = Vec::new();
    let mut _current_element = String::new();
    let mut current_text = String::new();
    let mut in_asset = false;
    let mut in_stig_info = false;
    let mut in_vuln = false;
    let mut current_vuln: Option<STIGVulnerability> = None;
    let mut stig_data_map: HashMap<String, String> = HashMap::new();
    let mut si_data_map: HashMap<String, String> = HashMap::new();
    let mut current_vuln_attribute = String::new();
    let mut current_sid_name = String::new();
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                _current_element = name.clone();
                
                match name.as_ref() {
                    "ASSET" => in_asset = true,
                    "STIG_INFO" => in_stig_info = true,
                    "VULN" => {
                        println!("Found VULN element, creating new vulnerability");
                        in_vuln = true;
                        current_vuln = Some(STIGVulnerability {
                            vuln_num: String::new(),
                            severity: String::new(),
                            group_title: String::new(),
                            rule_id: String::new(),
                            rule_ver: String::new(),
                            rule_title: String::new(),
                            vuln_discuss: String::new(),
                            check_content: String::new(),
                            fix_text: String::new(),
                            cci_refs: Vec::new(),
                            status: String::new(),
                            finding_details: String::new(),
                            comments: String::new(),
                            severity_override: None,
                            severity_justification: None,
                            stig_id: String::new(),
                        });
                        stig_data_map.clear();
                    }
                    _ => {}
                }
                current_text.clear();
            }
            Ok(Event::Text(e)) => {
                current_text.push_str(&e.unescape().unwrap_or_default());
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let text = current_text.trim().to_string();
                
                match name.as_str() {
                    // Asset elements
                    "ROLE" if in_asset => asset.role = text,
                    "ASSET_TYPE" if in_asset => asset.asset_type = text,
                    "MARKING" if in_asset => asset.marking = text,
                    "HOST_NAME" if in_asset => asset.host_name = text,
                    "HOST_IP" if in_asset => asset.host_ip = text,
                    "HOST_MAC" if in_asset => asset.host_mac = text,
                    "HOST_FQDN" if in_asset => asset.host_fqdn = text,
                    "TARGET_COMMENT" if in_asset => asset.target_comment = text,
                    "TECH_AREA" if in_asset => asset.tech_area = text,
                    "TARGET_KEY" if in_asset => asset.target_key = text,
                    "WEB_OR_DATABASE" if in_asset => asset.web_or_database = text == "true",
                    "WEB_DB_SITE" if in_asset => asset.web_db_site = text,
                    "WEB_DB_INSTANCE" if in_asset => asset.web_db_instance = text,
                    
                    // STIG Info elements
                    "SID_NAME" if in_stig_info => current_sid_name = text,
                    "SID_DATA" if in_stig_info => {
                        si_data_map.insert(current_sid_name.clone(), text);
                    }
                    
                    // STIG Data elements
                    "VULN_ATTRIBUTE" if in_vuln => {
                        current_vuln_attribute = text.clone();
                        println!("Found VULN_ATTRIBUTE: {}", text);
                    }
                    "ATTRIBUTE_DATA" if in_vuln => {
                        println!("Found ATTRIBUTE_DATA for {}: {}", current_vuln_attribute, text);
                        stig_data_map.insert(current_vuln_attribute.clone(), text);
                    }
                    
                    // Vulnerability status elements
                    "STATUS" if in_vuln => {
                        if let Some(ref mut vuln) = current_vuln {
                            vuln.status = text;
                        }
                    }
                    "FINDING_DETAILS" if in_vuln => {
                        if let Some(ref mut vuln) = current_vuln {
                            vuln.finding_details = text;
                        }
                    }
                    "COMMENTS" if in_vuln => {
                        if let Some(ref mut vuln) = current_vuln {
                            vuln.comments = text;
                        }
                    }
                    "SEVERITY_OVERRIDE" if in_vuln => {
                        if let Some(ref mut vuln) = current_vuln {
                            vuln.severity_override = if text.is_empty() { None } else { Some(text) };
                        }
                    }
                    "SEVERITY_JUSTIFICATION" if in_vuln => {
                        if let Some(ref mut vuln) = current_vuln {
                            vuln.severity_justification = if text.is_empty() { None } else { Some(text) };
                        }
                    }
                    _ => {}
                }
                
                // Handle end tags
                match name.as_ref() {
                    "ASSET" => in_asset = false,
                    "STIG_INFO" => {
                        in_stig_info = false;
                        // Populate stig_info from collected data
                        stig_info.version = si_data_map.get("version").unwrap_or(&String::new()).clone();
                        stig_info.classification = si_data_map.get("classification").unwrap_or(&String::new()).clone();
                        stig_info.custom_name = si_data_map.get("customname").unwrap_or(&String::new()).clone();
                        stig_info.stig_id = si_data_map.get("stigid").unwrap_or(&String::new()).clone();
                        stig_info.description = si_data_map.get("description").unwrap_or(&String::new()).clone();
                        stig_info.file_name = si_data_map.get("filename").unwrap_or(&String::new()).clone();
                        stig_info.release_info = si_data_map.get("releaseinfo").unwrap_or(&String::new()).clone();
                        stig_info.title = si_data_map.get("title").unwrap_or(&String::new()).clone();
                        stig_info.uuid = si_data_map.get("uuid").unwrap_or(&String::new()).clone();
                        stig_info.notice = si_data_map.get("notice").unwrap_or(&String::new()).clone();
                        stig_info.source = si_data_map.get("source").unwrap_or(&String::new()).clone();
                    }
                    "VULN" => {
                        if let Some(mut vuln) = current_vuln.take() {
                            println!("Completing VULN processing. STIG data map contents:");
                            for (key, value) in &stig_data_map {
                                println!("  {}: {}", key, value);
                            }
                            
                            // Populate vulnerability from collected STIG data
                            vuln.vuln_num = stig_data_map.get("Vuln_Num").unwrap_or(&String::new()).clone();
                            vuln.severity = stig_data_map.get("Severity").unwrap_or(&String::new()).clone();
                            vuln.group_title = stig_data_map.get("Group_Title").unwrap_or(&String::new()).clone();
                            vuln.rule_id = stig_data_map.get("Rule_ID").unwrap_or(&String::new()).clone();
                            vuln.rule_ver = stig_data_map.get("Rule_Ver").unwrap_or(&String::new()).clone();
                            vuln.rule_title = stig_data_map.get("Rule_Title").unwrap_or(&String::new()).clone();
                            vuln.vuln_discuss = stig_data_map.get("Vuln_Discuss").unwrap_or(&String::new()).clone();
                            vuln.check_content = stig_data_map.get("Check_Content").unwrap_or(&String::new()).clone();
                            vuln.fix_text = stig_data_map.get("Fix_Text").unwrap_or(&String::new()).clone();
                            
                            // Extract STIG ID from Rule_Ver field (this contains the actual STIG ID)
                            vuln.stig_id = stig_data_map.get("Rule_Ver")
                                .unwrap_or(&String::new()).clone();
                            
                            // Collect all CCI references
                            for (key, value) in &stig_data_map {
                                if key == "CCI_REF" && !value.is_empty() {
                                    println!("Found CCI reference: {} for vulnerability: {}", value, vuln.vuln_num);
                                    vuln.cci_refs.push(value.clone());
                                }
                            }
                            
                            println!("Final vulnerability: vuln_num='{}', severity='{}', cci_refs={:?}", 
                                   vuln.vuln_num, vuln.severity, vuln.cci_refs);
                            
                            vulnerabilities.push(vuln);
                        }
                        in_vuln = false;
                    }
                    _ => {}
                }
                
                current_text.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(StigError::XmlParsing(format!("Error at position {}: {:?}", reader.buffer_position(), e))),
            _ => {}
        }
        buf.clear();
    }
    
    Ok(STIGChecklist {
        asset,
        stig_info,
        vulnerabilities,
    })
}

pub fn map_stig_to_nist_controls(
    checklist: &STIGChecklist,
    cci_mappings: &[CCIMapping],
) -> Vec<MappedControl> {
    let mut control_map: HashMap<String, MappedControl> = HashMap::new();
    
    // Create a lookup map for CCI to NIST controls
    let mut cci_to_nist_map: HashMap<String, Vec<String>> = HashMap::new();
    for mapping in cci_mappings {
        cci_to_nist_map.insert(mapping.id.clone(), mapping.nist_controls.clone());
    }
    
    // Process each vulnerability
    for vuln in &checklist.vulnerabilities {
        for cci_ref in &vuln.cci_refs {
            if let Some(nist_controls) = cci_to_nist_map.get(cci_ref) {
                for nist_control in nist_controls {
                    let control = control_map.entry(nist_control.clone()).or_insert_with(|| {
                        MappedControl {
                            nist_control: nist_control.clone(),
                            ccis: Vec::new(),
                            stigs: Vec::new(),
                            compliance_status: "not-reviewed".to_string(),
                            risk_level: "low".to_string(),
                        }
                    });
                    
                    // Add CCI if not already present
                    if !control.ccis.contains(cci_ref) {
                        control.ccis.push(cci_ref.clone());
                    }
                    
                    // Add STIG if not already present
                    if !control.stigs.iter().any(|s| s.vuln_num == vuln.vuln_num) {
                        control.stigs.push(vuln.clone());
                    }
                    
                    // Update compliance status (prioritize worst status)
                    match vuln.status.as_str() {
                        "Open" => control.compliance_status = "non-compliant".to_string(),
                        "NotAFinding" if control.compliance_status != "non-compliant" => {
                            control.compliance_status = "compliant".to_string();
                        }
                        "NotApplicable" if control.compliance_status == "not-reviewed" => {
                            control.compliance_status = "not-applicable".to_string();
                        }
                        _ => {}
                    }
                    
                    // Update risk level (prioritize highest risk)
                    match vuln.severity.to_lowercase().as_str() {
                        "high" => control.risk_level = "high".to_string(),
                        "medium" if control.risk_level != "high" => {
                            control.risk_level = "medium".to_string();
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    
    let mut mapped_controls: Vec<MappedControl> = control_map.into_values().collect();
    mapped_controls.sort_by(|a, b| a.nist_control.cmp(&b.nist_control));
    mapped_controls
}

pub fn parse_and_merge_stig_checklists(file_paths: Vec<String>) -> Result<STIGChecklist, StigError> {
    if file_paths.is_empty() {
        return Err(StigError::InvalidFormat("No checklist files provided.".to_string()));
    }

    let mut merged_checklist: Option<STIGChecklist> = None;

    for (index, path) in file_paths.iter().enumerate() {
        let checklist = parse_stig_checklist(path.clone())?;
        
        if index == 0 {
            merged_checklist = Some(checklist);
        } else if let Some(merged) = &mut merged_checklist {
            merged.vulnerabilities.extend(checklist.vulnerabilities);
        }
    }

    merged_checklist.ok_or_else(|| StigError::InvalidFormat("Could not process any checklist files.".to_string()))
}

pub fn create_mapping_result(
    checklist: STIGChecklist,
    cci_mappings: Vec<CCIMapping>,
) -> STIGMappingResult {
    let mapped_controls = map_stig_to_nist_controls(&checklist, &cci_mappings);
    
    // Calculate summary statistics
    let summary = MappingSummary {
        total_controls: mapped_controls.len(),
        compliant_controls: mapped_controls.iter().filter(|c| c.compliance_status == "compliant").count(),
        non_compliant_controls: mapped_controls.iter().filter(|c| c.compliance_status == "non-compliant").count(),
        not_applicable_controls: mapped_controls.iter().filter(|c| c.compliance_status == "not-applicable").count(),
        not_reviewed_controls: mapped_controls.iter().filter(|c| c.compliance_status == "not-reviewed").count(),
        high_risk_findings: checklist.vulnerabilities.iter().filter(|v| v.severity.to_lowercase() == "high" && v.status == "Open").count(),
        medium_risk_findings: checklist.vulnerabilities.iter().filter(|v| v.severity.to_lowercase() == "medium" && v.status == "Open").count(),
        low_risk_findings: checklist.vulnerabilities.iter().filter(|v| v.severity.to_lowercase() == "low" && v.status == "Open").count(),
    };
    
    STIGMappingResult {
        checklist,
        cci_mappings,
        mapped_controls,
        summary,
    }
}

pub fn generate_ckl_xml(checklist: &STIGChecklist) -> Result<String, StigError> {
    let mut xml = String::new();
    
    // XML declaration and DISA STIG Viewer comment
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<!--DISA STIG Viewer :: 2.18-->\n");
    xml.push_str("<CHECKLIST>\n");
    
    // Asset information
    xml.push_str("\t<ASSET>\n");
    xml.push_str(&format!("\t\t<ROLE>{}</ROLE>\n", escape_xml(&checklist.asset.role)));
    xml.push_str(&format!("\t\t<ASSET_TYPE>{}</ASSET_TYPE>\n", escape_xml(&checklist.asset.asset_type)));
    xml.push_str(&format!("\t\t<MARKING>{}</MARKING>\n", escape_xml(&checklist.asset.marking)));
    xml.push_str(&format!("\t\t<HOST_NAME>{}</HOST_NAME>\n", escape_xml(&checklist.asset.host_name)));
    xml.push_str(&format!("\t\t<HOST_IP>{}</HOST_IP>\n", escape_xml(&checklist.asset.host_ip)));
    xml.push_str(&format!("\t\t<HOST_MAC>{}</HOST_MAC>\n", escape_xml(&checklist.asset.host_mac)));
    xml.push_str(&format!("\t\t<HOST_FQDN>{}</HOST_FQDN>\n", escape_xml(&checklist.asset.host_fqdn)));
    xml.push_str(&format!("\t\t<TARGET_COMMENT>{}</TARGET_COMMENT>\n", escape_xml(&checklist.asset.target_comment)));
    xml.push_str(&format!("\t\t<TECH_AREA>{}</TECH_AREA>\n", escape_xml(&checklist.asset.tech_area)));
    xml.push_str(&format!("\t\t<TARGET_KEY>{}</TARGET_KEY>\n", escape_xml(&checklist.asset.target_key)));
    xml.push_str(&format!("\t\t<WEB_OR_DATABASE>{}</WEB_OR_DATABASE>\n", checklist.asset.web_or_database));
    xml.push_str(&format!("\t\t<WEB_DB_SITE>{}</WEB_DB_SITE>\n", escape_xml(&checklist.asset.web_db_site)));
    xml.push_str(&format!("\t\t<WEB_DB_INSTANCE>{}</WEB_DB_INSTANCE>\n", escape_xml(&checklist.asset.web_db_instance)));
    xml.push_str("\t</ASSET>\n");
    
    // STIGS section
    xml.push_str("\t<STIGS>\n");
    xml.push_str("\t\t<iSTIG>\n");
    
    // STIG_INFO section
    xml.push_str("\t\t\t<STIG_INFO>\n");
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>version</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.version)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>classification</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.classification)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>customname</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.custom_name)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>stigid</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.stig_id)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>description</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.description)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>filename</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.file_name)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>releaseinfo</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.release_info)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>title</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.title)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>uuid</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.uuid)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>notice</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.notice)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t\t<SI_DATA>\n");
    xml.push_str("\t\t\t\t\t<SID_NAME>source</SID_NAME>\n");
    xml.push_str(&format!("\t\t\t\t\t<SID_DATA>{}</SID_DATA>\n", escape_xml(&checklist.stig_info.source)));
    xml.push_str("\t\t\t\t</SI_DATA>\n");
    
    xml.push_str("\t\t\t</STIG_INFO>\n");
    
    // Vulnerabilities section
    for vuln in &checklist.vulnerabilities {
        xml.push_str("\t\t\t<VULN>\n");
        
        // STIG_DATA entries
        add_stig_data(&mut xml, "Vuln_Num", &vuln.vuln_num);
        add_stig_data(&mut xml, "Severity", &vuln.severity);
        add_stig_data(&mut xml, "Group_Title", &vuln.group_title);
        add_stig_data(&mut xml, "Rule_ID", &vuln.rule_id);
        add_stig_data(&mut xml, "Rule_Ver", &vuln.rule_ver);
        add_stig_data(&mut xml, "Rule_Title", &vuln.rule_title);
        add_stig_data(&mut xml, "Vuln_Discuss", &vuln.vuln_discuss);
        add_stig_data(&mut xml, "IA_Controls", "");
        add_stig_data(&mut xml, "Check_Content", &vuln.check_content);
        add_stig_data(&mut xml, "Fix_Text", &vuln.fix_text);
        add_stig_data(&mut xml, "False_Positives", "");
        add_stig_data(&mut xml, "False_Negatives", "");
        add_stig_data(&mut xml, "Documentable", "false");
        add_stig_data(&mut xml, "Mitigations", "");
        add_stig_data(&mut xml, "Potential_Impact", "");
        add_stig_data(&mut xml, "Third_Party_Tools", "");
        add_stig_data(&mut xml, "Mitigation_Control", "");
        add_stig_data(&mut xml, "Responsibility", "");
        add_stig_data(&mut xml, "Security_Override_Guidance", "");
        add_stig_data(&mut xml, "Check_Content_Ref", "M");
        add_stig_data(&mut xml, "Weight", "10.0");
        add_stig_data(&mut xml, "Class", "Unclass");
        add_stig_data(&mut xml, "STIGRef", &format!("{} :: {}", checklist.stig_info.title, checklist.stig_info.release_info));
        add_stig_data(&mut xml, "TargetKey", &checklist.asset.target_key);
        add_stig_data(&mut xml, "STIG_UUID", "");
        add_stig_data(&mut xml, "LEGACY_ID", "");
        
        // CCI References
        for cci_ref in &vuln.cci_refs {
            add_stig_data(&mut xml, "CCI_REF", cci_ref);
        }
        
        // Status and findings
        xml.push_str(&format!("\t\t\t\t<STATUS>{}</STATUS>\n", escape_xml(&vuln.status)));
        xml.push_str(&format!("\t\t\t\t<FINDING_DETAILS>{}</FINDING_DETAILS>\n", escape_xml(&vuln.finding_details)));
        xml.push_str(&format!("\t\t\t\t<COMMENTS>{}</COMMENTS>\n", escape_xml(&vuln.comments)));
        xml.push_str(&format!("\t\t\t\t<SEVERITY_OVERRIDE>{}</SEVERITY_OVERRIDE>\n", escape_xml(&vuln.severity_override.as_ref().unwrap_or(&String::new()))));
        xml.push_str(&format!("\t\t\t\t<SEVERITY_JUSTIFICATION>{}</SEVERITY_JUSTIFICATION>\n", escape_xml(&vuln.severity_justification.as_ref().unwrap_or(&String::new()))));
        
        xml.push_str("\t\t\t</VULN>\n");
    }
    
    // Close tags
    xml.push_str("\t\t</iSTIG>\n");
    xml.push_str("\t</STIGS>\n");
    xml.push_str("</CHECKLIST>\n");
    
    Ok(xml)
}

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn add_stig_data(xml: &mut String, attribute: &str, value: &str) {
    xml.push_str("\t\t\t\t<STIG_DATA>\n");
    xml.push_str(&format!("\t\t\t\t\t<VULN_ATTRIBUTE>{}</VULN_ATTRIBUTE>\n", escape_xml(attribute)));
    xml.push_str(&format!("\t\t\t\t\t<ATTRIBUTE_DATA>{}</ATTRIBUTE_DATA>\n", escape_xml(value)));
    xml.push_str("\t\t\t\t</STIG_DATA>\n");
} 