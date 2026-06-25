import { useState, useEffect } from 'react';
import { getWorkflows, runWorkflow } from '../api/client';
import { Workflow, Play, FileText, Database, Bell, Clock } from 'lucide-react';
import { createLogger } from '../../../src/utils/logger';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const logger = createLogger('WorkflowsPage');

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
  stepCount?: number;
  lastRunAt?: string;
  running?: boolean;
}

/** Map workflow type to a color class and label */
const TYPE_STYLES: Record<string, { border: string; bg: string; dot: string }> = {
  deployment: { border: 'border-l-blue-500', bg: 'bg-blue-500/8', dot: 'bg-blue-400' },
  data:       { border: 'border-l-emerald-500', bg: 'bg-emerald-500/8', dot: 'bg-emerald-400' },
  notification: { border: 'border-l-violet-500', bg: 'bg-violet-500/8', dot: 'bg-violet-400' },
  batch:      { border: 'border-l-amber-500', bg: 'bg-amber-500/8', dot: 'bg-amber-400' },
};

function getTypeStyle(type?: string) {
  if (!type) return { border: 'border-l-slate-500', bg: 'bg-slate-500/8', dot: 'bg-slate-400' };
  return TYPE_STYLES[type.toLowerCase()] ?? { border: 'border-l-slate-500', bg: 'bg-slate-500/8', dot: 'bg-slate-400' };
}

/** Pick an icon per type */
function TypeIcon({ type, className }: { type?: string; className?: string }) {
  const lower = type?.toLowerCase() ?? '';
  if (lower === 'data') return <Database size={15} className={className} />;
  if (lower === 'notification') return <Bell size={15} className={className} />;
  return <FileText size={15} className={className} />;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    getWorkflows()
      .then((res) => {
        if (res.success && res.data) {
          setWorkflows((res.data.workflows as WorkflowItem[]) || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        logger.error('获取工作流列表失败:', err);
        setError('获取工作流列表失败，请检查网络连接');
        setLoading(false);
      });
  }, []);

  const handleRun = async (wf: WorkflowItem) => {
    setRunning(wf.id);
    try {
      await runWorkflow(wf.id);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center ring-1 ring-accent/10">
            <Workflow size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-h1 text-ink">工作流</h1>
            <p className="font-body text-caption text-ink-muted">{workflows.length} 个模板</p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <p className="font-body text-caption text-danger bg-danger/5 px-4 py-3 rounded-sm border border-danger/15">
              {error}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.length === 0 && !loading ? (
              <EmptyState icon={Workflow} title="暂无工作流" description="创建您第一个自动化工作流" />
            ) : null}

            {workflows.map((wf) => {
              const isRunning = running === wf.id || wf.running;
              const typeStyle = getTypeStyle(wf.type);

              return (
                <div
                  key={wf.id}
                  className={`card card-glow flex items-center justify-between gap-4 animate-fade-in border-l-[3px] rounded-l-sm ${typeStyle.border} ${isRunning ? 'animate-pulse' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-sm ${typeStyle.bg} border border-white/5 flex items-center justify-center shrink-0`}>
                      <TypeIcon type={wf.type} className={`${typeStyle.dot.replace('bg-', 'text-')}/70`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-body text-mono text-ink truncate">{wf.name || wf.id}</p>
                        {/* Step count badge */}
                        {wf.stepCount != null && (
                          <span className="font-body text-[10px] text-ink-ghost bg-white/[0.04] px-1.5 py-[1px] rounded-sm shrink-0 leading-tight">
                            {wf.stepCount} 步骤
                          </span>
                        )}
                        {/* Running indicator */}
                        {isRunning && (
                          <span className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse shrink-0" />
                        )}
                      </div>
                      {wf.description && (
                        <p className="font-body text-[11px] text-ink-muted mt-0.5 truncate">
                          {wf.description}
                        </p>
                      )}
                      {/* Last run timestamp */}
                      {wf.lastRunAt && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={10} className="text-ink-ghost" />
                          <span className="font-body text-[10px] text-ink-ghost">上次执行 {formatTimestamp(wf.lastRunAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRun(wf)}
                    disabled={isRunning}
                    className="btn btn-primary text-sm shrink-0"
                  >
                    {isRunning ? (
                      <span className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    执行
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
