import { invoke } from '@tauri-apps/api/core';
import { CCIMapping, STIGChecklist, STIGMappingResult } from '../types/stig';

/**
 * Parse CCI List XML file using Tauri backend
 */
export const parseCCIListFile = (filePath: string): Promise<CCIMapping[]> =>
  invoke('parse_cci_list_file', { filePath });

/**
 * Parse STIG checklist XML file using Tauri backend
 */
export const parseSTIGChecklistFile = (filePath: string): Promise<STIGChecklist> =>
  invoke('parse_stig_checklist_file', { filePath });

/**
 * Parse multiple STIG checklist files using Tauri backend
 */
export const parseMultipleSTIGChecklists = (filePaths: string[]): Promise<STIGChecklist[]> =>
  invoke('parse_multiple_stig_checklists', { filePaths });

/**
 * Create STIG to NIST mapping using Tauri backend
 */
export const createSTIGMapping = (checklist: STIGChecklist, cciMappings: CCIMapping[]): Promise<STIGMappingResult> =>
  invoke('create_stig_mapping', { checklist, cciMappings });

/**
 * STIG Mapping Functions - System-aware
 */
export async function getAllStigMappings(systemId: string): Promise<any[]> {
  return await invoke('get_all_stig_mappings', { systemId });
}

export async function getStigMappingById(id: string, systemId: string): Promise<any | null> {
  return await invoke('get_stig_mapping_by_id', { id, systemId });
}

export async function deleteStigMapping(id: string, systemId: string): Promise<void> {
  return await invoke('delete_stig_mapping', { id, systemId });
}

export async function saveStigMapping(mapping: any, systemId: string): Promise<void> {
  return await invoke('save_stig_mapping', { mapping, systemId });
}

/**
 * Security Test Plan Functions - System-aware
 */
export async function getAllSecurityTestPlans(systemId: string): Promise<any[]> {
  return await invoke('get_all_security_test_plans', { systemId });
}

export async function getSecurityTestPlanById(id: string, systemId: string): Promise<any | null> {
  return await invoke('get_security_test_plan_by_id', { id, systemId });
}

export async function saveSecurityTestPlan(plan: any, systemId: string): Promise<void> {
  return await invoke('save_security_test_plan', { plan, systemId });
}

export async function deleteSecurityTestPlan(id: string, systemId: string): Promise<void> {
  return await invoke('delete_security_test_plan', { id, systemId });
}

export async function getTestPlansByPoam(poamId: number, systemId: string): Promise<any[]> {
  return await invoke('get_test_plans_by_poam', { poamId, systemId });
}

export async function exportSecurityTestPlans(exportPath: string, systemId: string): Promise<string> {
  return await invoke('export_security_test_plans', { exportPath, systemId });
}

export async function importSecurityTestPlans(filePath: string, systemId: string): Promise<string> {
  return await invoke('import_security_test_plans', { filePath, systemId });
}

/**
 * STP Prep List Functions - System-aware
 */
export async function saveStpPrepList(prepList: any, systemId: string): Promise<void> {
  return await invoke('save_stp_prep_list', { prepList, systemId });
}

export async function updateStpPrepList(prepList: any, systemId: string): Promise<void> {
  return await invoke('update_stp_prep_list', { prepList, systemId });
}

export async function getAllStpPrepLists(systemId: string): Promise<any[]> {
  return await invoke('get_all_stp_prep_lists', { systemId });
}

export async function getStpPrepListById(id: string, systemId: string): Promise<any | null> {
  return await invoke('get_stp_prep_list_by_id', { id, systemId });
}

export async function deleteStpPrepList(id: string, systemId: string): Promise<void> {
  return await invoke('delete_stp_prep_list', { id, systemId });
}

export async function getStpPrepListsBySourceMapping(sourceMappingId: string, systemId: string): Promise<any[]> {
  return await invoke('get_stp_prep_lists_by_source_mapping', { sourceMappingId, systemId });
}

/**
 * Import/Export Functions - System-aware
 */
export async function importJsonFile(filePath: string, systemId: string): Promise<string> {
  return await invoke('import_json_file', { filePath, systemId });
}

export async function importJsonFileWithStig(filePath: string, systemId: string): Promise<string> {
  return await invoke('import_json_file_with_stig', { filePath, systemId });
}

export async function exportData(exportPath: string, systemId: string): Promise<string> {
  return await invoke('export_data', { exportPath, systemId });
}

export async function exportDataWithStig(exportPath: string, systemId: string): Promise<string> {
  return await invoke('export_data_with_stig', { exportPath, systemId });
} 

// Nessus Center API
export async function importNessusFiles(filePaths: string[], systemId: string): Promise<string> {
  return await invoke('import_nessus_files', { filePaths, systemId });
}

export async function getNessusScans(systemId: string): Promise<any[]> {
  return await invoke('get_nessus_scans', { systemId });
}

export async function getNessusFindingsByScan(scanId: string, systemId: string): Promise<any[]> {
  return await invoke('get_nessus_findings_by_scan', { scanId, systemId });
}

export async function saveNessusPrepList(prep: any, systemId: string): Promise<void> {
  return await invoke('save_nessus_prep_list', { prep, systemId });
}

export async function getAllNessusPrepLists(systemId: string): Promise<any[]> {
  return await invoke('get_all_nessus_prep_lists', { systemId });
}

export async function deleteNessusPrepList(id: string, systemId: string): Promise<void> {
  return await invoke('delete_nessus_prep_list', { id, systemId });
}

// Clear Nessus scans and findings for a system
export async function clearNessusData(systemId: string): Promise<string> {
  return await invoke('clear_nessus_data', { systemId });
}

// Clear STIG mappings for a system
export async function clearStigData(systemId: string): Promise<string> {
  return await invoke('clear_stig_data', { systemId });
}

/**
 * Group Management Functions
 */
export async function createGroup(group: any): Promise<void> {
  return await invoke('create_group', { group });
}

export async function getAllGroups(): Promise<any[]> {
  return await invoke('get_all_groups');
}

export async function getGroupById(id: string): Promise<any | null> {
  return await invoke('get_group_by_id', { id });
}

export async function updateGroup(group: any): Promise<void> {
  return await invoke('update_group', { group });
}

export async function deleteGroup(id: string): Promise<void> {
  return await invoke('delete_group', { id });
}

export async function addSystemToGroup(groupId: string, systemId: string, addedBy?: string): Promise<void> {
  return await invoke('add_system_to_group', { groupId, systemId, addedBy });
}

export async function removeSystemFromGroup(systemId: string): Promise<void> {
  return await invoke('remove_system_from_group', { systemId });
}

export async function getSystemsInGroup(groupId: string): Promise<any[]> {
  return await invoke('get_systems_in_group', { groupId });
}

export async function getUngroupedSystems(): Promise<any[]> {
  return await invoke('get_ungrouped_systems');
}

// Group details (alias retained for clarity in callers)
export async function getGroupDetails(groupId: string): Promise<any | null> {
  return await getGroupById(groupId);
}

export async function reorderSystemsInGroup(groupId: string, systemOrders: Array<[string, number]>): Promise<void> {
  return await invoke('reorder_systems_in_group', { groupId, systemOrders });
}