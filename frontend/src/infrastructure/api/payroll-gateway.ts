import type { PayrollMirrorResult } from "@/domain/payroll/types";
import type { ProvisionsResult } from "@/domain/provisions/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Erro HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchParsePayrollMirror(
  file: File,
): Promise<PayrollMirrorResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/v1/imports/payroll-mirror/parse`, {
    method: "POST",
    body: form,
  });
  return handleResponse<PayrollMirrorResult>(res);
}

export async function fetchParse13thProvision(
  fileA: File,
  fileB: File,
): Promise<ProvisionsResult> {
  const form = new FormData();
  form.append("file_a", fileA);
  form.append("file_b", fileB);
  const res = await fetch(
    `${BASE}/api/v1/imports/payroll-provisions/13th/parse`,
    { method: "POST", body: form },
  );
  return handleResponse<ProvisionsResult>(res);
}

export async function fetchParseVacationProvision(
  fileA: File,
  fileB: File,
): Promise<ProvisionsResult> {
  const form = new FormData();
  form.append("file_a", fileA);
  form.append("file_b", fileB);
  const res = await fetch(
    `${BASE}/api/v1/imports/payroll-provisions/vacation/parse`,
    { method: "POST", body: form },
  );
  return handleResponse<ProvisionsResult>(res);
}
