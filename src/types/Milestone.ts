export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
  poamTitle?: string;
  poamId?: number;
}

export type MilestoneStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Delayed'; 