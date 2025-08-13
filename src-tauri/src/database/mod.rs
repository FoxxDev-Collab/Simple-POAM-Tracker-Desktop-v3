pub mod utils;
pub mod setup;
pub mod systems;
pub mod groups;
pub mod poams;
pub mod notes;
pub mod stig_mappings;
pub mod security_test_plans;
pub mod control_poam_associations;
pub mod baseline_controls;
pub mod nessus;

pub use utils::{DatabaseError, get_database};
pub use systems::{SystemOperations, SystemQueries};
pub use groups::{GroupOperations, GroupQueries};
pub use setup::DatabaseSetup;
pub use poams::{POAMOperations, POAMQueries};
pub use notes::{NoteOperations, NoteQueries};
pub use stig_mappings::{STIGMappingOperations, STIGMappingQueries};
pub use security_test_plans::{SecurityTestPlanOperations, SecurityTestPlanQueries};
pub use control_poam_associations::{ControlPOAMAssociationOperations, ControlPOAMAssociationQueries};
pub use baseline_controls::{BaselineControlOperations, BaselineControlQueries};

use crate::models::{POAM, POAMData, Note, STIGMappingData, SecurityTestPlan, StpPrepList, System, SystemSummary, ControlPOAMAssociation, BaselineControl, SystemGroup, GroupSummary, GroupPOAM, Milestone};
use rusqlite::Connection;
use tauri::AppHandle;

pub struct Database {
    pub(crate) conn: Connection,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Result<Self, DatabaseError> {
        let mut conn = DatabaseSetup::create_database(app_handle)?;
        let mut setup = DatabaseSetup::new(&mut conn);
        setup.initialize_tables()?;
        
        Ok(Self { conn })
    }



    // System Queries (read-only)
    pub fn get_all_systems(&self) -> Result<Vec<SystemSummary>, DatabaseError> {
        let system_queries = SystemQueries::new(&self.conn);
        system_queries.get_all_systems()
    }

    pub fn get_system_by_id(&self, id: &str) -> Result<Option<System>, DatabaseError> {
        let system_queries = SystemQueries::new(&self.conn);
        system_queries.get_system_by_id(id)
    }

    // System Operations (mutable)
    pub fn create_system(&mut self, system: &System) -> Result<(), DatabaseError> {
        let mut system_ops = SystemOperations::new(&mut self.conn);
        system_ops.create_system(system)
    }

    pub fn update_system(&mut self, system: &System) -> Result<(), DatabaseError> {
        let mut system_ops = SystemOperations::new(&mut self.conn);
        system_ops.update_system(system)
    }

    pub fn delete_system(&mut self, id: &str) -> Result<(), DatabaseError> {
        let mut system_ops = SystemOperations::new(&mut self.conn);
        system_ops.delete_system(id)
    }

    pub fn update_system_last_accessed(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        let mut system_ops = SystemOperations::new(&mut self.conn);
        system_ops.update_system_last_accessed(system_id)
    }

    // Group Queries (read-only)
    pub fn get_all_groups(&self) -> Result<Vec<GroupSummary>, DatabaseError> {
        let group_queries = GroupQueries::new(&self.conn);
        group_queries.get_all_groups()
    }

    pub fn get_group_by_id(&self, id: &str) -> Result<Option<SystemGroup>, DatabaseError> {
        let group_queries = GroupQueries::new(&self.conn);
        group_queries.get_group_by_id(id)
    }

    // Group Operations (mutable)
    pub fn create_group(&mut self, group: &SystemGroup) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.create_group(group)
    }

    pub fn update_group(&mut self, group: &SystemGroup) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.update_group(group)
    }

    pub fn delete_group(&mut self, id: &str) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.delete_group(id)
    }

    pub fn add_system_to_group(&mut self, group_id: &str, system_id: &str, added_by: Option<&str>) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.add_system_to_group(group_id, system_id, added_by)
    }

    pub fn remove_system_from_group(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.remove_system_from_group(system_id)
    }

    pub fn get_systems_in_group(&mut self, group_id: &str) -> Result<Vec<SystemSummary>, DatabaseError> {
        let group_ops = GroupOperations::new(&mut self.conn);
        group_ops.get_systems_in_group(group_id)
    }

    pub fn get_ungrouped_systems(&mut self) -> Result<Vec<SystemSummary>, DatabaseError> {
        let group_ops = GroupOperations::new(&mut self.conn);
        group_ops.get_ungrouped_systems()
    }

    pub fn reorder_systems_in_group(&mut self, group_id: &str, system_orders: &[(String, i32)]) -> Result<(), DatabaseError> {
        let mut group_ops = GroupOperations::new(&mut self.conn);
        group_ops.reorder_systems_in_group(group_id, system_orders)
    }

    // POAM Operations
    pub fn import_poam_data(&mut self, data: &POAMData, system_id: &str) -> Result<(), DatabaseError> {
        let mut poam_ops = POAMOperations::new(&mut self.conn);
        poam_ops.import_poam_data(data, system_id)
    }

    pub fn create_poam(&mut self, poam: &POAM, system_id: &str) -> Result<(), DatabaseError> {
        let mut poam_ops = POAMOperations::new(&mut self.conn);
        poam_ops.create_poam(poam, system_id)
    }


    // POAM Queries (read-only)
    pub fn get_all_poams(&self, system_id: &str) -> Result<Vec<POAM>, DatabaseError> {
        let poam_queries = POAMQueries::new(&self.conn);
        poam_queries.get_all_poams(system_id)
    }

    pub fn get_poam_by_id(&self, id: i64, system_id: &str) -> Result<Option<POAM>, DatabaseError> {
        let poam_queries = POAMQueries::new(&self.conn);
        poam_queries.get_poam_by_id(id, system_id)
    }

    pub fn update_poam(&mut self, poam: &POAM, system_id: &str) -> Result<(), DatabaseError> {
        let mut ops = POAMOperations::new(&mut self.conn);
        ops.update_poam(poam, system_id)
    }

    pub fn update_milestone_status(&mut self, milestone_id: &str, poam_id: i64, status: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut ops = POAMOperations::new(&mut self.conn);
        ops.update_milestone_status(milestone_id, poam_id, status, system_id)
    }

    pub fn delete_poam(&mut self, poam_id: i64, system_id: &str) -> Result<(), DatabaseError> {
        let mut ops = POAMOperations::new(&mut self.conn);
        ops.delete_poam(poam_id, system_id)
    }

    pub fn clear_database(&mut self) -> Result<(), DatabaseError> {
        let mut poam_ops = POAMOperations::new(&mut self.conn);
        poam_ops.clear_database()
    }

    // Note Operations - delegated to NoteOperations/NoteQueries
    pub fn get_all_notes(&self, system_id: &str) -> Result<Vec<Note>, DatabaseError> {
        let note_queries = NoteQueries::new(&self.conn);
        note_queries.get_all_notes(system_id)
    }

    pub fn get_notes_by_poam(&self, poam_id: i64, system_id: &str) -> Result<Vec<Note>, DatabaseError> {
        let note_queries = NoteQueries::new(&self.conn);
        note_queries.get_notes_by_poam(poam_id, system_id)
    }

    pub fn create_note(&mut self, note: &Note, system_id: &str) -> Result<(), DatabaseError> {
        let mut note_ops = NoteOperations::new(&mut self.conn);
        note_ops.create_note(note, system_id)
    }

    pub fn update_note(&mut self, note: &Note, system_id: &str) -> Result<(), DatabaseError> {
        let mut note_ops = NoteOperations::new(&mut self.conn);
        note_ops.update_note(note, system_id)
    }

    pub fn delete_note(&mut self, note_id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut note_ops = NoteOperations::new(&mut self.conn);
        note_ops.delete_note(note_id, system_id)
    }

    // STIG Mapping Operations - delegated to STIGMappingOperations/STIGMappingQueries
    pub fn save_stig_mapping(&mut self, mapping: &STIGMappingData, system_id: &str) -> Result<(), DatabaseError> {
        let mut stig_ops = STIGMappingOperations::new(&mut self.conn);
        stig_ops.save_stig_mapping(mapping, system_id)
    }

    pub fn get_all_stig_mappings(&self, system_id: &str) -> Result<Vec<STIGMappingData>, DatabaseError> {
        let stig_queries = STIGMappingQueries::new(&self.conn);
        stig_queries.get_all_stig_mappings(system_id)
    }

    pub fn get_stig_mapping_by_id(&self, id: &str, system_id: &str) -> Result<Option<STIGMappingData>, DatabaseError> {
        let stig_queries = STIGMappingQueries::new(&self.conn);
        stig_queries.get_stig_mapping_by_id(id, system_id)
    }

    pub fn delete_stig_mapping(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut stig_ops = STIGMappingOperations::new(&mut self.conn);
        stig_ops.delete_stig_mapping(id, system_id)
    }

    pub fn clear_stig_mappings_for_system(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        let mut stig_ops = STIGMappingOperations::new(&mut self.conn);
        stig_ops.clear_stig_mappings_for_system(system_id)
    }

    // Security Test Plan Operations - delegated to SecurityTestPlanOperations/SecurityTestPlanQueries
    pub fn save_security_test_plan(&mut self, plan: &SecurityTestPlan, system_id: &str) -> Result<(), DatabaseError> {
        let mut stp_ops = SecurityTestPlanOperations::new(&mut self.conn);
        stp_ops.save_security_test_plan(plan, system_id)
    }

    pub fn get_all_security_test_plans(&self, system_id: &str) -> Result<Vec<SecurityTestPlan>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_all_security_test_plans(system_id)
    }

    pub fn get_security_test_plan_by_id(&self, id: &str, system_id: &str) -> Result<Option<SecurityTestPlan>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_security_test_plan_by_id(id, system_id)
    }

    pub fn delete_security_test_plan(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut stp_ops = SecurityTestPlanOperations::new(&mut self.conn);
        stp_ops.delete_security_test_plan(id, system_id)
    }

    pub fn get_test_plans_by_poam(&self, poam_id: i64, system_id: &str) -> Result<Vec<SecurityTestPlan>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_test_plans_by_poam(poam_id, system_id)
    }

    // STP Prep List Operations
    pub fn save_stp_prep_list(&mut self, prep_list: &StpPrepList, system_id: &str) -> Result<(), DatabaseError> {
        let mut stp_ops = SecurityTestPlanOperations::new(&mut self.conn);
        stp_ops.save_stp_prep_list(prep_list, system_id)
    }

    pub fn get_all_stp_prep_lists(&self, system_id: &str) -> Result<Vec<StpPrepList>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_all_stp_prep_lists(system_id)
    }

    pub fn get_stp_prep_list_by_id(&self, id: &str, system_id: &str) -> Result<Option<StpPrepList>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_stp_prep_list_by_id(id, system_id)
    }

    pub fn delete_stp_prep_list(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut stp_ops = SecurityTestPlanOperations::new(&mut self.conn);
        stp_ops.delete_stp_prep_list(id, system_id)
    }

    pub fn get_stp_prep_lists_by_source_mapping(&self, source_mapping_id: &str, system_id: &str) -> Result<Vec<StpPrepList>, DatabaseError> {
        let stp_queries = SecurityTestPlanQueries::new(&self.conn);
        stp_queries.get_stp_prep_lists_by_source_mapping(source_mapping_id, system_id)
    }

    // Control-POAM Association Operations - delegated to ControlPOAMAssociationOperations/ControlPOAMAssociationQueries
    pub fn create_control_poam_association(
        &mut self, 
        control_id: &str, 
        poam_id: i64, 
        system_id: &str,
        created_by: Option<&str>,
        notes: Option<&str>
    ) -> Result<String, DatabaseError> {
        let mut assoc_ops = ControlPOAMAssociationOperations::new(&mut self.conn);
        assoc_ops.create_control_poam_association(control_id, poam_id, system_id, created_by, notes)
    }

    pub fn delete_control_poam_association(
        &mut self,
        association_id: &str,
        system_id: &str
    ) -> Result<(), DatabaseError> {
        let mut assoc_ops = ControlPOAMAssociationOperations::new(&mut self.conn);
        assoc_ops.delete_control_poam_association(association_id, system_id)
    }

    pub fn get_control_poam_associations_by_control(
        &self,
        control_id: &str,
        system_id: &str
    ) -> Result<Vec<ControlPOAMAssociation>, DatabaseError> {
        let assoc_queries = ControlPOAMAssociationQueries::new(&self.conn);
        assoc_queries.get_control_poam_associations_by_control(control_id, system_id)
    }

    pub fn get_control_poam_associations_by_poam(
        &self,
        poam_id: i64,
        system_id: &str
    ) -> Result<Vec<ControlPOAMAssociation>, DatabaseError> {
        let assoc_queries = ControlPOAMAssociationQueries::new(&self.conn);
        assoc_queries.get_control_poam_associations_by_poam(poam_id, system_id)
    }

    // Baseline Controls Operations - delegated to BaselineControlOperations/BaselineControlQueries
    pub fn get_baseline_controls(&self, system_id: &str) -> Result<Vec<BaselineControl>, DatabaseError> {
        let baseline_queries = BaselineControlQueries::new(&self.conn);
        baseline_queries.get_baseline_controls(system_id)
    }

    pub fn add_baseline_control(&mut self, control: &BaselineControl) -> Result<(), DatabaseError> {
        let mut baseline_ops = BaselineControlOperations::new(&mut self.conn);
        baseline_ops.add_baseline_control(control)
    }

    pub fn update_baseline_control(&mut self, control: &BaselineControl) -> Result<(), DatabaseError> {
        let mut baseline_ops = BaselineControlOperations::new(&mut self.conn);
        baseline_ops.update_baseline_control(control)
    }

    pub fn remove_baseline_control(&mut self, control_id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let mut baseline_ops = BaselineControlOperations::new(&mut self.conn);
        baseline_ops.remove_baseline_control(control_id, system_id)
    }

    // Nessus scans and findings
    pub fn save_nessus_scan_and_findings(
        &mut self,
        scan: &nessus::NessusScanMeta,
        findings: &[nessus::NessusFinding],
        system_id: &str,
    ) -> Result<(), DatabaseError> {
        let mut ops = nessus::NessusOperations::new(&mut self.conn);
        ops.save_scan(scan, system_id)?;
        ops.save_findings(findings, system_id)
    }

    pub fn get_nessus_scans(&self, system_id: &str) -> Result<Vec<nessus::NessusScanMeta>, DatabaseError> {
        let queries = nessus::NessusQueries::new(&self.conn);
        queries.get_scans(system_id)
    }

    pub fn get_nessus_findings_by_scan(&self, scan_id: &str, system_id: &str) -> Result<Vec<nessus::NessusFinding>, DatabaseError> {
        let queries = nessus::NessusQueries::new(&self.conn);
        queries.get_findings_by_scan(scan_id, system_id)
    }

    pub fn save_nessus_prep_list(&mut self, prep: &nessus::NessusPrepList, system_id: &str) -> Result<(), DatabaseError> {
        let queries = nessus::NessusQueries::new(&self.conn);
        queries.save_prep_list(prep, system_id)
    }

    pub fn get_all_nessus_prep_lists(&self, system_id: &str) -> Result<Vec<nessus::NessusPrepList>, DatabaseError> {
        let queries = nessus::NessusQueries::new(&self.conn);
        queries.get_prep_lists(system_id)
    }

    pub fn delete_nessus_prep_list(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let queries = nessus::NessusQueries::new(&self.conn);
        queries.delete_prep_list(id, system_id)
    }

    pub fn clear_all_nessus_data_for_system(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        let mut ops = nessus::NessusOperations::new(&mut self.conn);
        ops.clear_scans_and_findings_for_system(system_id)
    }

    // Database file management
    pub fn delete_database_file(app_handle: &AppHandle) -> Result<(), DatabaseError> {
        POAMOperations::delete_database_file(app_handle)
    }
}
