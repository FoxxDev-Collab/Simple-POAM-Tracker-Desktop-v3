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
    pub selected_findings: Vec<String>,
    pub finding_count: i32,
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
        self.conn.execute(
            "INSERT OR REPLACE INTO nessus_prep_lists
                (id, name, description, created_date, updated_date, source_scan_id, asset_info, selected_findings, finding_count, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
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
                system_id
            ],
        )?;
        Ok(())
    }

    pub fn get_prep_lists(&self, system_id: &str) -> Result<Vec<NessusPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_scan_id, asset_info, selected_findings, finding_count FROM nessus_prep_lists WHERE system_id = ?1 ORDER BY updated_date DESC"
        )?;
        let rows = stmt.query_map(params![system_id], |row| {
            let asset_info_json: String = row.get(6)?;
            let selected_findings_json: String = row.get(7)?;
            let asset_info = serde_json::from_str(&asset_info_json).unwrap_or(serde_json::json!({}));
            let selected_findings = serde_json::from_str(&selected_findings_json).unwrap_or(Vec::<String>::new());
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
            })
        })?;
        let mut lists = Vec::new();
        for r in rows { lists.push(r?); }
        Ok(lists)
    }

    pub fn delete_prep_list(&self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM nessus_prep_lists WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }
}


