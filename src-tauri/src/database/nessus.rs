use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use super::utils::DatabaseError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NessusScanMeta {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub imported_date: String,
    pub version: i32,
    pub source_file: Option<String>,
    pub scan_info: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NessusFinding {
    pub id: String,
    pub scan_id: String,
    pub plugin_id: Option<i64>,
    pub plugin_name: Option<String>,
    pub severity: Option<String>,
    pub risk_factor: Option<String>,
    pub cve: Option<String>,
    pub cvss_base_score: Option<f64>,
    pub host: Option<String>,
    pub port: Option<i64>,
    pub protocol: Option<String>,
    pub synopsis: Option<String>,
    pub description: Option<String>,
    pub solution: Option<String>,
    pub raw_json: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NessusPrepList {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_date: String,
    pub updated_date: String,
    pub source_scan_id: Option<String>,
    pub asset_info: serde_json::Value,
    pub selected_findings: serde_json::Value,  // Changed from Vec<String> to flexible JSON
    pub finding_count: i32,
    // Optional additional fields for new functionality
    pub milestones: Option<serde_json::Value>,
    pub cve_analysis: Option<serde_json::Value>,
    pub summary: Option<serde_json::Value>,
    pub prep_status: Option<String>,
    pub scan_info: Option<serde_json::Value>,
}

pub struct NessusOperations<'a> {
    pub conn: &'a mut Connection,
}

pub struct NessusQueries<'a> {
    pub conn: &'a Connection,
}

impl<'a> NessusOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self { Self { conn } }

    pub fn save_scan(&mut self, scan: &NessusScanMeta, system_id: &str) -> Result<(), DatabaseError> {
        let scan_info_json = serde_json::to_string(&scan.scan_info).unwrap();
        self.conn.execute(
            "INSERT OR REPLACE INTO nessus_scans (id, name, description, imported_date, version, source_file, scan_info, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                scan.id,
                scan.name,
                scan.description,
                scan.imported_date,
                scan.version,
                scan.source_file,
                scan_info_json,
                system_id
            ],
        )?;
        Ok(())
    }

    pub fn save_findings(&mut self, findings: &[NessusFinding], system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO nessus_findings (
                    id, scan_id, plugin_id, plugin_name, severity, risk_factor, cve, cvss_base_score,
                    host, port, protocol, synopsis, description, solution, raw_json, system_id
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
            )?;
            for f in findings {
                let raw_json = serde_json::to_string(&f.raw_json).unwrap();
                stmt.execute(params![
                    f.id,
                    f.scan_id,
                    f.plugin_id,
                    f.plugin_name,
                    f.severity,
                    f.risk_factor,
                    f.cve,
                    f.cvss_base_score,
                    f.host,
                    f.port,
                    f.protocol,
                    f.synopsis,
                    f.description,
                    f.solution,
                    raw_json,
                    system_id
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn clear_scans_and_findings_for_system(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        // Wrap in transaction for atomicity
        let tx = self.conn.transaction()?;
        // Delete findings first (FK on scan_id has ON DELETE CASCADE, but be explicit by system)
        tx.execute("DELETE FROM nessus_findings WHERE system_id = ?1", params![system_id])?;
        // Delete scans
        tx.execute("DELETE FROM nessus_scans WHERE system_id = ?1", params![system_id])?;
        tx.commit()?;
        Ok(())
    }

    pub fn delete_scan(&mut self, scan_id: &str, system_id: &str) -> Result<(), DatabaseError> {
        // Remove a single scan and its findings for the given system
        let tx = self.conn.transaction()?;
        tx.execute(
            "DELETE FROM nessus_findings WHERE scan_id = ?1 AND system_id = ?2",
            params![scan_id, system_id],
        )?;
        tx.execute(
            "DELETE FROM nessus_scans WHERE id = ?1 AND system_id = ?2",
            params![scan_id, system_id],
        )?;
        tx.commit()?;
        Ok(())
    }
}

impl<'a> NessusQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self { Self { conn } }

    pub fn get_scans(&self, system_id: &str) -> Result<Vec<NessusScanMeta>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, imported_date, version, source_file, scan_info FROM nessus_scans WHERE system_id = ?1 ORDER BY imported_date DESC"
        )?;
        let rows = stmt.query_map(params![system_id], |row| {
            let scan_info_json: String = row.get(6)?;
            let scan_info: serde_json::Value = serde_json::from_str(&scan_info_json).unwrap_or(serde_json::json!({}));
            Ok(NessusScanMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                imported_date: row.get(3)?,
                version: row.get(4)?,
                source_file: row.get(5)?,
                scan_info,
            })
        })?;
        let mut scans = Vec::new();
        for r in rows { scans.push(r?); }
        Ok(scans)
    }

    pub fn get_findings_by_scan(&self, scan_id: &str, system_id: &str) -> Result<Vec<NessusFinding>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, scan_id, plugin_id, plugin_name, severity, risk_factor, cve, cvss_base_score, host, port, protocol, synopsis, description, solution, raw_json
             FROM nessus_findings WHERE scan_id = ?1 AND system_id = ?2"
        )?;
        let rows = stmt.query_map(params![scan_id, system_id], |row| {
            let raw_json: String = row.get(14)?;
            let raw_json: serde_json::Value = serde_json::from_str(&raw_json).unwrap_or(serde_json::json!({}));
            Ok(NessusFinding {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                plugin_id: row.get(2)?,
                plugin_name: row.get(3)?,
                severity: row.get(4)?,
                risk_factor: row.get(5)?,
                cve: row.get(6)?,
                cvss_base_score: row.get(7)?,
                host: row.get(8)?,
                port: row.get(9)?,
                protocol: row.get(10)?,
                synopsis: row.get(11)?,
                description: row.get(12)?,
                solution: row.get(13)?,
                raw_json,
            })
        })?;
        let mut findings = Vec::new();
        for r in rows { findings.push(r?); }
        Ok(findings)
    }

    pub fn save_prep_list(&self, prep: &NessusPrepList, system_id: &str) -> Result<(), DatabaseError> {
        let selected_findings_json = serde_json::to_string(&prep.selected_findings).unwrap();
        let asset_info_json = serde_json::to_string(&prep.asset_info).unwrap();
        let milestones_json = prep.milestones.as_ref().map(|m| serde_json::to_string(m).unwrap());
        let cve_analysis_json = prep.cve_analysis.as_ref().map(|c| serde_json::to_string(c).unwrap());
        let summary_json = prep.summary.as_ref().map(|s| serde_json::to_string(s).unwrap());
        let scan_info_json = prep.scan_info.as_ref().map(|s| serde_json::to_string(s).unwrap());
        
        self.conn.execute(
            "INSERT OR REPLACE INTO nessus_prep_lists
                (id, name, description, created_date, updated_date, source_scan_id, asset_info, selected_findings, finding_count, system_id, milestones, cve_analysis, summary, prep_status, scan_info)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                prep.id,
                prep.name,
                prep.description,
                prep.created_date,
                prep.updated_date,
                prep.source_scan_id,
                asset_info_json,
                selected_findings_json,
                prep.finding_count,
                system_id,
                milestones_json,
                cve_analysis_json,
                summary_json,
                prep.prep_status,
                scan_info_json
            ],
        )?;
        Ok(())
    }

    pub fn get_prep_lists(&self, system_id: &str) -> Result<Vec<NessusPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_scan_id, asset_info, selected_findings, finding_count, milestones, cve_analysis, summary, prep_status, scan_info FROM nessus_prep_lists WHERE system_id = ?1 ORDER BY updated_date DESC"
        )?;
        let rows = stmt.query_map(params![system_id], |row| {
            let asset_info_json: String = row.get(6)?;
            let selected_findings_json: String = row.get(7)?;
            let asset_info = serde_json::from_str(&asset_info_json).unwrap_or(serde_json::json!({}));
            let selected_findings = serde_json::from_str(&selected_findings_json).unwrap_or(serde_json::json!([]));
            
            // Handle optional new fields with fallback for old records
            let milestones = row.get::<_, Option<String>>(9).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let cve_analysis = row.get::<_, Option<String>>(10).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let summary = row.get::<_, Option<String>>(11).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let prep_status = row.get::<_, Option<String>>(12).ok().flatten();
            let scan_info = row.get::<_, Option<String>>(13).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            
            Ok(NessusPrepList {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                source_scan_id: row.get(5)?,
                asset_info,
                selected_findings,
                finding_count: row.get(8)?,
                milestones,
                cve_analysis,
                summary,
                prep_status,
                scan_info,
            })
        })?;
        let mut lists = Vec::new();
        for r in rows { lists.push(r?); }
        Ok(lists)
    }

    pub fn get_prep_list_by_id(&self, id: &str, system_id: &str) -> Result<Option<NessusPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_scan_id, asset_info, selected_findings, finding_count, milestones, cve_analysis, summary, prep_status, scan_info FROM nessus_prep_lists WHERE id = ?1 AND system_id = ?2"
        )?;
        let mut rows = stmt.query_map(params![id, system_id], |row| {
            let asset_info_json: String = row.get(6)?;
            let selected_findings_json: String = row.get(7)?;
            let asset_info = serde_json::from_str(&asset_info_json).unwrap_or(serde_json::json!({}));
            let selected_findings = serde_json::from_str(&selected_findings_json).unwrap_or(serde_json::json!([]));
            
            // Handle optional new fields with fallback for old records
            let milestones = row.get::<_, Option<String>>(9).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let cve_analysis = row.get::<_, Option<String>>(10).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let summary = row.get::<_, Option<String>>(11).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            let prep_status = row.get::<_, Option<String>>(12).ok().flatten();
            let scan_info = row.get::<_, Option<String>>(13).ok().flatten().and_then(|s| serde_json::from_str(&s).ok());
            
            Ok(NessusPrepList {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                source_scan_id: row.get(5)?,
                asset_info,
                selected_findings,
                finding_count: row.get(8)?,
                milestones,
                cve_analysis,
                summary,
                prep_status,
                scan_info,
            })
        })?;
        
        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn update_prep_list(&self, prep: &NessusPrepList, system_id: &str) -> Result<(), DatabaseError> {
        let selected_findings_json = serde_json::to_string(&prep.selected_findings).unwrap();
        let asset_info_json = serde_json::to_string(&prep.asset_info).unwrap();
        let milestones_json = prep.milestones.as_ref().map(|m| serde_json::to_string(m).unwrap());
        let cve_analysis_json = prep.cve_analysis.as_ref().map(|c| serde_json::to_string(c).unwrap());
        let summary_json = prep.summary.as_ref().map(|s| serde_json::to_string(s).unwrap());
        let scan_info_json = prep.scan_info.as_ref().map(|s| serde_json::to_string(s).unwrap());
        
        self.conn.execute(
            "UPDATE nessus_prep_lists SET 
                name = ?2, description = ?3, updated_date = ?4, source_scan_id = ?5, 
                asset_info = ?6, selected_findings = ?7, finding_count = ?8,
                milestones = ?9, cve_analysis = ?10, summary = ?11, prep_status = ?12, scan_info = ?13
             WHERE id = ?1 AND system_id = ?14",
            params![
                prep.id,
                prep.name,
                prep.description,
                prep.updated_date,
                prep.source_scan_id,
                asset_info_json,
                selected_findings_json,
                prep.finding_count,
                milestones_json,
                cve_analysis_json,
                summary_json,
                prep.prep_status,
                scan_info_json,
                system_id
            ],
        )?;
        Ok(())
    }

    pub fn delete_prep_list(&self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM nessus_prep_lists WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }
}


