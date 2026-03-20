"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company, Tag } from "@/domain/registry/types";
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  fetchTags,
  updateCompany,
} from "@/infrastructure/api/registry-gateway";
import styles from "./registry.module.css";

type FormData = {
  code: string;
  name: string;
  cnpj: string;
  cnpj_base: string;
  output_template: string;
  fpa_batch: string;
  tag: string;
};
const EMPTY: FormData = {
  code: "",
  name: "",
  cnpj: "",
  cnpj_base: "",
  output_template: "",
  fpa_batch: "",
  tag: "",
};

const TEMPLATE_OPTIONS = [
  { value: "", label: "— Sem template —" },
  { value: "fpa-elevor", label: "FPA-ELEVOR" },
];

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCnpjBase(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
}

function companyToForm(c: Company): FormData {
  return {
    code: c.code,
    name: c.name,
    cnpj: c.cnpj ? formatCnpj(c.cnpj) : "",
    cnpj_base: c.cnpj_base ? formatCnpjBase(c.cnpj_base) : "",
    output_template: c.output_template ?? "",
    fpa_batch: c.fpa_batch != null ? String(c.fpa_batch) : "",
    tag: c.tag ?? "",
  };
}

export default function CompaniesTable() {
  const [items, setItems] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<{
    open: boolean;
    editing: Company | null;
  }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companies, tagList] = await Promise.all([
        fetchCompanies(),
        fetchTags(),
      ]);
      setItems(companies);
      setTags(tagList);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  function patch(p: Partial<FormData>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function openCreate() {
    setForm(EMPTY);
    setFormError(null);
    setModal({ open: true, editing: null });
  }

  function openEdit(c: Company) {
    setForm(companyToForm(c));
    setFormError(null);
    setModal({ open: true, editing: c });
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
      const cnpjDigits = form.cnpj.replace(/\D/g, "") || null;
      const cnpjBaseDigits = form.cnpj_base.replace(/\D/g, "") || null;
      if (modal.editing) {
        await updateCompany(modal.editing.id, {
          name: form.name.trim(),
          cnpj: cnpjDigits,
          cnpj_base: cnpjBaseDigits,
          output_template: form.output_template || null,
          fpa_batch: form.fpa_batch.trim()
            ? Number(form.fpa_batch.trim())
            : null,
          tag: form.tag.trim() || null,
        });
      } else {
        await createCompany({
          code: form.code.trim(),
          name: form.name.trim(),
          cnpj: cnpjDigits,
          cnpj_base: cnpjBaseDigits,
          output_template: form.output_template || null,
          fpa_batch: form.fpa_batch.trim()
            ? Number(form.fpa_batch.trim())
            : null,
          tag: form.tag.trim() || null,
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
      await deleteCompany(deleteTarget.id);
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
          <h1 className={styles.title}>Empresas</h1>
          <p className={styles.subtitle}>
            Cadastro de empresas utilizadas no mapeamento contábil.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          + Nova Empresa
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
            {filtered.length} empresa{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className={styles.emptyState}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma empresa encontrada.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>CNPJ Base</th>
                <th>Template</th>
                <th>Tag</th>
                <th>Lote FPA</th>
                <th className={styles.actionsCol}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={styles.codeTag}>{c.code}</span>
                  </td>
                  <td style={{ textTransform: "uppercase" }}>{c.name}</td>
                  <td className={styles.muted}>
                    {c.cnpj ? formatCnpj(c.cnpj) : "—"}
                  </td>
                  <td className={styles.muted}>
                    {c.cnpj_base ? formatCnpjBase(c.cnpj_base) : "—"}
                  </td>
                  <td>
                    {c.output_template ? (
                      <span className={styles.badgePROV}>
                        {TEMPLATE_OPTIONS.find(
                          (o) => o.value === c.output_template,
                        )?.label ?? c.output_template.toUpperCase()}
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {c.tag ? (
                      <span className={styles.badgeTag}>{c.tag}</span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.muted}>{c.fpa_batch ?? "—"}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnIcon}
                      title="Editar"
                      onClick={() => openEdit(c)}
                    >
                      ✎
                    </button>
                    <button
                      className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                      title="Remover"
                      onClick={() => setDeleteTarget(c)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modal.editing ? "Editar Empresa" : "Nova Empresa"}
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
                  placeholder="Ex: 001"
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
                  placeholder="RAZÃO SOCIAL DA EMPRESA"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CNPJ</label>
                <input
                  className={styles.formInput}
                  value={form.cnpj}
                  onChange={(e) => patch({ cnpj: formatCnpj(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CNPJ Base</label>
                <input
                  className={styles.formInput}
                  value={form.cnpj_base}
                  onChange={(e) =>
                    patch({ cnpj_base: formatCnpjBase(e.target.value) })
                  }
                  placeholder="00.000.000"
                  maxLength={10}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Template de exportação
                </label>
                <select
                  className={styles.formSelect}
                  value={form.output_template}
                  onChange={(e) => patch({ output_template: e.target.value })}
                >
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tag / Grupo</label>
                <select
                  className={styles.formSelect}
                  value={form.tag}
                  onChange={(e) => patch({ tag: e.target.value })}
                >
                  <option value="">— Sem grupo —</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.slug}>
                      #{t.slug} — {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Código FPA (lote)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={form.fpa_batch}
                  onChange={(e) => patch({ fpa_batch: e.target.value })}
                  placeholder="Ex: 1"
                />
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
              <h2 className={styles.modalTitle}>Remover Empresa</h2>
              <button
                className={styles.modalClose}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteText}>
                Deseja remover a empresa <strong>{deleteTarget.name}</strong> (
                {deleteTarget.code})? Esta ação não pode ser desfeita.
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
