"use client"

import React, { useState } from "react"

type ApiName = "developments" | "stands" | "payments" | "statement"

const endpoints: Record<ApiName, string> = {
  developments: "/api/developer/developments",
  stands: "/api/developer/stands",
  payments: "/api/developer/payments",
  statement: "/api/developer/statement",
}

async function fetchJson(path: string) {
  const res = await fetch(path, { cache: "no-store" })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export default function DeveloperDashboard() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function callApi(name: ApiName) {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await fetchJson(endpoints[name])
      setData(result)
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ margin: 0 }}>Developer Dashboard</h1>
      <p style={{ color: "#666" }}>Minimal dashboard to inspect developer APIs.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => callApi("developments")}>Load developments</button>
        <button onClick={() => callApi("stands")}>Load stands</button>
        <button onClick={() => callApi("payments")}>Load payments</button>
        <button onClick={() => callApi("statement")}>Load statement</button>
      </div>

      <div style={{ marginTop: 18 }}>
        {loading && <div>Loading…</div>}
        {error && (
          <pre style={{ color: "#b00020", whiteSpace: "pre-wrap" }}>{error}</pre>
        )}
        {data && (
          <div>
            <h3>Response</h3>
            <pre style={{ background: "#f6f8fa", padding: 12, borderRadius: 6, overflowX: "auto" }}>
              {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, color: "#444" }}>
        <small>Open <a href="/developer">/developer</a> in your browser (dev server must be running).</small>
      </div>
    </div>
  )
}
