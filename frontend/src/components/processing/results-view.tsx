"use client";

import { useEffect, useMemo, useState } from "react";
import type { PayrollMirrorResult } from "@/domain/payroll/types";
import type {
  ProvisionsResult,
  ProvisionResultItem,
  ProvisionEntry,
} from "@/domain/provisions/types";
import {
  fetchAllEventsWithMappings,
  fetchCostCenters,
  upsertMapping,
  updateEvent,
  ensureEvent,
} from "@/infrastructure/api/registry-gateway";
import type { CostCenter, EventFlat } from "@/domain/registry/types";
import styles from "./results-view.module.css";
import type { PayrollBlock, EventItem } from "@/domain/payroll/types";

export type ParseResult =
  | { kind: "mirror"; data: PayrollMirrorResult }
  | { kind: "provision"; data: ProvisionsResult };

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompetence(comp: string): string {
  const [year, month] = comp.split("-");
  return `${month}/${year}`;
}

const PROVISION_LABELS: Record<string, string> = {
  "13th_salary": "13º Salário",
  vacation: "Férias",
};

// ─── Shared map-form state ────────────────────────────────────────────────────

interface MapFormState {
  eventCode: string;
  eventDescription: string;
  entryType: string; // 'P' | 'D' | 'SUM' | 'GPS' | 'PROV'
  sectionType: "event" | "summary";
  debit: string;
  credit: string;
  costCenterId: string;
  contextLabel: string; // e.g. "ADM — Super Safra Comercial"
  saving: boolean;
  error: string | null;
}

// ─── Summary / GPS inline sections ───────────────────────────────────────────

function SummarySection({ summary }: { summary: Record<string, number> }) {
  const entries = Object.entries(summary);
  if (entries.length === 0) return null;
  return (
    <div className={styles.summarySection}>
      <p className={styles.summaryTitle}>Resumo Geral</p>
      <div className={styles.summaryGrid}>
        {entries.map(([key, val]) => (
          <div key={key} className={styles.summaryItem}>
            <span className={styles.summaryKey}>{key}</span>
            <span className={styles.summaryValue}>{fmt(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GpsSection({ gps }: { gps: Record<string, string | number> }) {
  const entries = Object.entries(gps);
  if (entries.length === 0) return null;
  return (
    <div className={styles.summarySection}>
      <p className={styles.summaryTitle}>Analítico GPS</p>
      <div className={styles.summaryGrid}>
        {entries.map(([key, val]) => (
          <div key={key} className={styles.summaryItem}>
            <span className={styles.summaryKey}>{key}</span>
            <span className={styles.summaryValue}>
              {typeof val === "number" ? fmt(val) : val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared map form UI ───────────────────────────────────────────────────────

interface MapFormProps {
  form: MapFormState;
  costCenters: CostCenter[] | null;
  onChange: (patch: Partial<MapFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
}

function MapFormBox({
  form,
  costCenters,
  onChange,
  onCancel,
  onSave,
}: MapFormProps) {
  return (
    <div className={styles.mapModalOverlay} onClick={onCancel}>
      <div
        className={styles.mapModalPanel}
        onClick={(e) => e.stopPropagation()}
      >
        {form.contextLabel && (
          <p className={styles.mapContextLabel}>{form.contextLabel}</p>
        )}
        <p className={styles.mapFormTitle}>
          Mapear: <strong>{form.eventCode}</strong>
        </p>
        <div className={styles.mapFormRow}>
          <div className={styles.mapFormField}>
            <label>Conta Débito</label>
            <input
              className={styles.mapInput}
              value={form.debit}
              onChange={(e) => onChange({ debit: e.target.value })}
              placeholder="1.2.3.4.5"
            />
          </div>
          <div className={styles.mapFormField}>
            <label>Conta Crédito</label>
            <input
              className={styles.mapInput}
              value={form.credit}
              onChange={(e) => onChange({ credit: e.target.value })}
              placeholder="2.1.3.4.5"
            />
          </div>
        </div>
        {costCenters && (
          <div className={styles.mapFormField}>
            <label>Centro de Custo (mapeamento)</label>
            <select
              className={styles.mapSelect}
              value={form.costCenterId}
              onChange={(e) => onChange({ costCenterId: e.target.value })}
            >
              <option value="">Padrão (todos CCs)</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={String(cc.id)}>
                  {cc.code} — {cc.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.error && <p className={styles.mapError}>{form.error}</p>}
        <div className={styles.mapFormActions}>
          <button
            className={styles.mapBtnCancel}
            onClick={onCancel}
            disabled={form.saving}
          >
            Cancelar
          </button>
          <button
            className={styles.mapBtnSave}
            onClick={onSave}
            disabled={form.saving}
          >
            {form.saving ? "Salvando..." : "Salvar mapeamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CC Entries Modal ─────────────────────────────────────────────────────────

interface CcModalProps {
  block: PayrollBlock;
  onClose: () => void;
}

function CcEntriesModal({ block, onClose }: CcModalProps) {
  // Local copies so map/ignore updates immediately without reload
  const [localEntries, setLocalEntries] = useState<EventItem[]>(() =>
    block.events.map((e) => ({ ...e })),
  );
  const [ignoredCodes, setIgnoredCodes] = useState<Set<string>>(new Set());

  // Summary / GPS mapping state
  const [summaryMapped, setSummaryMapped] = useState<
    Map<string, { debit: string; credit: string }>
  >(new Map());
  const [summaryIgnored, setSummaryIgnored] = useState<Set<string>>(new Set());

  // EventFlat[] used for button availability + pre-populating state from DB
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenter[] | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const [mapForm, setMapForm] = useState<MapFormState | null>(null);

  // Summary entries derived from block.summary and block.gps
  const summaryEntries = useMemo(() => {
    type SEntry = {
      code: string;
      description: string;
      valueStr: string;
      entryType: "SUM" | "GPS";
      section: "RESUMO" | "GPS";
    };
    const entries: SEntry[] = [];
    for (const [key, val] of Object.entries(block.summary ?? {})) {
      entries.push({
        code: key,
        description: key,
        valueStr: fmt(val as number),
        entryType: "SUM",
        section: "RESUMO",
      });
    }
    for (const [key, val] of Object.entries(block.gps ?? {})) {
      entries.push({
        code: key,
        description: key,
        valueStr: typeof val === "number" ? fmt(val) : String(val),
        entryType: "GPS",
        section: "GPS",
      });
    }
    return entries;
  }, [block.summary, block.gps]);

  async function loadRegistry() {
    setLoadingRegistry(true);
    setRegistryError(null);
    try {
      const [evFlats, ccs] = await Promise.all([
        fetchAllEventsWithMappings(true),
        fetchCostCenters(),
      ]);

      const eventByCode = new Map(evFlats.map((e) => [e.code, e]));
      const ccForBlock = ccs.find((cc) => cc.code === block.cost_center_code);

      // Pre-populate ignoredCodes from events that are inactive in DB
      const newIgnored = new Set<string>();
      for (const entry of block.events) {
        const ev = eventByCode.get(entry.event_code);
        if (ev && !ev.is_active) newIgnored.add(entry.event_code);
      }
      setIgnoredCodes(newIgnored);

      // Update localEntries with current DB mapping status
      setLocalEntries(
        block.events.map((entry) => {
          const ev = eventByCode.get(entry.event_code);
          if (!ev) return { ...entry };
          const ccId = ccForBlock?.id;
          const best =
            (ccId
              ? ev.mappings.find((m) => m.cost_center_id === ccId)
              : undefined) ??
            ev.mappings.find((m) => m.cost_center_id === null);
          if (best) {
            return {
              ...entry,
              mapping: {
                is_mapped: !!(best.debit_account && best.credit_account),
                debit_account: best.debit_account,
                credit_account: best.credit_account,
              },
            };
          }
          return { ...entry };
        }),
      );

      // Pre-populate summary/GPS mapping state
      const newSummaryIgnored = new Set<string>();
      const newSummaryMapped = new Map<
        string,
        { debit: string; credit: string }
      >();
      for (const entry of summaryEntries) {
        const ev = eventByCode.get(entry.code);
        if (!ev) continue;
        if (!ev.is_active) {
          newSummaryIgnored.add(entry.code);
          continue;
        }
        const ccId = ccForBlock?.id;
        const best =
          (ccId
            ? ev.mappings.find((m) => m.cost_center_id === ccId)
            : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
        if (best && (best.debit_account || best.credit_account)) {
          newSummaryMapped.set(entry.code, {
            debit: best.debit_account ?? "",
            credit: best.credit_account ?? "",
          });
        }
      }
      setSummaryIgnored(newSummaryIgnored);
      setSummaryMapped(newSummaryMapped);

      setCostCenters(ccs);
      setEventsLoaded(true);
    } catch (e) {
      setRegistryError((e as Error).message);
    } finally {
      setLoadingRegistry(false);
    }
  }

  if (!eventsLoaded && !loadingRegistry && !registryError) {
    void loadRegistry();
  }

  const ccMap = new Map((costCenters ?? []).map((cc) => [cc.code, cc]));

  function handleStartMap(entry: EventItem) {
    const cc = block.cost_center_code
      ? ccMap.get(block.cost_center_code)
      : undefined;
    const ctx = [
      block.cost_center_code,
      block.cost_center_name,
      block.company_name,
    ]
      .filter(Boolean)
      .join(" — ");
    setMapForm({
      eventCode: entry.event_code,
      eventDescription: entry.description,
      entryType: entry.entry_type === "PROVENTO" ? "P" : "D",
      sectionType: "event",
      debit: entry.mapping?.debit_account ?? "",
      credit: entry.mapping?.credit_account ?? "",
      costCenterId: cc ? String(cc.id) : "",
      contextLabel: ctx,
      saving: false,
      error: null,
    });
  }

  async function handleSaveMap() {
    if (!mapForm) return;
    setMapForm((f) => f && { ...f, saving: true, error: null });
    try {
      // SUM / GPS are not valid backend types — normalize to 'P'
      const normalizedType = ["SUM", "GPS"].includes(mapForm.entryType)
        ? "P"
        : mapForm.entryType;
      const ev = await ensureEvent({
        code: mapForm.eventCode,
        description: mapForm.eventDescription,
        entry_type: normalizedType,
      });
      await upsertMapping(ev.id, {
        cost_center_id: mapForm.costCenterId
          ? Number(mapForm.costCenterId)
          : null,
        debit_account: mapForm.debit || null,
        credit_account: mapForm.credit || null,
      });
      if (mapForm.sectionType === "summary") {
        setSummaryMapped(
          (prev) =>
            new Map([
              ...prev,
              [
                mapForm.eventCode,
                { debit: mapForm.debit, credit: mapForm.credit },
              ],
            ]),
        );
      } else {
        setLocalEntries((prev) =>
          prev.map((e) =>
            e.event_code === mapForm.eventCode
              ? {
                  ...e,
                  mapping: {
                    is_mapped: true,
                    debit_account: mapForm.debit || null,
                    credit_account: mapForm.credit || null,
                  },
                }
              : e,
          ),
        );
      }
      setMapForm(null);
    } catch (e) {
      setMapForm(
        (f) => f && { ...f, saving: false, error: (e as Error).message },
      );
    }
  }

  function handleStartMapSummary(entry: {
    code: string;
    description: string;
    entryType: "SUM" | "GPS";
  }) {
    const cc = block.cost_center_code
      ? ccMap.get(block.cost_center_code)
      : undefined;
    const existing = summaryMapped.get(entry.code);
    const ctx = [
      block.cost_center_code,
      block.cost_center_name,
      block.company_name,
    ]
      .filter(Boolean)
      .join(" — ");
    setMapForm({
      eventCode: entry.code,
      eventDescription: entry.description,
      entryType: entry.entryType,
      sectionType: "summary",
      debit: existing?.debit ?? "",
      credit: existing?.credit ?? "",
      costCenterId: cc ? String(cc.id) : "",
      contextLabel: ctx,
      saving: false,
      error: null,
    });
  }

  async function handleIgnoreSummary(entry: {
    code: string;
    description: string;
    entryType: "SUM" | "GPS";
  }) {
    if (!confirm(`Ignorar "${entry.description}"? Ficará inativo.`)) return;
    try {
      const ev = await ensureEvent({
        code: entry.code,
        description: entry.description,
        entry_type: "P", // SUM/GPS not valid DB types — normalize to P
      });
      await updateEvent(ev.id, { is_active: false });
      setSummaryIgnored((prev) => new Set([...prev, entry.code]));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleIgnore(entry: EventItem) {
    if (
      !confirm(
        `Ignorar o evento "${entry.description}" (${entry.event_code})? Ele ficará inativo.`,
      )
    )
      return;
    try {
      const entryType = entry.entry_type === "PROVENTO" ? "P" : "D";
      const ev = await ensureEvent({
        code: entry.event_code,
        description: entry.description,
        entry_type: entryType,
      });
      await updateEvent(ev.id, { is_active: false });
      setIgnoredCodes((prev) => new Set([...prev, entry.event_code]));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const proventos = localEntries.filter((e) => e.entry_type === "PROVENTO");
  const descontos = localEntries.filter((e) => e.entry_type === "DESCONTO");
  const totalProv = proventos.reduce((s, e) => s + e.amount, 0);
  const totalDesc = descontos.reduce((s, e) => s + e.amount, 0);
  const eventUnmapped = localEntries.filter(
    (e) => !e.mapping?.is_mapped && !ignoredCodes.has(e.event_code),
  ).length;
  const summaryUnmapped = summaryEntries.filter(
    (e) => !summaryMapped.has(e.code) && !summaryIgnored.has(e.code),
  ).length;
  const unmappedCount = eventUnmapped + summaryUnmapped;

  const hasSummary = summaryEntries.some((e) => e.section === "RESUMO");
  const hasGps = summaryEntries.some((e) => e.section === "GPS");

  function renderSummaryRows(entries: typeof summaryEntries) {
    return entries.map((entry, i) => {
      const isMapped = summaryMapped.has(entry.code);
      const isIgnored = summaryIgnored.has(entry.code);
      return (
        <tr key={i} data-unmapped={!isMapped && !isIgnored}>
          <td>
            <code className={styles.entryCode}>{entry.code}</code>
          </td>
          <td className={styles.right}>{entry.valueStr}</td>
          <td>
            {isMapped ? (
              <span className={styles.mappedBadge}>✓ Mapeado</span>
            ) : isIgnored ? (
              <span className={styles.ignoredBadge}>○ Ignorado</span>
            ) : (
              <span className={styles.unmappedBadge}>Não mapeado</span>
            )}
          </td>
          <td className={styles.entryActions}>
            {!isMapped && !isIgnored && eventsLoaded && (
              <>
                <button
                  className={styles.mapBtn}
                  onClick={() => handleStartMapSummary(entry)}
                  disabled={!!mapForm}
                >
                  Mapear
                </button>
                <button
                  className={styles.ignoreBtn}
                  onClick={() => handleIgnoreSummary(entry)}
                  disabled={!!mapForm}
                >
                  Ignorar
                </button>
              </>
            )}
          </td>
        </tr>
      );
    });
  }

  function renderEventRows(entries: EventItem[]) {
    return entries.map((entry, i) => {
      const isMapped = entry.mapping?.is_mapped ?? false;
      const isIgnored = ignoredCodes.has(entry.event_code);
      return (
        <tr key={i} data-unmapped={!isMapped && !isIgnored}>
          <td>
            <code className={styles.entryCode}>{entry.event_code}</code>
          </td>
          <td className={styles.muted}>{entry.description}</td>
          <td
            className={`${styles.right} ${
              entry.entry_type === "PROVENTO"
                ? styles.positive
                : styles.negative
            }`}
          >
            {fmt(entry.amount)}
          </td>
          <td>
            {isMapped ? (
              <span className={styles.mappedBadge}>✓ Mapeado</span>
            ) : isIgnored ? (
              <span className={styles.ignoredBadge}>○ Ignorado</span>
            ) : (
              <span className={styles.unmappedBadge}>Não mapeado</span>
            )}
          </td>
          <td className={styles.entryActions}>
            {!isMapped && !isIgnored && eventsLoaded && (
              <>
                <button
                  className={styles.mapBtn}
                  onClick={() => handleStartMap(entry)}
                  disabled={!!mapForm}
                >
                  Mapear
                </button>
                <button
                  className={styles.ignoreBtn}
                  onClick={() => handleIgnore(entry)}
                  disabled={!!mapForm}
                >
                  Ignorar
                </button>
              </>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalPanel}
        style={{ maxWidth: 940, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <p className={styles.modalCompany}>
              <span className={styles.code}>{block.company_code}</span>{" "}
              {block.company_name}
            </p>
            <h3 className={styles.modalTitle}>
              <span className={styles.code}>{block.cost_center_code}</span>{" "}
              {block.cost_center_name}
            </h3>
            <p className={styles.modalSub}>
              {localEntries.length} entradas • {unmappedCount} não mapeadas
            </p>
          </div>
          <button
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {registryError && (
          <div className={styles.modalError}>{registryError}</div>
        )}
        {loadingRegistry && (
          <p className={styles.modalLoading}>Carregando cadastros...</p>
        )}

        {mapForm && (
          <MapFormBox
            form={mapForm}
            costCenters={costCenters}
            onChange={(patch) => setMapForm((f) => f && { ...f, ...patch })}
            onCancel={() => setMapForm(null)}
            onSave={handleSaveMap}
          />
        )}

        {/* ── Two-column event tables: Proventos | Descontos ── */}
        <div className={styles.eventColumns}>
          <div className={styles.eventColumn}>
            <div className={styles.columnTitle}>
              <span>Proventos</span>
              <span className={styles.columnTotal}>{fmt(totalProv)}</span>
            </div>
            <table className={styles.entriesTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className={styles.right}>Valor</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{renderEventRows(proventos)}</tbody>
            </table>
          </div>

          <div className={styles.eventColumn}>
            <div className={styles.columnTitle}>
              <span>Descontos</span>
              <span className={styles.columnTotal}>{fmt(totalDesc)}</span>
            </div>
            <table className={styles.entriesTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className={styles.right}>Valor</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{renderEventRows(descontos)}</tbody>
            </table>
          </div>
        </div>

        {/* ── Summary | GPS side-by-side ── */}
        {(hasSummary || hasGps) && (
          <div className={styles.summaryRow}>
            {hasSummary && (
              <div>
                <div className={styles.columnTitle}>
                  <span>Resumo Geral</span>
                  <span className={styles.columnTotal}>
                    {
                      summaryEntries.filter((e) => e.section === "RESUMO")
                        .length
                    }{" "}
                    itens
                  </span>
                </div>
                <table className={styles.entriesTable}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th className={styles.right}>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderSummaryRows(
                      summaryEntries.filter((e) => e.section === "RESUMO"),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {hasGps && (
              <div>
                <div className={styles.columnTitle}>
                  <span>Analítico GPS</span>
                  <span className={styles.columnTotal}>
                    {summaryEntries.filter((e) => e.section === "GPS").length}{" "}
                    itens
                  </span>
                </div>
                <table className={styles.entriesTable}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th className={styles.right}>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderSummaryRows(
                      summaryEntries.filter((e) => e.section === "GPS"),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Provision Item Modal ─────────────────────────────────────────────────────

interface ProvisionModalProps {
  item: ProvisionResultItem;
  onClose: () => void;
}

function ProvisionItemModal({ item, onClose }: ProvisionModalProps) {
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenter[] | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Pre-populated from DB; updated on user action
  const [mappedCodes, setMappedCodes] = useState<
    Map<string, { debit: string; credit: string }>
  >(new Map());
  const [ignoredCodes, setIgnoredCodes] = useState<Set<string>>(new Set());

  const [mapForm, setMapForm] = useState<MapFormState | null>(null);

  async function loadRegistry() {
    setLoadingRegistry(true);
    setRegistryError(null);
    try {
      const [evFlats, ccs] = await Promise.all([
        fetchAllEventsWithMappings(true),
        fetchCostCenters(),
      ]);

      const eventByCode = new Map(evFlats.map((e) => [e.code, e]));
      const ccForItem = ccs.find((cc) => cc.code === item.cost_center_code);

      const newIgnored = new Set<string>();
      const newMapped = new Map<string, { debit: string; credit: string }>();

      for (const entry of item.entries) {
        const ev = eventByCode.get(entry.entry_code);
        if (!ev) continue;
        if (!ev.is_active) {
          newIgnored.add(entry.entry_code);
          continue;
        }
        const ccId = ccForItem?.id;
        const best =
          (ccId
            ? ev.mappings.find((m) => m.cost_center_id === ccId)
            : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
        if (best && (best.debit_account || best.credit_account)) {
          newMapped.set(entry.entry_code, {
            debit: best.debit_account ?? "",
            credit: best.credit_account ?? "",
          });
        }
      }

      setIgnoredCodes(newIgnored);
      setMappedCodes(newMapped);
      setCostCenters(ccs);
      setEventsLoaded(true);
    } catch (e) {
      setRegistryError((e as Error).message);
    } finally {
      setLoadingRegistry(false);
    }
  }

  if (!eventsLoaded && !loadingRegistry && !registryError) {
    void loadRegistry();
  }

  const ccMap = new Map((costCenters ?? []).map((cc) => [cc.code, cc]));

  function handleStartMap(entry: ProvisionEntry) {
    const cc = item.cost_center_code
      ? ccMap.get(item.cost_center_code)
      : undefined;
    const existing = mappedCodes.get(entry.entry_code);
    const ctx = [
      item.cost_center_code,
      item.cost_center_name,
      item.company_name,
    ]
      .filter(Boolean)
      .join(" — ");
    setMapForm({
      eventCode: entry.entry_code,
      eventDescription: entry.entry_description,
      entryType: "PROV",
      sectionType: "event",
      debit: existing?.debit ?? "",
      credit: existing?.credit ?? "",
      costCenterId: cc ? String(cc.id) : "",
      contextLabel: ctx,
      saving: false,
      error: null,
    });
  }

  async function handleSaveMap() {
    if (!mapForm) return;
    setMapForm((f) => f && { ...f, saving: true, error: null });
    try {
      const ev = await ensureEvent({
        code: mapForm.eventCode,
        description: mapForm.eventDescription,
        entry_type: mapForm.entryType,
      });
      await upsertMapping(ev.id, {
        cost_center_id: mapForm.costCenterId
          ? Number(mapForm.costCenterId)
          : null,
        debit_account: mapForm.debit || null,
        credit_account: mapForm.credit || null,
      });
      setMappedCodes(
        (prev) =>
          new Map([
            ...prev,
            [
              mapForm.eventCode,
              { debit: mapForm.debit, credit: mapForm.credit },
            ],
          ]),
      );
      setIgnoredCodes((prev) => {
        const next = new Set(prev);
        next.delete(mapForm.eventCode);
        return next;
      });
      setMapForm(null);
    } catch (e) {
      setMapForm(
        (f) => f && { ...f, saving: false, error: (e as Error).message },
      );
    }
  }

  async function handleIgnore(entry: ProvisionEntry) {
    if (
      !confirm(
        `Ignorar a entrada "${entry.entry_description}" (${entry.entry_code})? Ela ficará inativa.`,
      )
    )
      return;
    try {
      const ev = await ensureEvent({
        code: entry.entry_code,
        description: entry.entry_description,
        entry_type: "PROV",
      });
      await updateEvent(ev.id, { is_active: false });
      setIgnoredCodes((prev) => new Set([...prev, entry.entry_code]));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const unmappedCount = item.entries.filter(
    (e) => !mappedCodes.has(e.entry_code) && !ignoredCodes.has(e.entry_code),
  ).length;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalPanel}
        style={{ maxWidth: 820, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <p className={styles.modalCompany}>
              <span className={styles.code}>{item.company_code}</span>{" "}
              {item.company_name}
            </p>
            <h3 className={styles.modalTitle}>
              <span className={styles.code}>{item.cost_center_code}</span>{" "}
              {item.cost_center_name}
            </h3>
            <p className={styles.modalSub}>
              {item.entries.length} entradas • {unmappedCount} não mapeadas
            </p>
          </div>
          <button
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {registryError && (
          <div className={styles.modalError}>{registryError}</div>
        )}
        {loadingRegistry && (
          <p className={styles.modalLoading}>Carregando cadastros...</p>
        )}

        {mapForm && (
          <MapFormBox
            form={mapForm}
            costCenters={costCenters}
            onChange={(patch) => setMapForm((f) => f && { ...f, ...patch })}
            onCancel={() => setMapForm(null)}
            onSave={handleSaveMap}
          />
        )}

        <table className={styles.entriesTable}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th className={styles.right}>Anterior</th>
              <th className={styles.right}>Atual</th>
              <th className={styles.right}>Diferença</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {item.entries.map((entry, i) => {
              const isMapped = mappedCodes.has(entry.entry_code);
              const isIgnored = ignoredCodes.has(entry.entry_code);
              return (
                <tr key={i} data-unmapped={!isMapped && !isIgnored}>
                  <td>
                    <code className={styles.entryCode}>{entry.entry_code}</code>
                  </td>
                  <td className={styles.muted}>{entry.entry_description}</td>
                  <td className={styles.right}>{fmt(entry.amount_previous)}</td>
                  <td className={styles.right}>{fmt(entry.amount_current)}</td>
                  <td
                    className={`${styles.right} ${
                      entry.amount_difference > 0
                        ? styles.positive
                        : entry.amount_difference < 0
                          ? styles.negative
                          : styles.neutral
                    }`}
                  >
                    {entry.amount_difference > 0 ? "+" : ""}
                    {fmt(entry.amount_difference)}
                  </td>
                  <td>
                    {isMapped ? (
                      <span className={styles.mappedBadge}>✓ Mapeado</span>
                    ) : isIgnored ? (
                      <span className={styles.ignoredBadge}>○ Ignorado</span>
                    ) : (
                      <span className={styles.unmappedBadge}>Não mapeado</span>
                    )}
                  </td>
                  <td className={styles.entryActions}>
                    {!isMapped && !isIgnored && eventsLoaded && (
                      <>
                        <button
                          className={styles.mapBtn}
                          onClick={() => handleStartMap(entry)}
                          disabled={!!mapForm}
                        >
                          Mapear
                        </button>
                        <button
                          className={styles.ignoreBtn}
                          onClick={() => handleIgnore(entry)}
                          disabled={!!mapForm}
                        >
                          Ignorar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PayrollMirrorView ────────────────────────────────────────────────────────

/**
 * Derives per-block status counts from live DB state,
 * including summary (Resumo Geral) and GPS entries.
 */
function deriveBlockStatus(
  block: PayrollBlock,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
): { mapped: number; unmapped: number; ignored: number } {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  const ccForBlock = costCenters.find(
    (cc) => cc.code === block.cost_center_code,
  );
  let mapped = 0,
    unmapped = 0,
    ignored = 0;

  function checkCode(code: string) {
    const ev = eventByCode.get(code);
    if (!ev) {
      unmapped++;
      return;
    }
    if (!ev.is_active) {
      ignored++;
      return;
    }
    const ccId = ccForBlock?.id;
    const best =
      (ccId ? ev.mappings.find((m) => m.cost_center_id === ccId) : undefined) ??
      ev.mappings.find((m) => m.cost_center_id === null);
    if (best && (best.debit_account || best.credit_account)) mapped++;
    else unmapped++;
  }

  for (const entry of block.events) checkCode(entry.event_code);
  for (const key of Object.keys(block.summary ?? {})) checkCode(key);
  for (const key of Object.keys(block.gps ?? {})) checkCode(key);

  return { mapped, unmapped, ignored };
}

function PayrollMirrorView({ data }: { data: PayrollMirrorResult }) {
  const [selectedBlock, setSelectedBlock] = useState<PayrollBlock | null>(null);
  const [eventsFlat, setEventsFlat] = useState<EventFlat[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [statusKey, setStatusKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllEventsWithMappings(true), fetchCostCenters()])
      .then(([evs, ccs]) => {
        if (!cancelled) {
          setEventsFlat(evs);
          setCostCenters(ccs);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [statusKey]);

  function handleModalClose() {
    setSelectedBlock(null);
    setStatusKey((k) => k + 1);
  }

  const costCenterBlocks = data.blocks.filter((b) => !b.is_totalizer);
  const competence = data.blocks[0]?.competence
    ? formatCompetence(data.blocks[0].competence)
    : "—";

  return (
    <div>
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Arquivo</span>
          <span className={styles.metaValue}>{data.source_file}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Competência</span>
          <span className={styles.metaValue}>{competence}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Total de blocos</span>
          <span className={styles.metaValue}>{data.total_blocks}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Centros de custo</span>
          <span className={styles.metaValue}>{costCenterBlocks.length}</span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Centro de custo</th>
              <th>Competência</th>
              <th className={styles.right}>Proventos</th>
              <th className={styles.right}>Descontos</th>
              <th className={styles.right}>Mapeado</th>
              <th className={styles.right}>Não mapeado</th>
              <th className={styles.right}>Ignorado</th>
            </tr>
          </thead>
          <tbody>
            {costCenterBlocks.map((block, i) => {
              const proventos = block.events.filter(
                (e) => e.entry_type === "PROVENTO",
              );
              const descontos = block.events.filter(
                (e) => e.entry_type === "DESCONTO",
              );
              const totalProv = proventos.reduce((sum, e) => sum + e.amount, 0);
              const totalDesc = descontos.reduce((sum, e) => sum + e.amount, 0);
              const status =
                eventsFlat.length > 0
                  ? deriveBlockStatus(block, eventsFlat, costCenters)
                  : null;
              const rowClass = status
                ? status.unmapped === 0
                  ? styles.rowAllMapped
                  : styles.rowHasUnmapped
                : "";
              return (
                <tr
                  key={i}
                  className={`${styles.clickableRow} ${rowClass}`}
                  onClick={() => setSelectedBlock(block)}
                  title="Clique para ver os lançamentos deste CC"
                >
                  <td>
                    <span className={styles.cellFlex}>
                      <span
                        className={`${styles.statusDot} ${
                          block.company_is_mapped
                            ? styles.dotMapped
                            : styles.dotUnmapped
                        }`}
                      />
                      <span className={styles.code}>{block.company_code}</span>{" "}
                      {block.company_name}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellFlex}>
                      <span
                        className={`${styles.statusDot} ${
                          block.cost_center_is_mapped
                            ? styles.dotMapped
                            : styles.dotUnmapped
                        }`}
                      />
                      <span className={styles.code}>
                        {block.cost_center_code}
                      </span>{" "}
                      {block.cost_center_name}
                    </span>
                  </td>
                  <td>{formatCompetence(block.competence)}</td>
                  <td className={`${styles.right} ${styles.positive}`}>
                    {fmt(totalProv)}
                  </td>
                  <td className={`${styles.right} ${styles.negative}`}>
                    {fmt(totalDesc)}
                  </td>
                  <td className={`${styles.right} ${styles.ratioFull}`}>
                    {status?.mapped ?? "—"}
                  </td>
                  <td
                    className={`${styles.right} ${
                      status !== null && status.unmapped > 0
                        ? styles.ratioNone
                        : styles.ratioFull
                    }`}
                  >
                    {status?.unmapped ?? "—"}
                  </td>
                  <td className={styles.right}>{status?.ignored ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedBlock && (
        <CcEntriesModal block={selectedBlock} onClose={handleModalClose} />
      )}
    </div>
  );
}

// ─── ProvisionsView ───────────────────────────────────────────────────────────

/**
 * Derives per-item status counts from the live DB state.
 * Called once per render; light cost because eventsFlat is cached in parent.
 */
function deriveProvisionStatus(
  item: ProvisionResultItem,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
): { mapped: number; unmapped: number; ignored: number } {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  const ccForItem = costCenters.find((cc) => cc.code === item.cost_center_code);
  let mapped = 0;
  let unmapped = 0;
  let ignored = 0;
  for (const entry of item.entries) {
    const ev = eventByCode.get(entry.entry_code);
    if (!ev) {
      unmapped++;
      continue;
    }
    if (!ev.is_active) {
      ignored++;
      continue;
    }
    const ccId = ccForItem?.id;
    const best =
      (ccId ? ev.mappings.find((m) => m.cost_center_id === ccId) : undefined) ??
      ev.mappings.find((m) => m.cost_center_id === null);
    if (best && (best.debit_account || best.credit_account)) mapped++;
    else unmapped++;
  }
  return { mapped, unmapped, ignored };
}

function ProvisionsView({ data }: { data: ProvisionsResult }) {
  const [selectedItem, setSelectedItem] = useState<ProvisionResultItem | null>(
    null,
  );

  // Load events+CCs once for status derivation
  const [eventsFlat, setEventsFlat] = useState<EventFlat[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [statusKey, setStatusKey] = useState(0); // bump to refresh statuses

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllEventsWithMappings(true), fetchCostCenters()])
      .then(([evs, ccs]) => {
        if (!cancelled) {
          setEventsFlat(evs);
          setCostCenters(ccs);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [statusKey]);

  // Refresh statuses when modal closes after edits
  function handleModalClose() {
    setSelectedItem(null);
    setStatusKey((k) => k + 1);
  }

  const label = PROVISION_LABELS[data.provision_type] ?? data.provision_type;
  const firstItem = data.items[0];
  const competences = firstItem
    ? `${formatCompetence(firstItem.competence_previous)} → ${formatCompetence(firstItem.competence_current)}`
    : "—";

  return (
    <div>
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Tipo</span>
          <span className={styles.metaValue}>{label}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Competências</span>
          <span className={styles.metaValue}>{competences}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Centros de custo</span>
          <span className={styles.metaValue}>{data.total_cost_centers}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Arquivos</span>
          <span className={styles.metaValue}>
            {data.source_files.join(", ")}
          </span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Centro de custo</th>
              <th className={styles.right}>Total anterior</th>
              <th className={styles.right}>Total atual</th>
              <th className={styles.right}>Diferença</th>
              <th className={styles.right}>Mapeado</th>
              <th className={styles.right}>Não mapeado</th>
              <th className={styles.right}>Ignorado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => {
              const totalPrev = item.entries.reduce(
                (s, e) => s + e.amount_previous,
                0,
              );
              const totalCurrent = item.entries.reduce(
                (s, e) => s + e.amount_current,
                0,
              );
              const totalDiff = totalCurrent - totalPrev;
              const status =
                eventsFlat.length > 0
                  ? deriveProvisionStatus(item, eventsFlat, costCenters)
                  : null;
              const allClear =
                status !== null &&
                status.unmapped === 0 &&
                item.entries.length > 0;
              const rowClass = status
                ? status.unmapped === 0
                  ? styles.rowAllMapped
                  : styles.rowHasUnmapped
                : "";
              return (
                <tr
                  key={i}
                  className={`${styles.clickableRow} ${rowClass}`}
                  onClick={() => setSelectedItem(item)}
                  title="Clique para ver e mapear as entradas"
                >
                  <td>
                    <span className={styles.code}>{item.company_code}</span>{" "}
                    {item.company_name}
                  </td>
                  <td>
                    <span className={styles.code}>{item.cost_center_code}</span>{" "}
                    {item.cost_center_name}
                  </td>
                  <td className={styles.right}>{fmt(totalPrev)}</td>
                  <td className={`${styles.right} ${styles.positive}`}>
                    {fmt(totalCurrent)}
                  </td>
                  <td
                    className={`${styles.right} ${
                      totalDiff > 0
                        ? styles.positive
                        : totalDiff < 0
                          ? styles.negative
                          : styles.neutral
                    }`}
                  >
                    {totalDiff > 0 ? "+" : ""}
                    {fmt(totalDiff)}
                  </td>
                  <td className={`${styles.right} ${styles.ratioFull}`}>
                    {status?.mapped ?? "—"}
                  </td>
                  <td
                    className={`${styles.right} ${
                      status !== null && status.unmapped > 0
                        ? styles.ratioNone
                        : styles.ratioFull
                    }`}
                  >
                    {status?.unmapped ?? "—"}
                  </td>
                  <td className={styles.right}>{status?.ignored ?? "—"}</td>
                  <td>
                    {allClear && (
                      <span
                        className={styles.statusDot}
                        style={{ display: "inline-block" }}
                        title="Todos mapeados ou ignorados"
                      >
                        <span className={styles.dotMapped} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <ProvisionItemModal item={selectedItem} onClose={handleModalClose} />
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  result: ParseResult;
}

export default function ResultsView({ result }: Props) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        {result.kind === "mirror"
          ? "Espelho de Folha — Resultado"
          : `Provisão de ${PROVISION_LABELS[result.data.provision_type] ?? result.data.provision_type} — Resultado`}
      </h2>
      {result.kind === "mirror" ? (
        <PayrollMirrorView data={result.data} />
      ) : (
        <ProvisionsView data={result.data} />
      )}
    </div>
  );
}
