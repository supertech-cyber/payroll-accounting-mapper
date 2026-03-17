import { fetchParsePayrollMirror } from "@/infrastructure/api/payroll-gateway";
import type { PayrollMirrorResult } from "@/domain/payroll/types";

export async function parsePayrollMirror(
  file: File,
): Promise<PayrollMirrorResult> {
  return fetchParsePayrollMirror(file);
}
