import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, ThumbsDown, ThumbsUp, Send, Paperclip } from "lucide-react";
import api from "../api/axios";
import { RAG_QUERY_URL, RAG_FEEDBACK_URL, RAG_HEALTH_URL } from "../constants/apiEndpoints";

interface RetrievedDoc {
  content?: string;
  source?: string;
  score?: number;
}

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  latencyMs?: number;
  insightId?: string;
  sources?: RetrievedDoc[];
  feedback?: 1 | -1 | null;
  expandedSources?: boolean;
}

export default function RAGTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Health check on mount
  useEffect(() => {
    api
      .get(RAG_HEALTH_URL)
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const t0 = performance.now();
    try {
      const { data } = await api.post(RAG_QUERY_URL, { query });
      const latencyMs = Math.round(performance.now() - t0);

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        text: data.answer ?? data.response ?? data.result ?? JSON.stringify(data),
        latencyMs,
        insightId: data.insightId,
        sources: data.provenance?.retrievedDocs ?? data.sources ?? [],
        feedback: null,
        expandedSources: false,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: err?.response?.data?.error ?? "Something went wrong. Please try again.",
          latencyMs: Math.round(performance.now() - t0),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (msgId: string, insightId: string | undefined, rating: 1 | -1) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m))
    );
    if (!insightId) return;
    try {
      await api.post(RAG_FEEDBACK_URL, { insightId, rating });
    } catch {
      // silent — feedback is best-effort
    }
  };

  const toggleSources = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, expandedSources: !m.expandedSources } : m))
    );
  };

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 min-h-0">

        {/* Header */}
        <header className="flex items-center justify-between rounded-3xl border border-slate-200/80 bg-white/80 px-6 py-4 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2ec866]/20 border border-[#2ec866]/40">
              <Bot size={20} className="text-[#2ec866]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-[#2ec866]">LogiCore</p>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">AI Assistant / RAG Tester</h1>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold border ${
              online === null
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : online
                ? "bg-[#2ec866]/15 text-[#1aab52] border-[#2ec866]/30"
                : "bg-rose-100 text-rose-600 border-rose-200"
            }`}
          >
            {online === null ? "Checking…" : online ? "● Online" : "● Offline"}
          </span>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.20)] backdrop-blur min-h-0">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 select-none">
              <Bot size={40} className="opacity-30" />
              <p className="text-sm font-medium">Ask anything about your logistics operations.</p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#0f172a] text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* AI message meta */}
                  {msg.role === "ai" && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      {msg.latencyMs !== undefined && (
                        <span className="text-[10px] text-slate-400">⏱ {msg.latencyMs}ms</span>
                      )}

                      {/* Sources toggle */}
                      {msg.sources && msg.sources.length > 0 && (
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                          {msg.expandedSources ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {msg.sources.length} source{msg.sources.length !== 1 ? "s" : ""}
                        </button>
                      )}

                      {/* Feedback */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => submitFeedback(msg.id, msg.insightId, 1)}
                          disabled={msg.feedback !== null && msg.feedback !== undefined}
                          className={`rounded-lg p-1 transition-colors ${
                            msg.feedback === 1
                              ? "text-[#2ec866] bg-[#2ec866]/15"
                              : "text-slate-400 hover:text-[#2ec866] hover:bg-[#2ec866]/10"
                          } disabled:cursor-default`}
                          title="Helpful"
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button
                          onClick={() => submitFeedback(msg.id, msg.insightId, -1)}
                          disabled={msg.feedback !== null && msg.feedback !== undefined}
                          className={`rounded-lg p-1 transition-colors ${
                            msg.feedback === -1
                              ? "text-rose-500 bg-rose-100"
                              : "text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          } disabled:cursor-default`}
                          title="Not helpful"
                        >
                          <ThumbsDown size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sources accordion */}
                  {msg.role === "ai" && msg.expandedSources && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Retrieved Sources</p>
                      {msg.sources.map((doc, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-900 truncate">{doc.source ?? `Document ${i + 1}`}</span>
                            {doc.score !== undefined && (
                              <span className="shrink-0 rounded-full bg-[#2ec866]/15 px-2 py-0.5 text-[10px] font-bold text-[#1aab52]">
                                {(doc.score * 100).toFixed(0)}% match
                              </span>
                            )}
                          </div>
                          {doc.content && (
                            <p className="text-slate-500 line-clamp-3">{doc.content}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-100 px-4 py-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.20)] backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about shipments, incidents, fleet status…"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-[#2ec866] focus:ring-2 focus:ring-[#2ec866]/20 transition-all"
              style={{ maxHeight: 120, overflowY: "auto" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-white transition-all hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send (Enter)"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-slate-400">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
