import { getHealthStatus } from "@/application/health/get-health-status";
import UploadZone from "@/components/processing/upload-zone";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ProcessingPage() {
  const { status } = await getHealthStatus();
  const isApiOnline = status === "operational";

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Processamento</h1>
        <p className={styles.subtitle}>
          Importe os arquivos de folha de pagamento ou provisões para
          processamento contábil.
        </p>
      </div>
      <UploadZone isApiOnline={isApiOnline} />
    </div>
  );
}
