const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchAllGEX() {
  const res = await fetch(`${BASE}/api/gex`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchGEXBySymbol(
  symbol,
  { strikes = 50, expiry = null } = {},
) {
  const params = new URLSearchParams({ strikes });
  if (expiry) params.set("expiry", expiry);
  const res = await fetch(`${BASE}/api/gex/${symbol}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchIntraday(symbol) {
  const res = await fetch(`${BASE}/api/gex/${symbol}/intraday`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed`);
  return res.json();
}

export async function fetchDealerRisk(symbol) {
  const res = await fetch(`${BASE}/api/dealer-risk/${symbol}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchFlowSignals(
  symbol,
  {
    windowMinutes = 240,
    minScore = 60,
    intent = null,
    structure = null,
    expiry = null,
    limit = 10,
  } = {},
) {
  const params = new URLSearchParams({
    window_minutes: windowMinutes,
    min_score: minScore,
    limit,
  });
  if (intent) params.set("intent", intent);
  if (structure) params.set("structure", structure);
  if (expiry) params.set("expiry", expiry);
  const res = await fetch(`${BASE}/api/flow/signals/${symbol}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchFlowSummary(
  symbol,
  { windowMinutes = 240, expiry = null } = {},
) {
  const params = new URLSearchParams({ window_minutes: windowMinutes });
  if (expiry) params.set("expiry", expiry);
  const res = await fetch(
    `${BASE}/api/flow/signals/${symbol}/summary?${params}`,
  );
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchFlowWatchlist(
  symbols,
  { windowMinutes = 240 } = {},
) {
  const params = new URLSearchParams({
    symbols: symbols.join(","),
    window_minutes: windowMinutes,
  });
  const res = await fetch(`${BASE}/api/flow/signals/watchlist?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchLeaderboard({ window = 60, n = 15 } = {}) {
  const params = new URLSearchParams({ window, n });
  const res = await fetch(`${BASE}/api/flow/leaderboard?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * Stream a chat turn as SSE events: {type, delta?/name?/message?}.
 * Uses fetch + ReadableStream because EventSource cannot POST a body.
 */
export async function streamChat({ sessionId, messages, model }, onEvent) {
  const body = { session_id: sessionId, messages }
  if (model) body.model = model

  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split("\n\n")
    buf = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith("data:")) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        onEvent(event)
      } catch {}
    }
  }
}
