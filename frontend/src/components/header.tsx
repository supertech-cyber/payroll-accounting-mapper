import { getHealthStatus } from "@/application/health/get-health-status";
import styles from "./header.module.css";

export default async function Header() {
  const { status } = await getHealthStatus();
  const isOperational = status === "operational";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.title}>Mapeador Contábil da Folha</span>
        <div className={styles.badge} data-status={status}>
          <span className={styles.dot} />
          <span className={styles.label}>
            API {isOperational ? "Operacional" : "Indisponível"}
          </span>
        </div>
      </div>
    </header>
  );
}
