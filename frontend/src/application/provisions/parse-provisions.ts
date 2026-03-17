import {
  fetchParse13thProvision,
  fetchParseVacationProvision,
} from "@/infrastructure/api/payroll-gateway";
import type { ProvisionsResult } from "@/domain/provisions/types";

export async function parse13thProvision(
  fileA: File,
  fileB: File,
): Promise<ProvisionsResult> {
  return fetchParse13thProvision(fileA, fileB);
}

export async function parseVacationProvision(
  fileA: File,
  fileB: File,
): Promise<ProvisionsResult> {
  return fetchParseVacationProvision(fileA, fileB);
}
