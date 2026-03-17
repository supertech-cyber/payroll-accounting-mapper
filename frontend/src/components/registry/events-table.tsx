"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Company,
  CostCenter,
  EventFlat,
  EventMapping,
} from "@/domain/registry/types";
import {
  createEvent,
  deleteEvent,
  deleteMapping,
  fetchAllEventsWithMappings,
  fetchCompanies,
  fetchCostCenters,
  updateEvent,
  updateMapping,
  upsertMapping,
} from "@/infrastructure/api/registry-gateway";
import styles from "./registry.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type EventFormData = {
  code: string;
  description: string;
  entry_type: string;
  is_active: boolean;
  useInherit: boolean;
  inheritFrom: string;
  tag: string;
};

const EMPTY_FORM: EventFormData = {
  code: "",
  description: "",
  entry_type: "P",
  is_active: true,
  useInherit: false,
  inheritFrom: "",
  tag: "",
};

interface MappingWithCcInfo extends EventMapping {
  ccCode: string | null;
  ccName: string | null;
}

interface EventInGroup {
  event: EventFlat;
  /** Only the mappings relevant to this company group */
  mappings: MappingWithCcInfo[];
}

interface CompanyGroup {
  groupKey: string;
  companyId: number | null;
  companyCode: string | null;
  companyName: string;
  tag: string | null;
  events: EventInGroup[];
  inactiveEvents: EventInGroup[];
  /** CC ids to show in the add-mapping dropdown; null = all CCs */
  groupCcIds: number[] | null;
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(
  companies: Company[],
  costCenters: CostCenter[],
  events: EventFlat[],
  search: string,
): CompanyGroup[] {
  const ccById = new Map(costCenters.map((cc) => [cc.id, cc]));
  const matchesSearch = (ev: EventFlat) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ev.code.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q)
    );
  };

  const filtered = events.filter((ev) => ev.is_active && matchesSearch(ev));
  const inactiveFiltered = events.filter(
    (ev) => !ev.is_active && matchesSearch(ev),
  );

  const groups: CompanyGroup[] = [];

  // Group companies by their tag (companies sharing the same tag are merged)
  const tagGroups = new Map<string, Company[]>();
  for (const company of companies) {
    const key = company.tag ?? `company_${company.id}`;
    if (!tagGroups.has(key)) tagGroups.set(key, []);
    tagGroups.get(key)!.push(company);
  }

  // Orphan CCs: company_id is null OR company_id points to an unknown company
  const knownCompanyIds = new Set(companies.map((c) => c.id));
  const orphanCcIds = new Set(
    costCenters
      .filter(
        (cc) => cc.company_id === null || !knownCompanyIds.has(cc.company_id!),
      )
      .map((cc) => cc.id),
  );
  let orphansAssigned = false;

  for (const [tagKey, groupCompanies] of tagGroups) {
    // Collect all CC IDs for every company in this group.
    const groupCompanyIds = new Set(groupCompanies.map((c) => c.id));
    const groupCcIds: number[] = [];
    const groupCcIdSet = new Set<number>();
    for (const cc of costCenters) {
      const belongsToGroup =
        (cc.company_id !== null && groupCompanyIds.has(cc.company_id)) ||
        // Assign orphan CCs to the first tag group encountered
        (!orphansAssigned && orphanCcIds.has(cc.id));
      if (belongsToGroup && !groupCcIdSet.has(cc.id)) {
        groupCcIdSet.add(cc.id);
        groupCcIds.push(cc.id);
      }
    }
    // Mark orphans as assigned after first group processes them
    if (!orphansAssigned && groupCcIds.some((id) => orphanCcIds.has(id))) {
      orphansAssigned = true;
    }

    const eventsInGroup: EventInGroup[] = [];
    for (const ev of filtered) {
      const relevantMappings = ev.mappings
        .filter(
          (m) =>
            m.cost_center_id !== null && groupCcIdSet.has(m.cost_center_id),
        )
        .map((m) => {
          const cc = ccById.get(m.cost_center_id!);
          return { ...m, ccCode: cc?.code ?? null, ccName: cc?.name ?? null };
        });
      if (relevantMappings.length > 0) {
        eventsInGroup.push({ event: ev, mappings: relevantMappings });
      }
    }
    const inactiveEventsInGroup: EventInGroup[] = [];
    for (const ev of inactiveFiltered) {
      // For inactive events, accept CC-specific mappings for this group
      // AND default (null CC) mappings so they're always discoverable.
      const relevantMappings = ev.mappings
        .filter(
          (m) =>
            m.cost_center_id === null || groupCcIdSet.has(m.cost_center_id!),
        )
        .map((m) => {
          const cc = m.cost_center_id
            ? ccById.get(m.cost_center_id)
            : undefined;
          return { ...m, ccCode: cc?.code ?? null, ccName: cc?.name ?? null };
        });
      // Even if the event has no mappings at all, still show it in the group
      // so the user can find it and reactivate it.
      if (relevantMappings.length > 0 || ev.mappings.length === 0) {
        inactiveEventsInGroup.push({ event: ev, mappings: relevantMappings });
      }
    }
    if (eventsInGroup.length > 0 || inactiveEventsInGroup.length > 0) {
      const firstCompany = groupCompanies[0];
      const isSingleCompany = groupCompanies.length === 1 && !firstCompany.tag;
      const groupName = firstCompany.tag
        ? groupCompanies.map((c) => c.name).join(" / ")
        : firstCompany.name;
      groups.push({
        groupKey: tagKey,
        companyId: isSingleCompany ? firstCompany.id : null,
        companyCode: isSingleCompany ? firstCompany.code : null,
        companyName: groupName,
        tag: firstCompany.tag ?? null,
        events: eventsInGroup,
        inactiveEvents: inactiveEventsInGroup,
        groupCcIds: groupCcIds.length > 0 ? groupCcIds : null,
      });
    }
  }

  return groups;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  P: "Provento",
  D: "Desconto",
  PROV: "Provisão",
};

function TypeBadge({ type }: { type: string }) {
  const cls =
    type === "P"
      ? styles.badgeP
      : type === "D"
        ? styles.badgeD
        : styles.badgePROV;
  return <span className={cls}>{ENTRY_TYPE_LABELS[type] ?? type}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventsTable() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [eventsFlat, setEventsFlat] = useState<EventFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [expandedInactiveGroups, setExpandedInactiveGroups] = useState<
    Set<string>
  >(new Set());

  const [addMappingForm, setAddMappingForm] = useState<{
    eventId: number;
    groupCompanyId: number | null;
    costCenterId: string;
    debit: string;
    credit: string;
    saving: boolean;
    error: string | null;
  } | null>(null);

  const [mappingModal, setMappingModal] = useState<{
    open: boolean;
    mapping: EventMapping | null;
    eventId: number | null;
  }>({ open: false, mapping: null, eventId: null });
  const [mappingForm, setMappingForm] = useState({
    credit_account: "",
    debit_account: "",
  });
  const [mappingFormError, setMappingFormError] = useState<string | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);

  const [eventModal, setEventModal] = useState<{
    open: boolean;
    editing: EventFlat | null;
  }>({ open: false, editing: null });
  const [eventForm, setEventForm] = useState<EventFormData>(EMPTY_FORM);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EventFlat | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cmp, ccs, evs] = await Promise.all([
        fetchCompanies(),
        fetchCostCenters(),
        fetchAllEventsWithMappings(true),
      ]);
      setCompanies(cmp);
      setCostCenters(ccs);
      setEventsFlat(evs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const tree = buildTree(companies, costCenters, eventsFlat, search);

  // When the user enables showInactive, auto-expand all groups that have
  // inactive events so the sub-sections are immediately visible.
  useEffect(() => {
    if (!showInactive) return;
    setExpandedGroups((prev) => {
      const groupsWithInactive = tree
        .filter((g) => g.inactiveEvents.length > 0)
        .map((g) => g.groupKey);
      if (groupsWithInactive.every((k) => prev.has(k))) return prev;
      const next = new Set(prev);
      groupsWithInactive.forEach((k) => next.add(k));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleEvent(id: number) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleInactive(key: string) {
    setExpandedInactiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Add mapping ──────────────────────────────────────────────────────────────
  function startAddMapping(eventId: number, groupCompanyId: number | null) {
    setAddMappingForm({
      eventId,
      groupCompanyId,
      costCenterId: "",
      debit: "",
      credit: "",
      saving: false,
      error: null,
    });
  }

  async function handleAddMapping() {
    if (!addMappingForm) return;
    setAddMappingForm((f) => f && { ...f, saving: true, error: null });
    try {
      const newMapping = await upsertMapping(addMappingForm.eventId, {
        cost_center_id: addMappingForm.costCenterId
          ? Number(addMappingForm.costCenterId)
          : null,
        debit_account: addMappingForm.debit || null,
        credit_account: addMappingForm.credit || null,
      });
      setEventsFlat((prev) =>
        prev.map((ev) => {
          if (ev.id !== addMappingForm.eventId) return ev;
          const rest = ev.mappings.filter(
            (m) => m.cost_center_id !== newMapping.cost_center_id,
          );
          return { ...ev, mappings: [...rest, newMapping] };
        }),
      );
      setAddMappingForm(null);
    } catch (e) {
      setAddMappingForm(
        (f) => f && { ...f, saving: false, error: (e as Error).message },
      );
    }
  }

  // ── Edit mapping ──────────────────────────────────────────────────────────────
  function openEditMapping(mapping: EventMapping, eventId: number) {
    setMappingForm({
      credit_account: mapping.credit_account ?? "",
      debit_account: mapping.debit_account ?? "",
    });
    setMappingFormError(null);
    setMappingModal({ open: true, mapping, eventId });
  }

  function closeMappingModal() {
    setMappingModal({ open: false, mapping: null, eventId: null });
  }

  async function handleSaveMapping() {
    if (!mappingModal.mapping || !mappingModal.eventId) return;
    setSavingMapping(true);
    setMappingFormError(null);
    try {
      const updated = await updateMapping(mappingModal.mapping.id, {
        credit_account: mappingForm.credit_account || null,
        debit_account: mappingForm.debit_account || null,
      });
      setEventsFlat((prev) =>
        prev.map((ev) =>
          ev.id === mappingModal.eventId
            ? {
                ...ev,
                mappings: ev.mappings.map((m) =>
                  m.id === updated.id ? updated : m,
                ),
              }
            : ev,
        ),
      );
      closeMappingModal();
    } catch (e) {
      setMappingFormError((e as Error).message);
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleDeleteMapping(mappingId: number, eventId: number) {
    if (!confirm("Remover este mapeamento?")) return;
    try {
      await deleteMapping(mappingId);
      setEventsFlat((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, mappings: ev.mappings.filter((m) => m.id !== mappingId) }
            : ev,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ── Event CRUD ────────────────────────────────────────────────────────────────
  function openCreate() {
    setEventForm(EMPTY_FORM);
    setEventFormError(null);
    setEventModal({ open: true, editing: null });
  }

  function openEdit(ev: EventFlat, groupTag: string | null) {
    setEventForm({
      code: ev.code,
      description: ev.description,
      entry_type: ev.entry_type,
      is_active: ev.is_active,
      useInherit: false,
      inheritFrom: "",
      tag: groupTag ?? "",
    });
    setEventFormError(null);
    setEventModal({ open: true, editing: ev });
  }

  function closeEventModal() {
    setEventModal({ open: false, editing: null });
  }

  async function handleSubmitEvent() {
    if (!eventForm.code.trim() || !eventForm.description.trim()) {
      setEventFormError("Código e descrição são obrigatórios.");
      return;
    }
    setSavingEvent(true);
    setEventFormError(null);
    try {
      if (eventModal.editing) {
        await updateEvent(eventModal.editing.id, {
          description: eventForm.description.trim(),
          entry_type: eventForm.entry_type,
          is_active: eventForm.is_active,
        });
      } else {
        const newEv = await createEvent({
          code: eventForm.code.trim(),
          description: eventForm.description.trim(),
          entry_type: eventForm.entry_type,
        });
        // Copy mappings from source event if inherit is requested
        if (eventForm.useInherit && eventForm.inheritFrom.trim()) {
          const sourceEv = eventsFlat.find(
            (e) => e.code === eventForm.inheritFrom.trim(),
          );
          if (sourceEv && sourceEv.mappings.length > 0) {
            const mappingsToInherit = selectedTagCcIds
              ? sourceEv.mappings.filter(
                  (m) =>
                    m.cost_center_id === null ||
                    selectedTagCcIds.has(m.cost_center_id),
                )
              : sourceEv.mappings;
            await Promise.all(
              mappingsToInherit.map((m) =>
                upsertMapping(newEv.id, {
                  cost_center_id: m.cost_center_id,
                  debit_account: m.debit_account,
                  credit_account: m.credit_account,
                }),
              ),
            );
          }
        }
      }
      closeEventModal();
      await loadAll();
    } catch (e) {
      setEventFormError((e as Error).message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived helpers ───────────────────────────────────────────────────────────
  const availableTags = [
    ...new Set(companies.map((c) => c.tag).filter(Boolean)),
  ] as string[];

  const selectedTagCcIds: Set<number> | null = eventForm.tag
    ? new Set(
        costCenters
          .filter((cc) => {
            if (cc.company_id === null) return false;
            return (
              companies.find((c) => c.id === cc.company_id)?.tag ===
              eventForm.tag
            );
          })
          .map((cc) => cc.id),
      )
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  const totalFiltered = eventsFlat.filter((ev) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ev.code.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q)
    );
  }).length;

  // ── Event item renderer ────────────────────────────────────────────────
  function renderEventItem(
    event: EventFlat,
    groupMappings: MappingWithCcInfo[],
    group: CompanyGroup,
  ) {
    const isEventOpen = expandedEvents.has(event.id);
    const isAddingMapping = addMappingForm?.eventId === event.id;
    return (
      <div key={event.id} className={styles.eventItem}>
        <div className={styles.eventItemHeader}>
          <button
            className={styles.btnExpand}
            data-open={isEventOpen}
            onClick={() => toggleEvent(event.id)}
            title={isEventOpen ? "Ocultar mapeamentos" : "Ver mapeamentos"}
          >
            ►
          </button>
          <span className={styles.codeTag}>{event.code}</span>
          <span className={styles.eventItemDesc}>{event.description}</span>
          <TypeBadge type={event.entry_type} />
          {event.is_active ? (
            <span className={styles.badgeAtivo}>Ativo</span>
          ) : (
            <span className={styles.badgeInativo}>Inativo</span>
          )}
          <div className={styles.eventItemActions}>
            <button
              className={styles.btnIcon}
              title="Editar evento"
              onClick={() => openEdit(event, group.tag)}
            >
              ✎
            </button>
            <button
              className={`${styles.btnIcon} ${styles.btnIconDanger}`}
              title="Remover evento"
              onClick={() => setDeleteTarget(event)}
            >
              ✕
            </button>
          </div>
        </div>
        {isEventOpen && (
          <div className={styles.eventItemBody}>
            {groupMappings.length > 0 ? (
              <div className={styles.mappingsGrid}>
                {groupMappings.map((m) => (
                  <div key={m.id} className={styles.mappingCard}>
                    <div className={styles.mappingCardHeader}>
                      <span className={styles.mappingCc}>
                        {m.ccCode
                          ? `${m.ccCode} — ${m.ccName}`
                          : "Padrão (todos CCs)"}
                      </span>
                      <div className={styles.mappingCardActions}>
                        <button
                          className={styles.btnIcon}
                          title="Editar mapeamento"
                          onClick={() => openEditMapping(m, event.id)}
                        >
                          ✎
                        </button>
                        <button
                          className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                          title="Remover mapeamento"
                          onClick={() => handleDeleteMapping(m.id, event.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className={styles.mappingAccounts}>
                      <div className={styles.mappingAccountItem}>
                        <span className={styles.mappingAccountLabel}>
                          Débito
                        </span>
                        {m.debit_account ? (
                          <span className={styles.mappingAccountValue}>
                            {m.debit_account}
                          </span>
                        ) : (
                          <span className={styles.mappingUnset}>—</span>
                        )}
                      </div>
                      <div className={styles.mappingAccountItem}>
                        <span
                          className={styles.mappingAccountLabel}
                          style={{ color: "#818cf8" }}
                        >
                          Crédito
                        </span>
                        {m.credit_account ? (
                          <span className={styles.mappingAccountValue}>
                            {m.credit_account}
                          </span>
                        ) : (
                          <span className={styles.mappingUnset}>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className={styles.muted}
                style={{ fontSize: "0.8rem", margin: "0 0 0.75rem" }}
              >
                Nenhum mapeamento cadastrado para esta empresa.
              </p>
            )}
            {/* Inline add-mapping form */}
            {isAddingMapping ? (
              <div className={styles.addMappingForm}>
                <p className={styles.addMappingTitle}>
                  Novo mapeamento — <strong>{event.code}</strong>
                </p>
                <div className={styles.addMappingFields}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Centro de Custo</label>
                    <select
                      className={styles.formSelect}
                      value={addMappingForm!.costCenterId}
                      onChange={(e) =>
                        setAddMappingForm(
                          (f) => f && { ...f, costCenterId: e.target.value },
                        )
                      }
                    >
                      <option value="">Padrão (todos CCs)</option>
                      {costCenters
                        .filter(
                          (cc) =>
                            group.groupCcIds === null ||
                            group.groupCcIds.includes(cc.id),
                        )
                        .map((cc) => (
                          <option key={cc.id} value={String(cc.id)}>
                            {cc.code} — {cc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Conta Débito</label>
                    <input
                      className={styles.formInput}
                      placeholder="Ex: 1.2.3.4.5"
                      value={addMappingForm!.debit}
                      onChange={(e) =>
                        setAddMappingForm(
                          (f) => f && { ...f, debit: e.target.value },
                        )
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Conta Crédito</label>
                    <input
                      className={styles.formInput}
                      placeholder="Ex: 2.1.3.4.5"
                      value={addMappingForm!.credit}
                      onChange={(e) =>
                        setAddMappingForm(
                          (f) => f && { ...f, credit: e.target.value },
                        )
                      }
                    />
                  </div>
                </div>
                {addMappingForm!.error && (
                  <p className={styles.formError}>{addMappingForm!.error}</p>
                )}
                <div className={styles.addMappingActions}>
                  <button
                    className={styles.btnGhost}
                    onClick={() => setAddMappingForm(null)}
                    disabled={addMappingForm!.saving}
                  >
                    Cancelar
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleAddMapping}
                    disabled={addMappingForm!.saving}
                  >
                    {addMappingForm!.saving
                      ? "Salvando..."
                      : "Salvar mapeamento"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.btnAddMapping}
                onClick={() => startAddMapping(event.id, group.companyId)}
              >
                + Adicionar mapeamento
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>Eventos</h1>
          <p className={styles.subtitle}>
            Cadastro de eventos de folha com mapeamentos contábeis organizados
            por empresa.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          + Novo Evento
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Buscar por código ou descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Exibir inativos
        </label>
        <span className={styles.toolbarSpacer} />
        {!loading && (
          <span className={styles.muted} style={{ fontSize: "0.78rem" }}>
            {totalFiltered} evento{totalFiltered !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.emptyState}>Carregando...</div>
      ) : tree.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? "Nenhum evento encontrado." : "Nenhum evento cadastrado."}
        </div>
      ) : (
        <div className={styles.companyGroups}>
          {tree.map((group) => {
            const isGroupOpen = expandedGroups.has(group.groupKey);
            const isSpecialGroup =
              group.groupKey === "global" || group.groupKey === "unmapped";

            return (
              <div key={group.groupKey} className={styles.companyGroup}>
                <button
                  className={`${styles.companyGroupHeader} ${isSpecialGroup ? styles.companyGroupHeaderSpecial : ""}`}
                  onClick={() => toggleGroup(group.groupKey)}
                >
                  <span
                    className={`${styles.companyGroupChevron} ${isGroupOpen ? styles.open : ""}`}
                  >
                    ▶
                  </span>
                  {group.tag && (
                    <span className={styles.badgeTag}>{group.tag}</span>
                  )}
                  {!group.tag && group.companyCode && (
                    <span className={styles.codeTag}>{group.companyCode}</span>
                  )}
                  {!group.tag && (
                    <span className={styles.companyGroupName}>
                      {group.companyName}
                    </span>
                  )}
                  <span className={styles.companyGroupBadge}>
                    {group.events.length} evento
                    {group.events.length !== 1 ? "s" : ""}
                  </span>
                  {group.inactiveEvents.length > 0 && (
                    <span className={styles.inactiveSubBadge}>
                      {group.inactiveEvents.length} inativo
                      {group.inactiveEvents.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>

                {isGroupOpen && (
                  <div className={styles.companyGroupBody}>
                    {/* Active events — hidden when showInactive filter is on */}
                    {!showInactive &&
                      group.events.map(({ event, mappings: groupMappings }) =>
                        renderEventItem(event, groupMappings, group),
                      )}
                    {/* ── Inativos ───────────────────────────────────────────── */}
                    {group.inactiveEvents.length > 0 && (
                      <div className={styles.inactiveSubSection}>
                        {/* When showInactive is on, render directly without the collapsible header */}
                        {showInactive ? (
                          <div>
                            {group.inactiveEvents.map(
                              ({ event, mappings: groupMappings }) =>
                                renderEventItem(event, groupMappings, group),
                            )}
                          </div>
                        ) : (
                          <>
                            <button
                              className={styles.inactiveSubHeader}
                              onClick={() => toggleInactive(group.groupKey)}
                            >
                              <span
                                className={`${styles.companyGroupChevron} ${
                                  expandedInactiveGroups.has(group.groupKey)
                                    ? styles.open
                                    : ""
                                }`}
                              >
                                ►
                              </span>
                              <span>Inativos</span>
                              <span className={styles.inactiveSubBadge}>
                                {group.inactiveEvents.length}
                              </span>
                            </button>
                            {expandedInactiveGroups.has(group.groupKey) && (
                              <div>
                                {group.inactiveEvents.map(
                                  ({ event, mappings: groupMappings }) =>
                                    renderEventItem(
                                      event,
                                      groupMappings,
                                      group,
                                    ),
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Event Modal ─────────────────────────────────────── */}
      {eventModal.open && (
        <div className={styles.overlay} onClick={closeEventModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {eventModal.editing ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button className={styles.modalClose} onClick={closeEventModal}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Código *</label>
                <input
                  className={styles.formInput}
                  value={eventForm.code}
                  disabled={!!eventModal.editing}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="Ex: 1001"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descrição *</label>
                <input
                  className={styles.formInput}
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descrição do evento"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo</label>
                <select
                  className={styles.formSelect}
                  value={eventForm.entry_type}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, entry_type: e.target.value }))
                  }
                >
                  <option value="P">Provento</option>
                  <option value="D">Desconto</option>
                  <option value="PROV">Provisão</option>
                </select>
              </div>
              {!eventModal.editing && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tag / Grupo</label>
                  <select
                    className={styles.formSelect}
                    value={eventForm.tag}
                    onChange={(e) =>
                      setEventForm((f) => ({
                        ...f,
                        tag: e.target.value,
                        inheritFrom: "",
                      }))
                    }
                  >
                    <option value="">— Todos os grupos —</option>
                    {availableTags.map((t) => (
                      <option key={t} value={t}>
                        {t.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <p
                    className={styles.muted}
                    style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}
                  >
                    Filtra os mapeamentos ao herdar de outro evento.
                  </p>
                </div>
              )}
              {!eventModal.editing && (
                <div className={styles.formGroup}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={eventForm.useInherit}
                      onChange={(e) =>
                        setEventForm((f) => ({
                          ...f,
                          useInherit: e.target.checked,
                          inheritFrom: e.target.checked ? f.inheritFrom : "",
                        }))
                      }
                    />
                    Herdar mapeamentos de outro evento
                  </label>
                  {eventForm.useInherit && (
                    <select
                      className={styles.formSelect}
                      style={{ marginTop: "0.4rem" }}
                      value={eventForm.inheritFrom}
                      onChange={(e) =>
                        setEventForm((f) => ({
                          ...f,
                          inheritFrom: e.target.value,
                        }))
                      }
                    >
                      <option value="">— Selecione o evento de origem —</option>
                      {eventsFlat
                        .filter((e) => {
                          if (e.mappings.length === 0) return false;
                          if (!selectedTagCcIds) return true;
                          return e.mappings.some(
                            (m) =>
                              m.cost_center_id === null ||
                              selectedTagCcIds.has(m.cost_center_id),
                          );
                        })
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((e) => (
                          <option key={e.id} value={e.code}>
                            {e.code} — {e.description}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
              {eventModal.editing && eventForm.tag && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tag / Grupo</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    <span className={styles.badgeTag}>{eventForm.tag}</span>
                    <span
                      className={styles.muted}
                      style={{ fontSize: "0.78rem" }}
                    >
                      Este evento pertence a este grupo.
                    </span>
                  </div>
                </div>
              )}
              {eventModal.editing && (
                <div className={styles.formGroup}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={eventForm.is_active}
                      onChange={(e) =>
                        setEventForm((f) => ({
                          ...f,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Evento ativo
                  </label>
                </div>
              )}
              {eventFormError && (
                <p className={styles.formError}>{eventFormError}</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={closeEventModal}>
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSubmitEvent}
                disabled={savingEvent}
              >
                {savingEvent ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Mapping Modal ───────────────────────────────────────────── */}
      {mappingModal.open && mappingModal.mapping && (
        <div className={styles.overlay} onClick={closeMappingModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar Mapeamento</h2>
              <button className={styles.modalClose} onClick={closeMappingModal}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Conta Débito</label>
                <input
                  className={styles.formInput}
                  value={mappingForm.debit_account}
                  onChange={(e) =>
                    setMappingForm((f) => ({
                      ...f,
                      debit_account: e.target.value,
                    }))
                  }
                  placeholder="Ex: 1.2.3.4.5"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Conta Crédito</label>
                <input
                  className={styles.formInput}
                  value={mappingForm.credit_account}
                  onChange={(e) =>
                    setMappingForm((f) => ({
                      ...f,
                      credit_account: e.target.value,
                    }))
                  }
                  placeholder="Ex: 2.1.3.4.5"
                />
              </div>
              {mappingFormError && (
                <p className={styles.formError}>{mappingFormError}</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={closeMappingModal}>
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSaveMapping}
                disabled={savingMapping}
              >
                {savingMapping ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Event Confirm ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Remover Evento</h2>
              <button
                className={styles.modalClose}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteText}>
                Deseja remover o evento{" "}
                <strong>{deleteTarget.description}</strong> ({deleteTarget.code}
                )? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnGhost}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleDeleteEvent}
                disabled={deleting}
              >
                {deleting ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
