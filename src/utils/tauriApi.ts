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