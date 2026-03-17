export interface AccountMapping {
  credit_account: string | null;
  debit_account: string | null;
  is_mapped: boolean;
}

export interface EventItem {
  entry_type: "PROVENTO" | "DESCONTO";
  event_code: string;
  description: string;
  amount: number;
  mapping: AccountMapping | null;
}

export interface PayrollBlock {
  company_code: string;
  company_name: string;
  company_cnpj: string | null;
  company_cnpj_base: string | null;
  company_is_mapped: boolean;
  competence: string;
  cost_center_code: string | null;
  cost_center_name: string | null;
  cost_center_is_mapped: boolean;
  is_totalizer: boolean;
  events: EventItem[];
  summary: Record<string, number>;
  gps: Record<string, string | number>;
  source_start_row: number | null;
}

export interface PayrollMirrorResult {
  source_file: string;
  total_blocks: number;
  blocks: PayrollBlock[];
}
