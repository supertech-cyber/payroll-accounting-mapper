export interface Company {
  id: number;
  code: string;
  name: string;
  cnpj: string | null;
  cnpj_base: string | null;
  output_template: string | null;
  fpa_batch: number | null;
  tag: string | null;
}

export interface Tag {
  id: number;
  slug: string;
  label: string;
  description: string | null;
}

export interface CostCenter {
  id: number;
  code: string;
  name: string;
  company_id: number | null;
  target_cost_center_id?: number | null;
}

export interface Event {
  id: number;
  code: string;
  description: string;
  entry_type: string; // 'P' | 'D' | 'PROV'
  is_active: boolean;
}

export interface EventMapping {
  id: number;
  event_id: number;
  cost_center_id: number | null;
  credit_account: string | null;
  debit_account: string | null;
}

export interface EventWithMappings {
  event: Event;
  mappings: EventMapping[];
}

/** Event with all its mappings embedded — returned by GET /events/with-all-mappings */
export interface EventFlat extends Event {
  mappings: EventMapping[];
}
