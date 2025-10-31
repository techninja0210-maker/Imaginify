"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface CreditUpdateFormProps {
  userId: string;
  clerkId: string;
  currentBalance: number;
  searchQuery: string;
}

export function CreditUpdateForm({ userId, clerkId, currentBalance, searchQuery }: CreditUpdateFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const creditDelta = Number(delta);
    if (!Number.isFinite(creditDelta) || creditDelta === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid credit amount.",
        variant: "destructive",
      });
      return;
    }

    if (!reason || reason.trim().length < 3) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason (minimum 3 characters).",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/update-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clerkId,
            delta: creditDelta,
            reason: reason.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update credits");
        }

        const newBalance = data.newBalance || (currentBalance + creditDelta);

        toast({
          title: "✅ Success",
          description: `Credits updated successfully. New balance: ${newBalance.toLocaleString()}`,
          className: "success-toast",
        });

        // Clear form
        setDelta("");
        setReason("");

        // Refresh data without full page reload
        router.refresh();
      } catch (error: any) {
        const errorMsg = error?.message || "Failed to update credits";
        toast({
          title: "❌ Error",
          description: errorMsg,
          variant: "destructive",
          className: "error-toast",
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Adjust Credits</label>
        <input
          type="number"
          step="1"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+50 or -10"
          required
          disabled={isPending}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason..."
          required
          minLength={3}
          maxLength={200}
          disabled={isPending}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Updating..." : "Update Credits"}
      </button>
    </form>
  );
}

