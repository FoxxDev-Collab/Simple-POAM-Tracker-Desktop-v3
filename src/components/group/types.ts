export interface NistControl {
  id: string;
  family: string;
  title: string; // from name field
  controlText: string; // from controlText field
  discussion: string; // from discussion field
  relatedControls: string[];
  impact: ('LOW' | 'MODERATE' | 'HIGH')[]; // We'll determine this based on control ID
  ccis?: CCI[];
}

export interface NistCatalogEntry {
  name: string;
  controlText: string;
  discussion: string;
  relatedControls: string[];
  ccis?: CCI[];
}

export interface CCI {
  cci: string;
  definition: string;
}

export interface NistCatalog {
  [controlId: string]: NistCatalogEntry;
}

export interface BaselineControl {
  id: string;
  family: string;
  title: string;
  implementationStatus: 'Not Implemented' | 'Partially Implemented' | 'Implemented' | 'Not Applicable';
  notes?: string;
  dateAdded: string;
  responsibleParty?: string;
}

export interface ControlAssociation {
  controlId: string;
  associatedItems: AssociatedItem[];
}

export interface AssociatedItem {
  id: string;
  type: 'POAM' | 'STP' | 'VULN';
  poamId?: number;  // ID of the associated POAM (when type is 'POAM')
  title: string;
  status: string;
  date: string;  // Association date
}

export enum ControlFamily {
  AC = 'Access Control',
  AT = 'Awareness and Training',
  AU = 'Audit and Accountability',
  CA = 'Assessment, Authorization, and Monitoring',
  CM = 'Configuration Management',
  CP = 'Contingency Planning',
  IA = 'Identification and Authentication',
  IR = 'Incident Response',
  MA = 'Maintenance',
  MP = 'Media Protection',
  PE = 'Physical and Environmental Protection',
  PL = 'Planning',
  PM = 'Program Management',
  PS = 'Personnel Security',
  PT = 'PII Processing and Transparency',
  RA = 'Risk Assessment',
  SA = 'System and Services Acquisition',
  SC = 'System and Communications Protection',
  SI = 'System and Information Integrity',
  SR = 'Supply Chain Risk Management'
}
