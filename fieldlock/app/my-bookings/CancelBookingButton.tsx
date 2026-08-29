"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this booking? The slot will be released to the waitlist.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        toast("success", "Booking Cancelled", "Slot released to waitlist.");
        router.refresh();
      } else {
        toast("error", "Failed to cancel", data.error || "Something went wrong.");
      }
    } catch {
      toast("error", "Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-medium"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      Cancel Booking
    </button>
  );
}
