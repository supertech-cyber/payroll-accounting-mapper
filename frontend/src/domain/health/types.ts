export type ApiStatus = "operational" | "unavailable";

export interface HealthStatus {
  status: ApiStatus;
}
