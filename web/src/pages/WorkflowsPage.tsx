import { useState, useEffect } from 'react';
import { getWorkflows, runWorkflow } from '../api/client';
import { Workflow, Play, Loader2 } from 'lucide-react';
import { createLogger } from '../../../src/utils/logger';

const logger = createLogger('WorkflowsPage');

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
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
          <div className="w-8 h-8 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Workflow size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-h1 text-ink">工作流</h1>
            <p className="font-body text-caption text-ink-muted">{workflows.length} 个模板</p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin text-ink-muted" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24">
            <p className="font-body text-caption text-danger bg-danger/5 px-4 py-3 rounded-sm border border-danger/15">
              {error}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="font-body text-caption text-ink-muted">暂无工作流</p>
              </div>
            )}

            {workflows.map((wf) => (
              <div key={wf.id} className="card flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-sm bg-accent/8 border border-accent/15 flex items-center justify-center shrink-0">
                    <Workflow size={15} className="text-accent/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-mono text-ink truncate">{wf.name || wf.id}</p>
                    {wf.description && (
                      <p className="font-body text-[11px] text-ink-muted mt-0.5 truncate">
                        {wf.description}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRun(wf)}
                  disabled={running === wf.id}
                  className="btn btn-primary text-sm shrink-0"
                >
                  {running === wf.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  执行
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
