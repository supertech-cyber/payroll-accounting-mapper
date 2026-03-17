export type ProvisionType = "13th_salary" | "vacation";

export interface ProvisionEntry {
  entry_code: string;
  entry_description: string;
  amount_previous: number;
  amount_current: number;
  amount_difference: number;
}

export interface ProvisionResultItem {
  company_code: string;
  company_name: string;
  company_cnpj: string | null;
  company_cnpj_base: string | null;
  competence_previous: string;
  competence_current: string;
  cost_center_code: string;
  cost_center_name: string;
  entries: ProvisionEntry[];
}

export interface ProvisionsResult {
  source_files: string[];
  provision_type: ProvisionType;
  total_cost_centers: number;
  items: ProvisionResultItem[];
}
