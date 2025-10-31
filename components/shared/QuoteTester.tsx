"use client";

import { useState } from "react";

const actions = [
  { key: "text_to_video", label: "Text → Video" },
  { key: "image_to_video", label: "Image → Video" },
  { key: "product_video", label: "Product Video" },
];

export default function QuoteTester() {
  const [actionKey, setActionKey] = useState(actions[0].key);
  const [units, setUnits] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function getQuote() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionKey, units, parameters: { units } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch quote");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="p-14-medium text-dark-600">Action</label>
          <select
            className="mt-1 w-full rounded-md border p-2"
            value={actionKey}
            onChange={(e) => setActionKey(e.target.value)}
          >
            {actions.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="p-14-medium text-dark-600">Units</label>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border p-2"
            min={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          />
        </div>
        <button
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={getQuote}
          disabled={loading}
        >
          {loading ? "Calculating..." : "Get Quote"}
        </button>
      </div>
      {error && <div className="mt-3 rounded-md bg-rose-50 p-3 text-rose-700">{error}</div>}
      {result && (
        <div className="mt-3 rounded-md bg-emerald-50 p-3 text-emerald-800">
          <div className="p-16-medium">Total Credits: <span className="font-semibold">{result.totalCredits}</span></div>
          <div className="p-14-regular opacity-80">Expires: {new Date(result.expiresAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}


