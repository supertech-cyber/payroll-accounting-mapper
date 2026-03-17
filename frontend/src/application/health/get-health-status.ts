import { fetchHealthStatus } from "@/infrastructure/api/health-gateway";
import type { HealthStatus } from "@/domain/health/types";

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    return await fetchHealthStatus();
  } catch {
    return { status: "unavailable" };
  }
}
