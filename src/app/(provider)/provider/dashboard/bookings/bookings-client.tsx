"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/types";
import { getAllowedNextStatuses } from "@/lib/booking";

export function BookingsFilterAndActions({ currentStatus }: { currentStatus?: string }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <select
        name="status"
        defaultValue={currentStatus ?? "all"}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="payment_pending">Payment pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="provider_confirmed">Provider confirmed</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="report_ready">Report ready</option>
        <option value="cancelled_patient">Cancelled (patient)</option>
        <option value="cancelled_provider">Cancelled (provider)</option>
        <option value="no_show">No show</option>
      </select>
      <Button type="submit" variant="secondary" size="sm">
        Filter
      </Button>
    </form>
  );
}

export function BookingsRowActionsClient({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const allowed = getAllowedNextStatuses(status as BookingStatus, "provider");

  const handleTransition = async (newStatus: BookingStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (allowed.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {allowed.map((s) => (
        <Button
          key={s}
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => handleTransition(s)}
        >
          {s.replace(/_/g, " ")}
        </Button>
      ))}
    </div>
  );
}
