"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestSyncPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/sync-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'techninja0210@gmail.com' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unknown error occurred');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to sync subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Sync Subscription Test</h1>
      
      <div className="bg-white rounded-lg border p-6 mb-6">
        <p className="text-gray-600 mb-4">
          Click the button below to sync the subscription for <strong>techninja0210@gmail.com</strong>
        </p>
        
        <Button
          onClick={handleSync}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? 'Syncing...' : 'Sync Subscription'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">❌ Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-green-800 font-semibold mb-4">✅ Success!</h3>
          
          {result.summary && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Summary:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Total: {result.summary.total}</li>
                <li>Success: {result.summary.success}</li>
                <li>Skipped: {result.summary.skipped}</li>
                <li>Errors: {result.summary.errors}</li>
              </ul>
            </div>
          )}

          {result.results && result.results.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Subscription Details:</h4>
              <pre className="bg-white p-4 rounded border overflow-auto text-sm">
                {JSON.stringify(result.results[0], null, 2)}
              </pre>
            </div>
          )}

          {!result.results && (
            <pre className="bg-white p-4 rounded border overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

