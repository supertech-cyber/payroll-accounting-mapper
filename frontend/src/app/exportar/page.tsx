"use client";

import React, { useState, useEffect } from "react";
import { useProcessing } from "@/app/processing-provider";
import {
  exportFpa,
  fetchCompanies,
  fetchAllEventsWithMappings,
  fetchCostCenters,
} from "@/infrastructure/api/registry-gateway";
import type { PayrollMirrorResult } from "@/domain/payroll/types";
import type { ProvisionsResult } from "@/domain/provisions/types";
import type { Company, EventFlat, CostCenter } from "@/domain/registry/types";
import styles from "./exportar.module.css";

const TEMPLATE_OPTIONS = [{ value: "fpa-elevor", label: "FPA-ELEVOR (.fpa)" }];

function formatCompetence(comp: string): string {
  const [year, month] = comp.split("-");
  return `${month}/${year}`;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface PreviewCcBlock {
  ccCode: string;
  ccName: string;
  mapped: number;
  unmapped: number;
  ignored: number;
}

interface PreviewCompanyGroup {
  companyCode: string;
  companyName: string;
  fpaBatch: number | null;
  blocks: PreviewCcBlock[];
}

function buildMirrorPreviewGroups(
  data: PayrollMirrorResult,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
  batchMap: Map<string, number | null>,
  companies: Company[],
): PreviewCompanyGroup[] {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  const groups = new Map<string, PreviewCompanyGroup>();
  for (const b of data.blocks.filter((b) => !b.is_totalizer)) {
    const key = b.company_code ?? "—";
    if (!groups.has(key)) {
      groups.set(key, {
        companyCode: b.company_code ?? "—",
        companyName: b.company_name ?? "",
        fpaBatch: batchMap.get(b.company_code ?? "") ?? null,
        blocks: [],
      });
    }
    let mapped = 0,
      unmapped = 0,
      ignored = 0;
    const company = companies.find((c) => c.code === b.company_code);
    const ccForBlock = costCenters.find(
      (cc) =>
        cc.code === b.cost_center_code &&
        (company ? cc.company_id === company.id : true),
    );
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
        (ccId
          ? ev.mappings.find((m) => m.cost_center_id === ccId)
          : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
      if (best && (best.debit_account || best.credit_account)) mapped++;
      else unmapped++;
    }
    for (const e of b.events) checkCode(e.event_code);
    for (const [key, val] of Object.entries(b.summary ?? {}))
      if (typeof val === "number" && val !== 0) checkCode(key);
    for (const [key, val] of Object.entries(b.gps ?? {}))
      if (typeof val === "number" && val !== 0) checkCode(key);
    groups.get(key)!.blocks.push({
      ccCode: b.cost_center_code ?? "—",
      ccName: b.cost_center_name ?? "",
      mapped,
      unmapped,
      ignored,
    });
  }
  return [...groups.values()];
}

type FpaBlock = {
  company_code: string | null;
  company_name: string | null;
  company_fpa_batch: number | null;
  competence: string;
  cost_center_code: string | null;
  cost_center_name: string | null;
  is_totalizer: boolean;
  events: {
    entry_type: string;
    event_code: string;
    description: string;
    amount: number;
    mapping: {
      debit_account: string | null;
      credit_account: string | null;
      is_mapped: boolean;
    } | null;
  }[];
};

function buildProvisionBlocks(
  data: ProvisionsResult,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
  batchMap: Map<string, number | null>,
): FpaBlock[] {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  return data.items.map((item) => {
    const ccForItem = costCenters.find(
      (cc) => cc.code === item.cost_center_code,
    );
    const ccId = ccForItem?.id ?? null;
    // Use amount_difference (period movement), not the full accumulated balance
    const validEntries = item.entries.filter((e) => e.amount_difference !== 0);
    return {
      company_code: item.company_code,
      company_name: item.company_name,
      company_fpa_batch: batchMap.get(item.company_code) ?? null,
      competence: item.competence_current,
      cost_center_code: item.cost_center_code,
      cost_center_name: item.cost_center_name,
      is_totalizer: false,
      events: validEntries.map((entry) => {
        const ev = eventByCode.get(entry.entry_code);
        if (!ev || !ev.is_active) {
          return {
            entry_type: "PROV",
            event_code: entry.entry_code,
            description: entry.entry_description,
            amount: entry.amount_difference,
            mapping: null,
          };
        }
        const best =
          (ccId != null
            ? ev.mappings.find((m) => m.cost_center_id === ccId)
            : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
        return {
          entry_type: "PROV",
          event_code: entry.entry_code,
          description: entry.entry_description,
          amount: entry.amount_difference,
          mapping: best
            ? {
                debit_account: best.debit_account,
                credit_account: best.credit_account,
                is_mapped: !!(best.debit_account && best.credit_account),
              }
            : null,
        };
      }),
    };
  });
}

function buildProvisionPreviewGroups(
  data: ProvisionsResult,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
  batchMap: Map<string, number | null>,
): PreviewCompanyGroup[] {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  const groups = new Map<string, PreviewCompanyGroup>();
  for (const item of data.items) {
    const key = item.company_code;
    if (!groups.has(key)) {
      groups.set(key, {
        companyCode: item.company_code,
        companyName: item.company_name,
        fpaBatch: batchMap.get(item.company_code) ?? null,
        blocks: [],
      });
    }
    const ccForItem = costCenters.find(
      (cc) => cc.code === item.cost_center_code,
    );
    const ccId = ccForItem?.id ?? null;
    const validEntries = item.entries.filter((e) => e.amount_difference !== 0);
    let mapped = 0,
      unmapped = 0,
      ignored = 0;
    for (const entry of validEntries) {
      const ev = eventByCode.get(entry.entry_code);
      if (!ev) {
        unmapped++;
        continue;
      }
      if (!ev.is_active) {
        ignored++;
        continue;
      }
      const best =
        (ccId != null
          ? ev.mappings.find((m) => m.cost_center_id === ccId)
          : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
      if (best && best.debit_account && best.credit_account) mapped++;
      else unmapped++;
    }
    groups.get(key)!.blocks.push({
      ccCode: item.cost_center_code,
      ccName: item.cost_center_name,
      mapped,
      unmapped,
      ignored,
    });
  }
  return [...groups.values()];
}

function buildMirrorBlocks(
  data: PayrollMirrorResult,
  eventsFlat: EventFlat[],
  costCenters: CostCenter[],
  batchMap: Map<string, number | null>,
  companies: Company[],
): FpaBlock[] {
  const eventByCode = new Map(eventsFlat.map((e) => [e.code, e]));
  const blocks: FpaBlock[] = [];

  for (const b of data.blocks) {
    const company = companies.find((c) => c.code === b.company_code);
    const ccForBlock =
      costCenters.find(
        (cc) =>
          cc.code === b.cost_center_code &&
          (company ? cc.company_id === company.id : true),
      ) ?? costCenters.find((cc) => cc.code === b.cost_center_code);
    const ccId = ccForBlock?.id ?? null;

    function resolveMapping(code: string) {
      const ev = eventByCode.get(code);
      if (!ev || !ev.is_active) return null;
      const best =
        (ccId != null
          ? ev.mappings.find((m) => m.cost_center_id === ccId)
          : undefined) ?? ev.mappings.find((m) => m.cost_center_id === null);
      if (!best) return null;
      return {
        debit_account: best.debit_account,
        credit_account: best.credit_account,
        is_mapped: !!(best.debit_account && best.credit_account),
      };
    }

    // Eventos de folha com mappings frescos do registry
    const eventEntries = b.events.map((e) => ({
      entry_type: e.entry_type,
      event_code: e.event_code,
      description: e.description,
      amount: e.amount,
      mapping: resolveMapping(e.event_code),
    }));

    // Entradas do Resumo Geral (valores numéricos)
    const summaryEntries = Object.entries(b.summary ?? {})
      .filter(([, val]) => typeof val === "number" && (val as number) !== 0)
      .map(([key, val]) => ({
        entry_type: "SUM",
        event_code: key,
        description: eventByCode.get(key)?.description ?? key,
        amount: val as number,
        mapping: resolveMapping(key),
      }));

    // Entradas do Analítico GPS (apenas valores numéricos — ignora strings brutas)
    const gpsEntries = Object.entries(b.gps ?? {})
      .filter(([, val]) => typeof val === "number" && (val as number) !== 0)
      .map(([key, val]) => ({
        entry_type: "GPS",
        event_code: key,
        description: eventByCode.get(key)?.description ?? key,
        amount: val as number,
        mapping: resolveMapping(key),
      }));

    blocks.push({
      company_code: b.company_code,
      company_name: b.company_name,
      company_fpa_batch: batchMap.get(b.company_code ?? "") ?? null,
      competence: b.competence,
      cost_center_code: b.cost_center_code,
      cost_center_name: b.cost_center_name,
      is_totalizer: b.is_totalizer,
      events: [...eventEntries, ...summaryEntries, ...gpsEntries],
    });
  }

  return blocks;
}

function mergeBlocksByCC(blocks: FpaBlock[]): FpaBlock[] {
  const merged = new Map<string, FpaBlock>();
  for (const block of blocks) {
    if (block.is_totalizer) continue;
    const key = `${block.company_code ?? ""}|${block.cost_center_code ?? ""}`;
    if (merged.has(key)) {
      merged.get(key)!.events.push(...block.events);
    } else {
      merged.set(key, { ...block, events: [...block.events] });
    }
  }
  return [...merged.values()];
}

function PreviewSection({
  title,
  groups,
}: {
  title: string;
  groups: PreviewCompanyGroup[];
}) {
  return (
    <div className={styles.previewSection}>
      <h3 className={styles.previewSectionTitle}>{title}</h3>
      <div className={styles.previewTableWrapper}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Empresa / Centro de Custo</th>
              <th className={styles.right}>Mapeado</th>
              <th className={styles.right}>Não mapeado</th>
              <th className={styles.right}>Ignorado</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={`group-${group.companyCode}`}>
                <tr className={styles.previewGroupRow}>
                  <td colSpan={4}>
                    <span className={styles.previewGroupCode}>
                      {group.companyCode}
                    </span>{" "}
                    {group.companyName}
                    {group.fpaBatch != null && (
                      <span className={styles.previewBatchBadge}>
                        lote {group.fpaBatch}
                      </span>
                    )}
                  </td>
                </tr>
                {group.blocks.map((row, j) => (
                  <tr
                    key={`${group.companyCode}-${j}`}
                    className={styles.previewCcRow}
                  >
                    <td className={styles.previewCcLabel}>
                      <span className={styles.previewCcIndent}>↳</span>
                      <span className={styles.previewCcCode}>
                        {row.ccCode}
                      </span>{" "}
                      {row.ccName}
                    </td>
                    <td
                      className={`${styles.right} ${
                        row.mapped > 0 ? styles.full : ""
                      }`}
                    >
                      {row.mapped}
                    </td>
                    <td
                      className={`${styles.right} ${
                        row.unmapped > 0 ? styles.none : ""
                      }`}
                    >
                      {row.unmapped}
                    </td>
                    <td className={styles.right}>{row.ignored}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExportarPage() {
  const { tabs } = useProcessing();
  const [template] = useState("fpa-elevor");
  const [batch, setBatch] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [eventsFlat, setEventsFlat] = useState<EventFlat[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]); // used for provision preview

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch(() => {});
    fetchAllEventsWithMappings()
      .then(setEventsFlat)
      .catch(() => {});
    fetchCostCenters()
      .then(setCostCenters)
      .catch(() => {});
  }, []);

  const companyFpaBatch = new Map(
    companies.map((c) => [c.code, c.fpa_batch] as [string, number | null]),
  );

  // Each result type independently — all exported together
  const mirrorData =
    tabs["mirror"].result?.kind === "mirror"
      ? tabs["mirror"].result.data
      : null;
  const provision13thData =
    tabs["13th"].result?.kind === "provision" ? tabs["13th"].result.data : null;
  const provisionVacationData =
    tabs["vacation"].result?.kind === "provision"
      ? tabs["vacation"].result.data
      : null;

  const hasAnyResult = !!(
    mirrorData ||
    provision13thData ||
    provisionVacationData
  );

  const mirrorGroups = mirrorData
    ? buildMirrorPreviewGroups(
        mirrorData,
        eventsFlat,
        costCenters,
        companyFpaBatch,
        companies,
      )
    : [];
  const prov13thGroups = provision13thData
    ? buildProvisionPreviewGroups(
        provision13thData,
        eventsFlat,
        costCenters,
        companyFpaBatch,
      )
    : [];
  const provVacationGroups = provisionVacationData
    ? buildProvisionPreviewGroups(
        provisionVacationData,
        eventsFlat,
        costCenters,
        companyFpaBatch,
      )
    : [];

  // Count unique (company, CC) pairs — mirrors the merging done at download time
  const allUniqueCCs = new Set<string>();
  mirrorGroups.forEach((g) =>
    g.blocks.forEach((b) => allUniqueCCs.add(`${g.companyCode}|${b.ccCode}`)),
  );
  prov13thGroups.forEach((g) =>
    g.blocks.forEach((b) => allUniqueCCs.add(`${g.companyCode}|${b.ccCode}`)),
  );
  provVacationGroups.forEach((g) =>
    g.blocks.forEach((b) => allUniqueCCs.add(`${g.companyCode}|${b.ccCode}`)),
  );
  const totalFiles = allUniqueCCs.size;

  const competence =
    mirrorData?.blocks[0]?.competence ??
    provision13thData?.items[0]?.competence_current ??
    provisionVacationData?.items[0]?.competence_current ??
    null;

  async function handleDownload() {
    if (!hasAnyResult) return;
    setLoading(true);
    setError(null);
    try {
      const allBlocks: FpaBlock[] = [];

      // Sempre busca mappings frescos — garante que remapeamentos feitos após o
      // parse sejam refletidos e que entradas de Resumo / GPS sejam incluídas.
      const [freshEvents, freshCCs] = await Promise.all([
        fetchAllEventsWithMappings(true),
        fetchCostCenters(),
      ]);

      if (mirrorData) {
        allBlocks.push(
          ...buildMirrorBlocks(
            mirrorData,
            freshEvents,
            freshCCs,
            companyFpaBatch,
            companies,
          ),
        );
      }

      if (provision13thData) {
        allBlocks.push(
          ...buildProvisionBlocks(
            provision13thData,
            freshEvents,
            freshCCs,
            companyFpaBatch,
          ),
        );
      }
      if (provisionVacationData) {
        allBlocks.push(
          ...buildProvisionBlocks(
            provisionVacationData,
            freshEvents,
            freshCCs,
            companyFpaBatch,
          ),
        );
      }

      // Merge blocks with the same (company, CC) → one .fpa file each
      const mergedBlocks = mergeBlocksByCC(allBlocks);

      const blob = await exportFpa({ blocks: mergedBlocks, batch: 1 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FPA_${(competence ?? "export").replace("-", "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!hasAnyResult) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="#f87171"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p>Nenhum arquivo processado.</p>
          <p className={styles.emptyHint}>
            Processe um espelho de folha ou provisão na página de processamento
            para habilitar a exportação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Exportar</h1>
          <p className={styles.subtitle}>
            Gere arquivos contábeis a partir dos dados processados.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left: Options */}
        <div className={styles.optionsPanel}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Template de exportação</label>
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#a3e635",
                background: "rgba(163,230,53,0.08)",
                border: "1px solid rgba(163,230,53,0.22)",
                borderRadius: 5,
                padding: "0.4rem 0.75rem",
                letterSpacing: "0.03em",
              }}
            >
              {TEMPLATE_OPTIONS.find((o) => o.value === template)?.label ??
                template.toUpperCase()}
            </div>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                marginTop: "0.25rem",
              }}
            >
              Definido pelo cadastro das empresas.
            </p>
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button
            className={styles.downloadBtn}
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden /> Gerando…
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M8 1v9M4.5 9.5 8 13l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Baixar ZIP
              </>
            )}
          </button>
        </div>

        {/* Right: Preview */}
        <div className={styles.previewPanel}>
          <h2 className={styles.previewTitle}>
            Prévia — {competence ? formatCompetence(competence) : "—"}
          </h2>
          <p className={styles.previewSub}>
            {totalFiles} arquivo{totalFiles !== 1 ? "s" : ""} .fpa{" "}
            {totalFiles !== 1 ? "serão gerados" : "será gerado"} (folha +
            provisões combinadas por CC)
          </p>

          {mirrorGroups.length > 0 && (
            <PreviewSection title="Espelho de Folha" groups={mirrorGroups} />
          )}
          {prov13thGroups.length > 0 && (
            <PreviewSection title="Provisão 13º" groups={prov13thGroups} />
          )}
          {provVacationGroups.length > 0 && (
            <PreviewSection
              title="Provisão Férias"
              groups={provVacationGroups}
            />
          )}
        </div>
      </div>
    </div>
  );
}
