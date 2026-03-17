import type { Metadata } from "next";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar/sidebar";
import { ProcessingProvider } from "./processing-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapeador Contábil da Folha",
  description: "Sistema de mapeamento contábil de folha de pagamento",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <ProcessingProvider>
          <div className="shell">
            <Sidebar />
            <main className="shell-content">{children}</main>
          </div>
        </ProcessingProvider>
      </body>
    </html>
  );
}
