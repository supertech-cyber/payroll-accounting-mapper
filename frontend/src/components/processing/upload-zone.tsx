"use client";

import { useCallback, useRef, useState } from "react";
import { parsePayrollMirror } from "@/application/payroll/parse-payroll-mirror";
import {
  parse13thProvision,
  parseVacationProvision,
} from "@/application/provisions/parse-provisions";
import type { PayrollMirrorResult } from "@/domain/payroll/types";
import type { ProvisionsResult } from "@/domain/provisions/types";
import { useProcessing, type ImportType } from "@/app/processing-provider";
import ResultsView from "./results-view";
import styles from "./upload-zone.module.css";

const IMPORT_TYPES = [
  {
    key: "mirror" as ImportType,
    label: "Espelho de Folha",
    fileCount: 1,
    hint: "1 arquivo Excel (.xlsx ou .xlsm)",
  },
  {
    key: "13th" as ImportType,
    label: "Provisão 13º Salário",
    fileCount: 2,
    hint: "2 arquivos Excel de competências diferentes",
  },
  {
    key: "vacation" as ImportType,
    label: "Provisão de Férias",
    fileCount: 2,
    hint: "2 arquivos Excel de competências diferentes",
  },
];

interface Props {
  isApiOnline: boolean;
}

export default function UploadZone({ isApiOnline }: Props) {
  const { activeTab, setActiveTab, tabs, patchTab, resetTab } = useProcessing();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const tab = tabs[activeTab];
  const currentType = IMPORT_TYPES.find((t) => t.key === activeTab)!;
  const maxFiles = currentType.fileCount;

  const patch = useCallback(
    (update: Parameters<typeof patchTab>[1]) => patchTab(activeTab, update),
    [activeTab, patchTab],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const valid = Array.from(incoming).filter((f) =>
        /\.(xlsx|xlsm)$/i.test(f.name),
      );
      patch({ files: [...tab.files, ...valid].slice(0, maxFiles) });
    },
    [tab.files, maxFiles, patch],
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    patch({ status: "processing", errorMessage: null, result: null });
    try {
      if (activeTab === "mirror") {
        const data: PayrollMirrorResult = await parsePayrollMirror(
          tab.files[0],
        );
        patch({ status: "done", result: { kind: "mirror", data } });
      } else if (activeTab === "13th") {
        const data: ProvisionsResult = await parse13thProvision(
          tab.files[0],
          tab.files[1],
        );
        patch({ status: "done", result: { kind: "provision", data } });
      } else {
        const data: ProvisionsResult = await parseVacationProvision(
          tab.files[0],
          tab.files[1],
        );
        patch({ status: "done", result: { kind: "provision", data } });
      }
    } catch (err) {
      patch({
        status: "error",
        errorMessage:
          err instanceof Error ? err.message : "Erro inesperado ao processar.",
      });
    }
  };

  const handleReset = () => resetTab(activeTab);

  if (!isApiOnline) {
    return (
      <div className={styles.offline}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="#f87171"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <p className={styles.offlineTitle}>API indisponível</p>
          <p className={styles.offlineText}>
            O servidor de processamento está offline. Verifique se o backend
            está em execução em <code>uvicorn app.main:app --reload</code> e
            tente novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.typeSelector}>
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.key}
            className={styles.typeBtn}
            data-active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab.status !== "done" && (
        <div className={styles.uploadForm}>
          <div
            className={styles.dropzone}
            data-dragging={isDragging}
            data-disabled={tab.files.length >= maxFiles}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() =>
              tab.files.length < maxFiles && fileInputRef.current?.click()
            }
            role="button"
            tabIndex={0}
            aria-label="Área de envio de arquivos"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              multiple={maxFiles > 1}
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className={styles.dropIcon}
              aria-hidden
            >
              <path
                d="M12 3v13M7 8l5-5 5 5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <p className={styles.dropText}>
              {tab.files.length >= maxFiles
                ? "Limite de arquivos atingido"
                : maxFiles === 1
                  ? "Arraste o arquivo aqui ou clique para selecionar"
                  : `Arraste até ${maxFiles} arquivos aqui ou clique para selecionar`}
            </p>
            <p className={styles.dropHint}>{currentType.hint}</p>
          </div>

          {tab.files.length > 0 && (
            <ul className={styles.fileList}>
              {tab.files.map((f: File, i: number) => (
                <li key={i} className={styles.fileItem}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                      stroke="#818cf8"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2v6h6"
                      stroke="#818cf8"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={styles.fileName}>{f.name}</span>
                  <button
                    className={styles.removeBtn}
                    onClick={() =>
                      patch({ files: tab.files.filter((_f, idx) => idx !== i) })
                    }
                    aria-label={`Remover ${f.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab.status === "error" && tab.errorMessage && (
            <div className={styles.errorBox}>
              <span>⚠</span> {tab.errorMessage}
            </div>
          )}

          <button
            className={styles.submitBtn}
            disabled={
              tab.files.length < maxFiles || tab.status === "processing"
            }
            onClick={handleSubmit}
          >
            {tab.status === "processing" ? (
              <>
                <span className={styles.spinner} aria-hidden /> Processando…
              </>
            ) : (
              "Processar"
            )}
          </button>
        </div>
      )}

      {tab.status === "done" && tab.result && (
        <>
          <ResultsView result={tab.result} />
          <button className={styles.resetBtn} onClick={handleReset}>
            ← Novo processamento
          </button>
        </>
      )}
    </div>
  );
}
