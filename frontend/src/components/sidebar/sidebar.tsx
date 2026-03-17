"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProcessing } from "@/app/processing-provider";
import styles from "./sidebar.module.css";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1v9M4.5 4.5 8 1l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1"
        y="3"
        width="14"
        height="2"
        rx="1"
        fill="currentColor"
        opacity=".5"
      />
      <rect
        x="1"
        y="7"
        width="14"
        height="2"
        rx="1"
        fill="currentColor"
        opacity=".5"
      />
      <rect
        x="1"
        y="11"
        width="10"
        height="2"
        rx="1"
        fill="currentColor"
        opacity=".5"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="4"
        width="12"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 14v-4h4v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 7h1M10 7h1M5 10h1M10 10h1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 2v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1v9M4.5 9.5 8 13l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconTemplate() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 5h6M5 8h6M5 11h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MAIN_ITEMS: NavItem[] = [
  { label: "Processamento", href: "/", icon: <IconUpload /> },
  { label: "Exportar", href: "/exportar", icon: <IconDownload /> },
];

const REGISTRY_ITEMS: NavItem[] = [
  { label: "Eventos", href: "/eventos", icon: <IconList /> },
  { label: "Empresas", href: "/empresas", icon: <IconBuilding /> },
  {
    label: "Centros de Custo",
    href: "/centros-de-custo",
    icon: <IconFolder />,
  },
  { label: "Tags / Grupos", href: "/tags", icon: <IconTag /> },
  { label: "Templates", href: "/templates", icon: <IconTemplate /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { tabs } = useProcessing();
  const hasData = Object.values(tabs).some((t) => t.status === "done");

  return (
    <aside className={styles.sidebar}>
      <nav>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Principal</span>
          {MAIN_ITEMS.map((item) => {
            const isExport = item.href === "/exportar";
            const disabled = isExport && !hasData;
            if (disabled) {
              return (
                <span
                  key={item.href}
                  className={styles.navItem}
                  data-disabled="true"
                  title="Processe um arquivo primeiro para habilitar a exportação"
                  style={{ opacity: 0.4, cursor: "default" }}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.navItem}
                data-active={pathname === item.href}
              >
                <span className={styles.icon}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Cadastros</span>
          {REGISTRY_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navItem}
              data-active={pathname === item.href}
            >
              <span className={styles.icon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
