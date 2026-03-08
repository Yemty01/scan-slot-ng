"use client";

import { ProviderSidebar } from "./sidebar";

export function ProviderDashboardShell({
  providerName,
  children,
}: {
  providerName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProviderSidebar providerName={providerName} />
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}
