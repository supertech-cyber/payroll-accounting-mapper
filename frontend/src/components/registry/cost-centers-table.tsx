"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company, CostCenter } from "@/domain/registry/types";
import {
  createCostCenter,
  deleteCostCenter,
  fetchCompanies,
  fetchCostCenters,
  updateCostCenter,
} from "@/infrastructure/api/registry-gateway";
import styles from "./registry.module.css";

type FormData = {
  code: string;
  name: string;
  tag: string; // derived from company.tag; used to resolve company_id on submit
  target_cost_center_id: string;
};
const EMPTY: FormData = {
  code: "",
  name: "",
  tag: "",
  target_cost_center_id: "",
};

function ccToForm(cc: CostCenter, companies: Company[]): FormData {
  const company = companies.find((c) => c.id === cc.company_id);
  return {
    code: cc.code,
    name: cc.name,
    tag: company?.tag ?? "",
    target_cost_center_id:
      cc.target_cost_center_id != null ? String(cc.target_cost_center_id) : "",
  };
}

export default function CostCentersTable() {
  const [items, setItems] = useState<CostCenter[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<{
    open: boolean;
    editing: CostCenter | null;
  }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CostCenter | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ccs, comps] = await Promise.all([
        fetchCostCenters(),
        fetchCompanies(),
      ]);
      setItems(ccs);
      setCompanies(comps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  // Tag-based accordion groups
  interface CcGroup {
    groupKey: string;
    label: string;
    isTag: boolean;
    items: CostCenter[];
  }
  const searchedItems = items.filter((cc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cc.code.toLowerCase().includes(q) || cc.name.toLowerCase().includes(q)
    );
  });
  const groupMap = new Map<string, CcGroup>();
  for (const cc of searchedItems) {
    const company = cc.company_id ? companyMap.get(cc.company_id) : undefined;
    const tag = company?.tag;
    const groupKey = tag ?? (company ? `company_${company.id}` : "sem-empresa");
    const label = tag ?? company?.name ?? "Sem empresa";
    const isTag = !!tag;
    if (!groupMap.has(groupKey))
      groupMap.set(groupKey, { groupKey, label, isTag, items: [] });
    groupMap.get(groupKey)!.items.push(cc);
  }
  const groups = [...groupMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const totalFiltered = searchedItems.length;

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function patch(p: Partial<FormData>) {
    setForm((f) => ({ ...f, ...p }));
  }

  // Distinct tags available from the companies list
  const availableTags = [
    ...new Set(companies.map((c) => c.tag).filter(Boolean)),
  ] as string[];

  function openCreate() {
    setForm({
      ...EMPTY,
      tag: availableTags[0] ?? "",
    });
    setFormError(null);
    setModal({ open: true, editing: null });
  }

  function openEdit(cc: CostCenter) {
    setForm(ccToForm(cc, companies));
    setFormError(null);
    setModal({ open: true, editing: cc });
  }

  function closeModal() {
    setModal({ open: false, editing: null });
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Código e nome são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      // Resolve company_id from the selected tag (first company with that tag, by id)
      const company_id = form.tag
        ? (companies.find((c) => c.tag === form.tag)?.id ?? null)
        : null;
      const target_cost_center_id = form.target_cost_center_id
        ? Number(form.target_cost_center_id)
        : null;
      if (modal.editing) {
        await updateCostCenter(modal.editing.id, {
          name: form.name.trim(),
          company_id,
          target_cost_center_id,
        });
      } else {
        await createCostCenter({
          code: form.code.trim(),
          name: form.name.trim(),
          company_id,
          target_cost_center_id,
        });
      }
      closeModal();
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCostCenter(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>Centros de Custo</h1>
          <p className={styles.subtitle}>
            Cadastro de centros de custo utilizados no mapeamento contábil.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          + Novo Centro de Custo
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Buscar por código ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className={styles.toolbarSpacer} />
        {!loading && (
          <span className={styles.muted} style={{ fontSize: "0.78rem" }}>
            {totalFiltered} centro{totalFiltered !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className={styles.emptyState}>Carregando...</div>
      ) : groups.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhum centro de custo encontrado.
        </div>
      ) : (
        <div className={styles.companyGroups}>
          {groups.map((group) => {
            const isOpen = expandedGroups.has(group.groupKey);
            return (
              <div key={group.groupKey} className={styles.companyGroup}>
                <button
                  className={styles.companyGroupHeader}
                  onClick={() => toggleGroup(group.groupKey)}
                >
                  <span
                    className={`${styles.companyGroupChevron} ${isOpen ? styles.open : ""}`}
                  >
                    ▶
                  </span>
                  {group.isTag ? (
                    <span className={styles.badgeTag}>{group.label}</span>
                  ) : (
                    <span className={styles.companyGroupName}>
                      {group.label}
                    </span>
                  )}
                  <span className={styles.companyGroupBadge}>
                    {group.items.length} CC{group.items.length !== 1 ? "s" : ""}
                  </span>
                </button>
                {isOpen && (
                  <div className={styles.companyGroupBody}>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Nome</th>
                            <th className={styles.actionsCol}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((cc) => {
                            const company = cc.company_id
                              ? companyMap.get(cc.company_id)
                              : undefined;
                            return (
                              <tr key={cc.id}>
                                <td>
                                  <span className={styles.codeTag}>
                                    {cc.code}
                                  </span>
                                </td>
                                <td style={{ textTransform: "uppercase" }}>
                                  {cc.name}
                                </td>
                                <td className={styles.actions}>
                                  <button
                                    className={styles.btnIcon}
                                    title="Editar"
                                    onClick={() => openEdit(cc)}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                                    title="Remover"
                                    onClick={() => setDeleteTarget(cc)}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modal.editing
                  ? "Editar Centro de Custo"
                  : "Novo Centro de Custo"}
              </h2>
              <button className={styles.modalClose} onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Código *</label>
                <input
                  className={styles.formInput}
                  value={form.code}
                  disabled={!!modal.editing}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="Ex: CC001"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome *</label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={(e) =>
                    patch({ name: e.target.value.toUpperCase() })
                  }
                  placeholder="NOME DO CENTRO DE CUSTO"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Grupo / Tag</label>
                <select
                  className={styles.formSelect}
                  value={form.tag}
                  onChange={(e) => patch({ tag: e.target.value })}
                >
                  <option value="">— Sem grupo —</option>
                  {availableTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Lançar em (CC de destino)
                </label>
                <select
                  className={styles.formSelect}
                  value={form.target_cost_center_id}
                  onChange={(e) =>
                    patch({ target_cost_center_id: e.target.value })
                  }
                >
                  <option value="">— Próprio CC (padrão) —</option>
                  {items
                    .filter(
                      (cc) => !modal.editing || cc.id !== modal.editing.id,
                    )
                    .map((cc) => (
                      <option key={cc.id} value={String(cc.id)}>
                        {cc.code} — {cc.name}
                      </option>
                    ))}
                </select>
              </div>
              {formError && <p className={styles.formError}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={closeModal}>
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Remover Centro de Custo</h2>
              <button
                className={styles.modalClose}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteText}>
                Deseja remover o centro de custo{" "}
                <strong>{deleteTarget.name}</strong> ({deleteTarget.code})? Esta
                ação não pode ser desfeita.
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
                onClick={handleDelete}
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
