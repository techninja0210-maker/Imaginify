"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function APITestPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function testEndpoint(name: string, method: string, url: string, body?: any) {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };

      if (body && method !== "GET") {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResults({ endpoint: name, method, url, response: data });
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">API Endpoints Test</h1>
      <p className="text-gray-600 mb-8">Test the new API endpoints</p>

      <div className="space-y-4">
        {/* Balance Endpoint */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">GET /api/me/balance</h2>
          <p className="text-sm text-gray-600 mb-3">Get your current credit balance</p>
          <Button
            onClick={() => testEndpoint("Balance", "GET", "/api/me/balance")}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Test Balance
          </Button>
        </div>

        {/* Ledger Endpoint */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">GET /api/me/ledger</h2>
          <p className="text-sm text-gray-600 mb-3">Get your credit transaction history</p>
          <Button
            onClick={() => testEndpoint("Ledger", "GET", "/api/me/ledger?limit=10")}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            Test Ledger
          </Button>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">GET /api/jobs</h2>
          <p className="text-sm text-gray-600 mb-3">List your jobs</p>
          <Button
            onClick={() => testEndpoint("Jobs List", "GET", "/api/jobs?limit=10")}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Test Jobs List
          </Button>
        </div>

        {/* Create Job from Quote */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">POST /api/jobs</h2>
          <p className="text-sm text-gray-600 mb-3">Create a job from a quote (locks quote + deducts credits)</p>
          <div className="space-y-3">
            <input
              type="text"
              id="quoteId"
              placeholder="Enter quote ID from /api/quote"
              className="w-full p-2 border rounded"
            />
            <Button
              onClick={() => {
                const quoteId = (document.getElementById("quoteId") as HTMLInputElement)?.value;
                if (!quoteId) {
                  alert("Please enter a quote ID");
                  return;
                }
                testEndpoint("Create Job", "POST", "/api/jobs", { quoteId });
              }}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Test Create Job
            </Button>
          </div>
        </div>

        {/* Get Quote */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">POST /api/quote</h2>
          <p className="text-sm text-gray-600 mb-3">Get a quote for a job</p>
          <div className="space-y-3">
            <select id="actionKey" className="w-full p-2 border rounded">
              <option value="text_to_video">Text → Video</option>
              <option value="image_to_video">Image → Video</option>
              <option value="product_video">Product Video</option>
            </select>
            <input
              type="number"
              id="units"
              placeholder="Units (e.g., 10)"
              defaultValue={10}
              className="w-full p-2 border rounded"
            />
            <Button
              onClick={() => {
                const actionKey = (document.getElementById("actionKey") as HTMLSelectElement)?.value;
                const units = Number((document.getElementById("units") as HTMLInputElement)?.value || 10);
                testEndpoint("Get Quote", "POST", "/api/quote", {
                  actionKey,
                  units,
                  parameters: { units }
                });
              }}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Test Get Quote
            </Button>
          </div>
        </div>

        {/* Job Callback (External Service) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">POST /api/jobs/callback</h2>
          <p className="text-sm text-gray-600 mb-3">Update job status (for external services like n8n) - Requires HMAC</p>
          <div className="space-y-3">
            <input
              type="text"
              id="callbackJobId"
              placeholder="Job ID"
              className="w-full p-2 border rounded"
            />
            <select id="callbackStatus" className="w-full p-2 border rounded">
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="text"
              id="callbackResultUrl"
              placeholder="Result URL (optional)"
              className="w-full p-2 border rounded"
            />
            <Button
              onClick={() => {
                const jobId = (document.getElementById("callbackJobId") as HTMLInputElement)?.value;
                const status = (document.getElementById("callbackStatus") as HTMLSelectElement)?.value;
                const resultUrl = (document.getElementById("callbackResultUrl") as HTMLInputElement)?.value;
                if (!jobId || !status) {
                  alert("Job ID and Status are required");
                  return;
                }
                // Note: This will fail without HMAC - just for UI testing
                testEndpoint("Job Callback", "POST", "/api/jobs/callback", {
                  jobId,
                  status,
                  resultUrl: resultUrl || undefined
                });
              }}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Test Callback (Will fail without HMAC)
            </Button>
            <p className="text-xs text-gray-500">Note: This endpoint requires HMAC signature. Use Postman/server-side for real testing.</p>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800">Loading...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 p-4 bg-red-50 rounded-lg">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {results && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Response from {results.endpoint}:</h3>
          <pre className="bg-white p-4 rounded border overflow-auto text-xs">
            {JSON.stringify(results.response, null, 2)}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            {results.method} {results.url}
          </p>
        </div>
      )}
    </div>
  );
}

