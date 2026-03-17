"use client";

import { useState } from "react";
import styles from "@/app/templates/templates.module.css";
import regStyles from "@/components/registry/registry.module.css";

interface TemplateField {
  pos: number;
  name: string;
  description: string;
  example: string;
}

interface TemplateInfo {
  value: string;
  label: string;
  extension: string;
  description: string;
  origin: string;
  separator: string;
  fields: TemplateField[];
  sampleLines: string[];
}

const TEMPLATES: TemplateInfo[] = [
  {
    value: "fpa-elevor",
    label: "FPA-ELEVOR",
    extension: ".fpa",
    description:
      "Formato CSV proprietário utilizado pelo sistema Elevor. Cada linha representa um lançamento contábil com débito, crédito e valor. O separador é vírgula. A data está no formato DDMMAAAA. O arquivo pode conter registros de empresas/lotes diferentes intercalados.",
    origin: "Elevor ERP",
    separator: ",",
    fields: [
      { pos: 1, name: "Lote", description: "Número do lote FPA (código da empresa no Elevor)", example: "1" },
      { pos: 2, name: "Data", description: "Data de competência no formato DDMMAAAA", example: "30092024" },
      { pos: 3, name: "Conta Débito", description: "Código numérico da conta contábil de débito", example: "379" },
      { pos: 4, name: "Conta Crédito", description: "Código numérico da conta contábil de crédito", example: "206" },
      { pos: 5, name: "Valor", description: "Valor do lançamento em reais (ponto como separador decimal)", example: "22647.32" },
      { pos: 6, name: "(vazio)", description: "Campo reservado — sempre vazio", example: "" },
      { pos: 7, name: "Histórico", description: "Descrição do evento com competência", example: "SALÁRIO MENSALISTA 09/2024" },
      { pos: 8, name: "(vazio)", description: "Campo reservado — sempre vazio", example: "" },
      { pos: 9, name: "(vazio)", description: "Campo reservado — sempre vazio", example: "" },
    ],
    sampleLines: [
      "1,30092024,379,206,22647.32,,SALÁRIO MENSALISTA 09/2024,,",
      "1,30092024,206,386,94.9,,VALE TRANSPORTE 6% 09/2024,,",
      "1,30092024,608,207,42565.94,,HONORÁRIO PRO-LABORE 09/2024,,",
      "1,30092024,206,387,36,,VALE ALIMENTAÇÃO 09/2024,,",
      "1,30092024,381,206,282.4,,ADICIONAL INSALUBRIDADE 09/2024,,",
      "1,30092024,206,210,2307.15,,INSS 09/2024,,",
      "1,30092024,206,227,1495.24,,IR 09/2024,,",
      "1,30092024,391,212,1991.02,,FGTS A PAGAR 09/2024,,",
      "1,30092024,390,210,15554.76,,GPS_PATRONAL 09/2024,,",
      "3,30092024,379,206,9266.2,,SALÁRIO MENSALISTA 09/2024,,",
      "3,30092024,381,206,564.8,,ADICIONAL INSALUBRIDADE 09/2024,,",
      "3,30092024,206,210,1237,,INSS 09/2024,,",
      "3,30092024,206,227,705.29,,IR 09/2024,,",
      "3,30092024,391,212,856.65,,FGTS A PAGAR 09/2024,,",
      "3,30092024,390,210,3514.33,,GPS_PATRONAL 09/2024,,",
      "1,30092024,394,217,2120.92,,PROV13 09/2024,,",
      "1,30092024,396,218,166.11,,PROVFGTS13 09/2024,,",
      "1,30092024,395,219,568.44,,PROVINSS13 09/2024,,",
      "1,30092024,221,397,2867.44,,PROVFERIAS 09/2024,,",
      "1,30092024,399,222,224.4,,PROVFGTSFERIAS 09/2024,,",
      "1,30092024,398,223,768.46,,PROVINSSFERIAS 09/2024,,",
    ],
  },
];

export default function TemplatesCatalog() {
  const [selected, setSelected] = useState<TemplateInfo | null>(null);

  return (
    <div className={regStyles.page}>
      <div className={regStyles.pageHeader}>
        <div className={regStyles.headingGroup}>
          <h1 className={regStyles.title}>Templates de Exportação</h1>
          <p className={regStyles.subtitle}>
            Formatos de arquivo suportados para geração de lançamentos contábeis.
          </p>
        </div>
      </div>

      {/* Template list */}
      <div className={regStyles.tableWrapper}>
        <table className={regStyles.table}>
          <thead>
            <tr>
              <th>Template</th>
              <th>Extensão</th>
              <th>Origem</th>
              <th>Descrição</th>
              <th className={regStyles.actionsCol}></th>
            </tr>
          </thead>
          <tbody>
            {TEMPLATES.map((tpl) => (
              <tr
                key={tpl.value}
                className={selected?.value === tpl.value ? styles.rowActive : undefined}
              >
                <td>
                  <span className={regStyles.badgePROV}>{tpl.label}</span>
                </td>
                <td>
                  <span className={regStyles.codeTag}>{tpl.extension}</span>
                </td>
                <td className={regStyles.muted}>{tpl.origin}</td>
                <td className={styles.descriptionCell}>
                  {tpl.description.split(".")[0]}.
                </td>
                <td className={regStyles.actions}>
                  <button
                    className={regStyles.btnIcon}
                    title={selected?.value === tpl.value ? "Fechar detalhes" : "Ver detalhes"}
                    onClick={() =>
                      setSelected(selected?.value === tpl.value ? null : tpl)
                    }
                  >
                    {selected?.value === tpl.value ? "▲" : "▼"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <span className={`${regStyles.badgePROV} ${styles.templateBadge}`}>
              {selected.label}
            </span>
            <span className={styles.extensionBadge}>{selected.extension}</span>
            <span className={regStyles.muted} style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
              Separador:{" "}
              <code className={styles.inlineCode}>
                {selected.separator === "," ? "vírgula (,)" : selected.separator}
              </code>
            </span>
          </div>

          <p className={styles.cardDescription}>{selected.description}</p>

          {/* Fields table */}
          <h3 className={styles.sectionTitle}>Campos por posição (CSV)</h3>
          <div className={regStyles.tableWrapper}>
            <table className={regStyles.table}>
              <thead>
                <tr>
                  <th style={{ width: "2.5rem" }}>#</th>
                  <th>Campo</th>
                  <th>Descrição</th>
                  <th>Exemplo</th>
                </tr>
              </thead>
              <tbody>
                {selected.fields.map((f) => (
                  <tr key={f.pos}>
                    <td className={regStyles.muted}>{f.pos}</td>
                    <td>
                      {f.name.startsWith("(") ? (
                        <span className={regStyles.muted}>{f.name}</span>
                      ) : (
                        <span className={regStyles.codeTag}>{f.name}</span>
                      )}
                    </td>
                    <td>{f.description}</td>
                    <td className={regStyles.muted}>
                      {f.example ? (
                        <code className={styles.inlineCode}>{f.example}</code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample output */}
          <h3 className={styles.sectionTitle}>Exemplo de saída real</h3>
          <pre className={styles.codeBlock}>{selected.sampleLines.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}
