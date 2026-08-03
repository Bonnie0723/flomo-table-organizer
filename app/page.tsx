"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; text: string; status: "idle" | "sending" | "sent" | "failed"; error?: string };
type Format = "inline" | "lines" | "markdown";
type InputKind = "empty" | "plain" | "table";

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
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][], kind: "empty" as InputKind };
  const looksMarkdown = lines.filter((line) => line.includes("|")).length >= Math.min(2, lines.length);
  const hasTabs = lines.some((line) => line.includes("\t"));
  if (!looksMarkdown && !hasTabs) {
    return { headers: [] as string[], rows: [[raw.trim()]], kind: "plain" as InputKind };
  }
  const rows = lines.map((line) => looksMarkdown ? splitMarkdownRow(line) : line.split("\t").map(clean));
  const useful = rows.filter((row) => row.some(Boolean));
  const separator = (row: string[]) => row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
  const headers = useful[0] ?? [];
  return { headers, rows: useful.slice(1).filter((row) => !separator(row)), kind: "table" as InputKind };
}

function makeText(headers: string[], row: string[], format: Format) {
  const title = row[0] || "未命名";
  const fields = headers.slice(1).map((header, index) => ({ header: header || `第 ${index + 2} 列`, value: row[index + 1] || "—" }));
  if (format === "lines") return [title, ...fields.map(({ header, value }) => `${header}：${value}`)].join("\n");
  if (format === "markdown") return [`**${title}**`, ...fields.map(({ header, value }) => `- **${header}**：${value}`)].join("\n");
  return [title, ...fields.map(({ header, value }) => `${header}：${value}`)].join("｜");
}

async function postToFlomo(endpoint: string, content: string) {
  const body = new URLSearchParams({ content });
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
  if (!response.ok) throw new Error(`接口返回 ${response.status}`);
  const data = await response.json().catch(() => null);
  if (data && data.code != null && String(data.code) !== "0") throw new Error(data.message || data.msg || "Flomo 拒绝了请求");
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
    if (!endpoint.trim()) { setMessage("请先填入 Flomo API 地址"); return; }
    if (!targets.length) { setMessage("没有需要发送的内容"); return; }
    setSending(true); setMessage("");
    const content = parsed.kind === "plain"
      ? targets.map((item) => item.text).join("\n\n")
      : targets.map((item, index) => `${index + 1}. ${item.text}`).join("\n\n");
    setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "sending" } : item));
    try {
      await postToFlomo(endpoint, content);
      setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "sent", error: undefined } : item));
      setMessage(parsed.kind === "plain" ? "已将普通文字原样保存为 1 条 Flomo" : `已将 ${targets.length} 行编号后合并保存为 1 条 Flomo`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "发送失败";
      setItems((cur) => cur.map((item) => targets.some((t) => t.id === item.id) ? { ...item, status: "failed", error: reason } : item));
      setMessage(`发送失败：${reason}`);
    }
    setSending(false);
  }

  const failed = items.filter((item) => item.status === "failed");

  return (
    <main>
      <header className="topbar"><div className="brand"><span className="mark">F</span><div><strong>Flomo 整理器</strong><small>表格一粘，备忘录就绪</small></div></div><span className="local-pill">● 密钥仅存本机</span></header>
      <section className="hero"><p className="eyebrow">TABLE OR TEXT → ONE MEMO</p><h1>表格或文字，<br/><em>都能进入 Flomo。</em></h1><p>表格会自动按行编号并合并；普通文字会保留原来的段落和换行，直接发送为一条。</p></section>

      <div className="workspace">
        <section className="card input-card"><div className="section-title"><span>01</span><div><h2>粘贴表格或文字</h2><p>支持 Markdown、Excel / 飞书表格和普通文字</p></div></div><textarea aria-label="粘贴表格或文字内容" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="在这里粘贴表格或普通文字…" /><div className="input-meta"><span>{parsed.kind === "plain" ? "已识别为普通文字" : <>识别到 <b>{parsed.headers.length}</b> 列 · <b>{parsed.rows.length}</b> 行</>}</span><button onClick={() => setRaw("")} className="clear">清空</button></div></section>

        <section className="card settings-card"><div className="section-title"><span>02</span><div><h2>设置发送</h2><p>整张表格将编号并合并为 1 条 Flomo</p></div></div><label className="field"><span>Flomo API 地址</span><input type="password" value={endpoint} onChange={(e) => saveEndpoint(e.target.value)} placeholder="https://flomoapp.com/iwh/...”" autoComplete="off"/><small>完整 API 地址将保存在浏览器 localStorage，项目中不包含任何密钥。</small></label><div className="choice-grid"><fieldset><legend>每行内容格式</legend>{([["inline", "单行紧凑"], ["lines", "分行易读"], ["markdown", "Markdown"]] as const).map(([value,label]) => <label key={value}><input type="radio" name="format" checked={format === value} onChange={() => setFormat(value)}/><span>{label}</span></label>)}</fieldset></div></section>
      </div>

      <section className="preview"><div className="preview-head"><div><span className="step">03</span><h2>预览与编辑</h2></div><span>{parsed.kind === "plain" ? "普通文字 · 1 条" : `${items.length} 行 · 合并为 1 条`}</span></div>{parsed.headers.length > 0 && <div className="headers"><b>原表头</b>{parsed.headers.map((header, i) => <span key={`${header}-${i}`}>{header || `第 ${i + 1} 列`}</span>)}</div>}<div className="memo-list">{items.length ? items.map((item, index) => <article className={`memo ${item.status}`} key={item.id}><div className="memo-number">{parsed.kind === "plain" ? "文" : `${index + 1}.`}</div><textarea aria-label={parsed.kind === "plain" ? "编辑普通文字" : `编辑第 ${index + 1} 行内容`} value={item.text} onChange={(e) => updateItem(item.id, e.target.value)}/><div className="status">{item.status === "sent" ? "✓ 已发送" : item.status === "sending" ? "发送中…" : item.status === "failed" ? `! ${item.error}` : "可编辑"}</div></article>) : <div className="empty">粘贴表格或文字后，预览会出现在这里。</div>}</div></section>

      <div className="sendbar"><div><strong>{parsed.kind === "plain" ? "准备发送 1 条普通文字" : `准备将 ${items.filter(i => i.status !== "sent").length} 行合并为 1 条 Flomo`}</strong><span>{message || (parsed.kind === "plain" ? "保留原文和换行，不添加编号" : "发送时会自动加上 1. 2. 3. 编号")}</span></div><div className="send-actions">{failed.length > 0 && <button className="retry" disabled={sending} onClick={() => send(failed)}>重试发送</button>}<button className="send" disabled={sending || !items.length} onClick={() => send()}>{sending ? "正在发送…" : "发送到 Flomo ↗"}</button></div></div>
      <footer>你的表格内容只在本页处理 · 可离线打开 · 可添加到主屏幕</footer>
    </main>
  );
}

