"use client";

import { useState } from "react";

export default function PingPage() {
  const [path, setPath] = useState("/ping");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("{\n  \n}");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function runPing() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const payload = {
        path,
        method,
        body: body.trim() ? JSON.parse(body) : undefined,
      };
      const res = await fetch(`/api/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">API Ping</h1>
      <p className="mt-2 text-sm text-gray-600">
        This calls a server-side Next route which pings the backend using your
        configured base URL.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="path">
          Path (relative to base URL)
        </label>
        <div className="flex gap-2">
          <input
            id="path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="/ping"
          />
          <button
            onClick={runPing}
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Pinging..." : "Ping"}
          </button>
        </div>
        <div className="text-xs text-gray-500">
          Examples: <code>/ping</code>, <code>/health</code>, <code>/swagger</code>
        </div>
        <label className="text-sm font-medium text-gray-700" htmlFor="method">
          Method
        </label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-40 rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <label className="text-sm font-medium text-gray-700" htmlFor="body">
          JSON Body (optional)
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono"
          placeholder='{\n  "email": "user@example.com",\n  "password": "password"\n}'
        />
      </div>

      {error ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <pre className="mt-6 overflow-auto rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800">
          {result}
        </pre>
      ) : null}
    </div>
  );
}
