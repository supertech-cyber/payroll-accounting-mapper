"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tag } from "@/domain/registry/types";
import {
  createTag,
  deleteTag,
  fetchTags,
  updateTag,
} from "@/infrastructure/api/registry-gateway";
import styles from "./registry.module.css";

type FormData = { slug: string; label: string; description: string };
const EMPTY: FormData = { slug: "", label: "", description: "" };

function tagToForm(t: Tag): FormData {
  return { slug: t.slug, label: t.label, description: t.description ?? "" };
}

export default function TagsTable() {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<{ open: boolean; editing: Tag | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<FormData>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchTags());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.slug.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
    );
  });

  function patch(p: Partial<FormData>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function openCreate() {
    setForm(EMPTY);
    setFormError(null);
    setModal({ open: true, editing: null });
  }

  function openEdit(t: Tag) {
    setForm(tagToForm(t));
    setFormError(null);
    setModal({ open: true, editing: t });
  }

  function closeModal() {
    setModal({ open: false, editing: null });
  }

  async function handleSubmit() {
    if (!form.slug.trim() || !form.label.trim()) {
      setFormError("Slug e nome são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (modal.editing) {
        await updateTag(modal.editing.id, {
          label: form.label.trim(),
          description: form.description.trim() || null,
        });
      } else {
        await createTag({
          slug: form.slug.trim().toLowerCase(),
          label: form.label.trim(),
          description: form.description.trim() || null,
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
      await deleteTag(deleteTarget.id);
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
          <h1 className={styles.title}>Tags / Grupos</h1>
          <p className={styles.subtitle}>
            Grupos de empresas usados para organizar cadastros e mapeamentos.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          + Nova Tag
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Buscar por slug ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className={styles.toolbarSpacer} />
        {!loading && (
          <span className={styles.muted} style={{ fontSize: "0.78rem" }}>
            {filtered.length} tag{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className={styles.emptyState}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma tag cadastrada.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Slug</th>
                <th>Nome / Label</th>
                <th>Descrição</th>
                <th className={styles.actionsCol}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className={styles.badgeTag}>{t.slug}</span>
                  </td>
                  <td style={{ textTransform: "uppercase" }}>{t.label}</td>
                  <td className={styles.muted}>{t.description ?? "—"}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnIcon}
                      title="Editar"
                      onClick={() => openEdit(t)}
                    >
                      ✎
                    </button>
                    <button
                      className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                      title="Remover"
                      onClick={() => setDeleteTarget(t)}
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
                {modal.editing ? "Editar Tag" : "Nova Tag"}
              </h2>
              <button className={styles.modalClose} onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Slug *</label>
                <input
                  className={styles.formInput}
                  value={form.slug}
                  disabled={!!modal.editing}
                  onChange={(e) =>
                    patch({
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  placeholder="ex: supersafra"
                />
                {!modal.editing && (
                  <span
                    className={styles.muted}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Identificador único, apenas letras minúsculas e hífens. Não
                    pode ser alterado.
                  </span>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome / Label *</label>
                <input
                  className={styles.formInput}
                  value={form.label}
                  onChange={(e) =>
                    patch({ label: e.target.value.toUpperCase() })
                  }
                  placeholder="EX: SUPERSAFRA"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descrição</label>
                <input
                  className={styles.formInput}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Descrição opcional do grupo…"
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
              <h2 className={styles.modalTitle}>Remover Tag</h2>
              <button
                className={styles.modalClose}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteText}>
                Deseja remover a tag <strong>#{deleteTarget.slug}</strong> (
                {deleteTarget.label})? Empresas que usam esta tag não serão
                afetadas, mas o grupo deixará de aparecer nas opções de
                cadastro.
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
