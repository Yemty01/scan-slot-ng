"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/provider/dashboard", label: "Overview" },
  { href: "/provider/dashboard/profile", label: "Profile" },
  { href: "/provider/dashboard/branches", label: "Branches" },
  { href: "/provider/dashboard/services", label: "Services" },
  { href: "/provider/dashboard/availability", label: "Availability" },
  { href: "/provider/dashboard/bookings", label: "Bookings" },
  { href: "/provider/dashboard/reports", label: "Reports" },
];

export function ProviderSidebar({
  providerName,
}: {
  providerName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div className="p-4 border-b">
        <p className="font-semibold truncate" title={providerName}>
          {providerName}
        </p>
        <p className="text-xs text-muted-foreground">Provider dashboard</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}
