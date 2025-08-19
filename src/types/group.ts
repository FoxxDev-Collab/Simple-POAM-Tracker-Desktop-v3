export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
}

export interface GroupPOAM {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  risk_level: string;
  group_id: string;
  affected_systems: string[];
  milestones: Milestone[];
  // Enhanced fields
  resources?: string;
  source_identifying_vulnerability?: string;
  raw_severity?: string;
  severity?: string;
  relevance_of_threat?: string;
  likelihood?: string;
  impact?: string;
  residual_risk?: string;
  mitigations?: string;
  devices_affected?: string;
}
