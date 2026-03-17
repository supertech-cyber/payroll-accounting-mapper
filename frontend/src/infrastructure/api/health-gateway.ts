import type { HealthStatus } from "@/domain/health/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const res = await fetch(`${API_URL}/api/v1/health`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return { status: "unavailable" };
  }

  const data: { status: string } = await res.json();
  return { status: data.status === "ok" ? "operational" : "unavailable" };
}
