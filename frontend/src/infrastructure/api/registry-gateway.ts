import type {
  Company,
  CostCenter,
  Event,
  EventFlat,
  EventMapping,
  EventWithMappings,
  Tag,
} from "@/domain/registry/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Erro HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Companies ────────────────────────────────────────────────────────────────

export const fetchCompanies = () => req<Company[]>("/api/v1/companies/");

export const createCompany = (data: Omit<Company, "id">) =>
  req<Company>("/api/v1/companies/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateCompany = (
  id: number,
  data: Partial<
    Pick<
      Company,
      "name" | "cnpj" | "cnpj_base" | "output_template" | "fpa_batch" | "tag"
    >
  >,
) =>
  req<Company>(`/api/v1/companies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteCompany = (id: number) =>
  req<void>(`/api/v1/companies/${id}`, { method: "DELETE" });

// ── Tags ───────────────────────────────────────────────────────────────────────────────

export const fetchTags = () => req<Tag[]>("/api/v1/tags/");

export const createTag = (data: Omit<Tag, "id">) =>
  req<Tag>("/api/v1/tags/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateTag = (
  id: number,
  data: Partial<Pick<Tag, "label" | "description">>,
) =>
  req<Tag>(`/api/v1/tags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteTag = (id: number) =>
  req<void>(`/api/v1/tags/${id}`, { method: "DELETE" });

export const fetchCostCenters = () =>
  req<CostCenter[]>("/api/v1/cost-centers/");

export const createCostCenter = (data: Omit<CostCenter, "id">) =>
  req<CostCenter>("/api/v1/cost-centers/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateCostCenter = (
  id: number,
  data: Partial<
    Pick<CostCenter, "name" | "company_id" | "target_cost_center_id">
  >,
) =>
  req<CostCenter>(`/api/v1/cost-centers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteCostCenter = (id: number) =>
  req<void>(`/api/v1/cost-centers/${id}`, { method: "DELETE" });

// ── Events ───────────────────────────────────────────────────────────────────

export const fetchEvents = (includeInactive = true) =>
  req<Event[]>(`/api/v1/events/?include_inactive=${includeInactive}`);

export const fetchEventWithMappings = (id: number) =>
  req<EventWithMappings>(`/api/v1/events/${id}`);

export const createEvent = (
  data: Pick<Event, "code" | "description" | "entry_type">,
) =>
  req<Event>("/api/v1/events/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateEvent = (
  id: number,
  data: Partial<Pick<Event, "description" | "entry_type" | "is_active">>,
) =>
  req<Event>(`/api/v1/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteEvent = (id: number) =>
  req<void>(`/api/v1/events/${id}`, { method: "DELETE" });

/**
 * Idempotent: finds or creates an event by code.
 * Used when an event appears in a payroll file but is not yet in the registry.
 */
export const ensureEvent = (data: {
  code: string;
  description: string;
  entry_type: string;
}) =>
  req<Event>("/api/v1/events/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

/** Bulk-load all events with all their mappings for the company-grouped tree view. */
export const fetchAllEventsWithMappings = (includeInactive = true) =>
  req<EventFlat[]>(
    `/api/v1/events/with-all-mappings?include_inactive=${includeInactive}`,
  );

// ── Event Mappings ────────────────────────────────────────────────────────────

export const upsertMapping = (
  eventId: number,
  data: {
    cost_center_id?: number | null;
    credit_account?: string | null;
    debit_account?: string | null;
  },
) =>
  req<EventMapping>(`/api/v1/events/${eventId}/mappings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateMapping = (
  id: number,
  data: { credit_account?: string | null; debit_account?: string | null },
) =>
  req<EventMapping>(`/api/v1/events/mappings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteMapping = (id: number) =>
  req<void>(`/api/v1/events/mappings/${id}`, { method: "DELETE" });

// ── Exports ───────────────────────────────────────────────────────────────────

export const exportFpa = async (body: unknown): Promise<Blob> => {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const res = await fetch(`${BASE}/api/v1/exports/fpa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Erro HTTP ${res.status}`);
  }
  return res.blob();
};
