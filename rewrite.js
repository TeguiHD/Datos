const fs = require('fs');

const code = `'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Bot, ChevronDown, Loader2, Plus, SendHorizonal, 
  Sparkles, X, Activity, BarChart3, ArrowRight,
  CalendarDays, Filter, ChevronRight, MessageSquare
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import type { ExecutionRow } from '@/lib/types';
import Link from 'next/link';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  at: number;
  meta?: {
    model: string;
    latencyMs: number;
    parser?: 'llm' | 'heuristic';
    count: number;
    mode: 'executions';
    filter?: Record<string, unknown>;
    rows?: ExecutionRow[];
  };
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

interface AiResult {
  filter: Record<string, unknown>;
  mode: 'executions';
  count: number;
  rows: ExecutionRow[];
  _meta: { model: string; latencyMs: number; parser?: 'llm' | 'heuristic' };
}

const STORAGE_KEY = 'datos-copilot-v4-dark';
const QUICK_PROMPTS = [
  'Próximas Vencidas',
  'Plan Manto. Anuales',
  'Preventivos Mayo',
];

export function FloatingAiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const latestMeta = useMemo(() => {
    if (!activeSession) return null;
    for (let i = activeSession.messages.length - 1; i >= 0; i -= 1) {
      if (activeSession.messages[i]?.meta) return activeSession.messages[i].meta;
    }
    return null;
  }, [activeSession]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        if (parsed.length > 0) {
          setSessions(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
          setActiveId(parsed[0].id);
          setHydrated(true);
          return;
        }
      }
    } catch {}
    const initial = { id: crypto.randomUUID(), title: 'Nuevo Análisis', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    setSessions([initial]);
    setActiveId(initial.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions, hydrated]);

  const ask = useMutation({
    mutationFn: ({ prompt }: { prompt: string; sessionId: string }) =>
      api<AiResult>('/api/ai/search', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
    onSuccess: (result, vars) => {
      appendMessageToSession(vars.sessionId, 'user', vars.prompt);
      appendMessageToSession(
        vars.sessionId,
        'assistant',
        result.count === 0 ? 'No encontré coincidencias para esos filtros.' : \`El reporte fue generado con éxito (\${result.count} tareas).\`,
        {
          model: result._meta.model,
          latencyMs: result._meta.latencyMs,
          parser: result._meta.parser,
          count: result.count,
          mode: result.mode,
          rows: result.rows,
          filter: result.filter,
        }
      );
      setInput('');
    },
    onError: (error, vars) => {
      appendMessageToSession(vars.sessionId, 'user', vars.prompt);
      const msg = error instanceof ApiError
          ? \`Error \${error.status}: \${(error.body as any)?.message ?? error.message}\`
          : 'Sistema inalcanzable. Intenta nuevamente.';
      appendMessageToSession(vars.sessionId, 'assistant', msg);
    },
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [activeSession?.messages.length, ask.isPending, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || !activeSession || ask.isPending) return;
    ask.mutate({ prompt, sessionId: activeSession.id });
  };

  const createNewSession = () => {
    const next = { id: crypto.randomUUID(), title: 'Nuevo Análisis', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    setSessions([next, ...sessions].slice(0, 15));
    setActiveId(next.id);
    setInput('');
  };

  const appendMessageToSession = (sessionId: string, role: Role, text: string, meta?: ChatMessage['meta']) => {
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sessionId) return s;
      const nm: ChatMessage = { id: crypto.randomUUID(), role, text, at: Date.now(), meta };
      const nextTitle = s.messages.length === 0 && role === 'user' ? text.slice(0, 30) : s.title;
      return { ...s, title: nextTitle, updatedAt: Date.now(), messages: [...s.messages, nm].slice(-50) };
    }).sort((a, b) => b.updatedAt - a.updatedAt));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={\`fixed bottom-6 right-6 z-40 group flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f172a] text-white shadow-2xl transition-all duration-500 hover:scale-105 active:scale-95 \${open ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}\`}
      >
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-brand-600/50 to-purple-600/50 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1e293b] to-[#0f172a] shadow-[inset_0_1px_rgba(255,255,255,0.2)]" />
        <Bot className="relative z-10 h-7 w-7 text-brand-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
        <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#0f172a] bg-brand-500 animate-pulse" />
      </button>

      {/* OVERLAY & DRAWER */}
      <div className={\`fixed inset-0 z-50 transition-all duration-500 \${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}\`}>
        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        
        <div className={\`absolute top-0 right-0 h-full w-full sm:w-[480px] bg-[#0c1222] border-l border-white/10 shadow-2xl transform transition-transform duration-500 ease-out flex flex-col \${open ? 'translate-x-0' : 'translate-x-full'}\`}>
          
          {/* HEADER */}
          <div className="relative px-6 py-5 shrink-0 bg-gradient-to-b from-[#1e293b]/80 to-[#0c1222] border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 shadow-[inset_0_1px_rgba(255,255,255,0.3)]">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Copilot de Mantención</h2>
                  <p className="text-[12px] font-medium text-brand-300">
                    {latestMeta?.model ? \`Modelo activo: \${latestMeta.model}\` : 'Asistente de Inteligencia Automática'}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={activeId ?? ''}
                  onChange={(e) => setActiveId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-700/50 bg-[#1e293b] px-3.5 py-2 pl-9 pr-8 text-[13px] font-semibold text-slate-200 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <button
                onClick={createNewSession}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-slate-300 hover:bg-brand-600 hover:text-white transition-colors border border-slate-700/50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* CHAT AREA */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar scroll-smooth bg-[#0a0f1c] space-y-6">
            {!activeSession?.messages.length ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-80 fade-up px-4">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-[0_0_30px_rgba(56,189,248,0.15)]">
                  <Bot className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-200">¿Qué planeamos hoy?</h3>
                <p className="mt-2 text-[13px] font-medium text-slate-400 max-w-[280px]">
                  Pregúntame sobre frecuencias mensuales, proyecciones de horas hombre o disponibilidad de equipos.
                </p>
                <div className="mt-8 flex flex-col gap-2 w-full">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q} onClick={() => setInput(q)} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-[#1e293b]/50 px-4 py-3 text-left text-[13px] font-medium text-slate-300 transition-colors hover:bg-[#1e293b] hover:text-white">
                      <span>{q}</span>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeSession.messages.map(m => <MessageBubble key={m.id} message={m} />)
            )}
            
            {ask.isPending && (
              <div className="flex w-full flex-col items-start fade-up">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1e293b]/60 border border-slate-800">
                  <Bot className="h-4 w-4 text-brand-400 animate-pulse" />
                  <span className="text-[13px] font-medium text-slate-400 animate-pulse">
                    Computando parámetros de red...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* INPUT AREA */}
          <div className="shrink-0 border-t border-white/5 bg-[#0c1222] p-4 pb-6">
            <form onSubmit={submit} className="relative flex items-center rounded-2xl border border-slate-700 bg-[#1e293b] p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Envía tu consulta o comando..."
                className="w-full bg-transparent px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-500 font-medium"
              />
              <button
                type="submit"
                disabled={ask.isPending || input.trim().length === 0}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-[inset_0_1px_rgba(255,255,255,0.2)]"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </form>
          </div>
          
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const m = message.meta;

  return (
    <div className={\`flex w-full flex-col \${isUser ? 'items-end' : 'items-start'} fade-up\`}>
      <div
        className={\`relative max-w-[90%] whitespace-pre-wrap px-4 py-3 text-[14px] font-medium leading-relaxed \${
          isUser 
            ? 'rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-600 to-purple-600 text-white shadow-[0_4px_15px_rgba(56,189,248,0.2)] selection:bg-white/30' 
            : 'rounded-2xl rounded-tl-sm bg-[#1e293b] border border-slate-800 text-slate-200 selection:bg-brand-500/30'
        }\`}
      >
        <p>{message.text}</p>

        {m?.rows && m.rows.length > 0 && (
          <div className="mt-4 w-full rounded-xl bg-[#0a0f1c]/80 border border-slate-800/80 p-4 shadow-inner">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-[12px] font-bold text-brand-400 tracking-wide uppercase">
                <BarChart3 className="h-4 w-4" /> HH Proyectadas
              </h4>
              <span className="rounded-md bg-brand-500/10 px-2 py-1 text-[10px] font-bold text-brand-300 border border-brand-500/20">
                {m.count} ACT.
              </span>
            </div>
            
            <div className="h-40 w-full -ml-4 mb-4">
              <ReportChart rows={m.rows} />
            </div>

            {m.filter && (
              <div className="mb-3 border-t border-b border-slate-800/60 py-3">
                <Link
                  href={\`/dashboard?\${new URLSearchParams((m.filter || {}) as Record<string, string>).toString()}\`}
                  className="group flex w-full items-center justify-between rounded-lg bg-brand-600/10 px-4 py-2.5 text-[12px] font-bold text-brand-400 border border-brand-500/20 hover:bg-brand-600/20 hover:border-brand-500/40 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" /> Aplicar filtros a Tabla Base
                  </span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            )}
            
            <div className="max-h-[220px] overflow-y-auto rounded-lg border border-slate-800 bg-[#0a0f1c] custom-scrollbar">
              <table className="w-full text-left text-[11px] whitespace-nowrap">
                <thead className="sticky top-0 bg-[#0f172a] text-slate-400 z-10 shadow-md">
                  <tr>
                    <th className="px-3 py-2 font-semibold">TKT</th>
                    <th className="px-3 py-2 font-semibold">EQUIPO / DETALLE</th>
                    <th className="px-3 py-2 font-semibold text-right">HH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                  {m.rows.slice(0, 100).map(r => {
                    const d = new Date(r.dueDate);
                    const y = d.getUTCFullYear();
                    const mn = String(d.getUTCMonth() + 1).padStart(2, '0');
                    return (
                      <tr key={r.id} className="hover:bg-[#1e293b]/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="text-slate-500 font-mono">{y}-{mn}</span>
                        </td>
                        <td className="px-3 py-2.5 truncate max-w-[140px] text-slate-200" title={r.task.descPosicionMant ?? r.task.denomObjetoTecnico ?? ''}>
                          {r.task.descPosicionMant ?? r.task.denomObjetoTecnico ?? 'Sin denom'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-brand-300 flex-shrink-0">
                          {Number(r.hhPlanned).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {m.count > 100 && (
              <p className="mt-2 text-center text-[10px] text-slate-500">Mostrando top 100 resultados útiles.</p>
            )}
          </div>
        )}

        {!isUser && m && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-500 font-mono">
            <span className="truncate pr-2" title={m.model}>🤖 {m.model} ({m.latencyMs}ms)</span>
            <span className="shrink-0 uppercase bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
              {m.parser}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportChart({ rows }: { rows: ExecutionRow[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.dueDate);
      const k = \`\${d.getUTCFullYear().toString().slice(-2)}-\${String(d.getUTCMonth()+1).padStart(2,'0')}\`;
      map.set(k, (map.get(k) || 0) + Number(r.hhPlanned));
    }
    return Array.from(map.entries())
      .map(([name, hh]) => ({ name, hh: Number(hh.toFixed(1)) }))
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} dy={5} />
        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-2} />
        <Tooltip
           cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
           contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
           itemStyle={{ color: '#bae6fd', fontWeight: 600 }}
           formatter={(val: number) => [\`\${val} HH\`, 'Carga Planificada']}
        />
        <Bar dataKey="hh" radius={[3, 3, 0, 0]} maxBarSize={30}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#38bdf8' : '#818cf8'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
`;

fs.writeFileSync('/home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas/apps/web/app/(dashboard)/_components/FloatingAiChat.tsx', code);
console.log('REWRITTEN!');
