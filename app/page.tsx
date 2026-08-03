"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; text: string; status: "idle" | "sending" | "sent" | "failed"; error?: string };
type Format = "inline" | "lines" | "markdown";

function clean(value: string) {
  return value.trim().replace(/^\*\*([\s\S]*?)\*\*$/, "$1").replace(/<br\s*\/?>/gi, "\n");
}

function splitMarkdownRow(line: string) {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of source) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "|") { cells.push(clean(current)); current = ""; continue; }
    current += char;
  }
  cells.push(clean(current));
  return cells;
}

function parseTable(raw: string) {
  const lines = raw.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  const looksMarkdown = lines.filter((line) => line.includes("|")).length >= Math.min(2, lines.length);
  const rows = lines.map((line) => looksMarkdown ? splitMarkdownRow(line) : line.split("\t").map(clean));
  const useful = rows.filter((row) => row.some(Boolean));
  const separator = (row: string[]) => row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
  const headers = useful[0] ?? [];
  return { headers, rows: useful.slice(1).filter((row) => !separator(row)) };
}

function makeText(headers: string[], row: string[], format: Format) {
  const title = row[0] || "鏈懡鍚?;
  const fields = headers.slice(1).map((header, index) => ({ header: header || `绗?${index + 2} 鍒梎, value: row[index + 1] || "鈥? }));
  if (format === "lines") return [title, ...fields.map(({ header, value }) => `${header}锛?{value}`)].join("\n");
  if (format === "markdown") return [`**${title}**`, ...fields.map(({ header, value }) => `- **${header}**锛?{value}`)].join("\n");
  return [title, ...fields.map(({ header, value }) => `${header}锛?{value}`)].join("锝?);
}

async function postToFlomo(endpoint: string, content: string) {
  const body = new URLSearchParams({ content });
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
  if (!response.ok) throw new Error(`鎺ュ彛杩斿洖 ${response.status}`);
  const data = await response.json().catch(() => null);
  if (data && data.code != null && String(data.code) !== "0") throw new Error(data.message || data.msg || "Flomo 鎷掔粷浜嗚姹?);
}

export default function Home() {
  const [raw, setRaw] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [format, setFormat] = useState<Format>("inline");
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const parsed = useMemo(() => parseTable(raw), [raw]);

  useEffect(() => {
    queueMicrotask(() => setEndpoint(localStorage.getItem("flomo-api-endpoint") || ""));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const next = parsed.rows.map((row, i) => ({ id: `${i}-${row.join("-")}`, text: makeText(parsed.headers, row, format), status: "idle" as const }));
    queueMicrotask(() => setItems(next));
  }, [parsed, format]);

  function saveEndpoint(value: string) {
    setEndpoint(value);
    localStorage.setItem("flomo-api-endpoint", value);
  }

  function updateItem(id: string, text: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, text, status: "idle", error: undefined } : item));
  }

  async function send(targets = items.filter((item) => item.status !== "sent")) {
    if (!endpoint.trim()) { setMessage("璇峰厛濉叆 Flomo API 鍦板潃"); return; }
    if (!targets.length) { setMessage("娌℃湁闇€瑕佸彂閫佺殑鍐呭"); return; }
    setSending(true); setMessage("");
    const content = targets.map((item, index) => `${index + 1}. ${item.text}`).join("\n\n");
    setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "sending" } : item));
    try {
      await postToFlomo(endpoint, content);
      setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "sent", error: undefined } : item));
      setMessage(`宸插皢 ${targets.length} 琛岀紪鍙峰悗鍚堝苟淇濆瓨涓?1 鏉?Flomo`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "鍙戦€佸け璐?;
      setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "failed", error: reason } : item));
      setMessage(`鍙戦€佸け璐ワ細${reason}`);
    }
    setSending(false);
  }

  const failed = items.filter((item) => item.status === "failed");

  return (
    <main>
      <header className="topbar"><div className="brand"><span className="mark">F</span><div><strong>Flomo 鏁寸悊鍣?/strong><small>琛ㄦ牸涓€绮橈紝澶囧繕褰曞氨缁?/small></div></div><span className="local-pill">鈼?瀵嗛挜浠呭瓨鏈満</span></header>
      <section className="hero"><p className="eyebrow">TABLE 鈫?ONE MEMO</p><h1>鎶婃暣寮犺〃鏍硷紝<br/><em>鍚堟垚涓€鏉?Flomo銆?/em></h1><p>绮樿创 Markdown 鎴?Excel 琛ㄦ牸锛岃嚜鍔ㄦ寜琛岀紪鍙峰苟鍚堝苟銆傚彂閫佸墠锛屾瘡涓€琛岄兘鍙互妫€鏌ュ拰淇敼銆?/p></section>

      <div className="workspace">
        <section className="card input-card"><div className="section-title"><span>01</span><div><h2>绮樿创琛ㄦ牸</h2><p>鏀寔 Markdown 绔栫嚎涓?Excel / 椋炰功鍒惰〃绗?/p></div></div><textarea aria-label="绮樿创琛ㄦ牸鍐呭" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="鍦ㄨ繖閲岀矘璐翠綘鐨勮〃鏍尖€? /><div className="input-meta"><span>璇嗗埆鍒?<b>{parsed.headers.length}</b> 鍒?路 <b>{parsed.rows.length}</b> 鏉?/span><button onClick={() => setRaw("")} className="clear">娓呯┖</button></div></section>

        <section className="card settings-card"><div className="section-title"><span>02</span><div><h2>璁剧疆鍙戦€?/h2><p>鏁村紶琛ㄦ牸灏嗙紪鍙峰苟鍚堝苟涓?1 鏉?Flomo</p></div></div><label className="field"><span>Flomo API 鍦板潃</span><input type="password" value={endpoint} onChange={(e) => saveEndpoint(e.target.value)} placeholder="https://flomoapp.com/iwh/...鈥? autoComplete="off"/><small>瀹屾暣 API 鍦板潃灏嗕繚瀛樺湪娴忚鍣?localStorage锛岄」鐩腑涓嶅寘鍚换浣曞瘑閽ャ€?/small></label><div className="choice-grid"><fieldset><legend>姣忚鍐呭鏍煎紡</legend>{([["inline", "鍗曡绱у噾"], ["lines", "鍒嗚鏄撹"], ["markdown", "Markdown"]] as const).map(([value,label]) => <label key={value}><input type="radio" name="format" checked={format === value} onChange={() => setFormat(value)}/><span>{label}</span></label>)}</fieldset></div></section>
      </div>

      <section className="preview"><div className="preview-head"><div><span className="step">03</span><h2>棰勮涓庣紪杈?/h2></div><span>{items.length} 琛?路 鍚堝苟涓?1 鏉?/span></div>{parsed.headers.length > 0 && <div className="headers"><b>鍘熻〃澶?/b>{parsed.headers.map((header, i) => <span key={`${header}-${i}`}>{header || `绗?${i + 1} 鍒梎}</span>)}</div>}<div className="memo-list">{items.length ? items.map((item, index) => <article className={`memo ${item.status}`} key={item.id}><div className="memo-number">{index + 1}.</div><textarea aria-label={`缂栬緫绗?${index + 1} 琛屽唴瀹筦} value={item.text} onChange={(e) => updateItem(item.id, e.target.value)}/><div className="status">{item.status === "sent" ? "鉁?宸插彂閫? : item.status === "sending" ? "鍙戦€佷腑鈥? : item.status === "failed" ? `! ${item.error}` : "鍙紪杈?}</div></article>) : <div className="empty">绮樿创琛ㄦ牸鍚庯紝鏁寸悊濂界殑鍐呭浼氬嚭鐜板湪杩欓噷銆?/div>}</div></section>

      <div className="sendbar"><div><strong>鍑嗗灏?{items.filter(i => i.status !== "sent").length} 琛屽悎骞朵负 1 鏉?Flomo</strong><span>{message || "鍙戦€佹椂浼氳嚜鍔ㄥ姞涓?1. 2. 3. 缂栧彿"}</span></div><div className="send-actions">{failed.length > 0 && <button className="retry" disabled={sending} onClick={() => send(failed)}>閲嶈瘯鍙戦€?/button>}<button className="send" disabled={sending || !items.length} onClick={() => send()}>{sending ? "姝ｅ湪鍙戦€佲€? : "鍚堝苟鍙戦€佸埌 Flomo 鈫?}</button></div></div>
      <footer>浣犵殑琛ㄦ牸鍐呭鍙湪鏈〉澶勭悊 路 鍙绾挎墦寮€ 路 鍙坊鍔犲埌涓诲睆骞?/footer>
    </main>
  );
}

