import { useState, useEffect } from 'react';
import { getWorkflows, runWorkflow } from '../api/client';
import { Workflow, Play, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    getWorkflows().then((res) => {
      if (res.success && res.data) setWorkflows(res.data.workflows || []);
      setLoading(false);
    });
  }, []);

  const handleRun = async (wf: any) => {
    setRunning(wf.id);
    await runWorkflow(wf.id);
    setRunning(null);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Workflow size={24} className="text-purple-400" />
          <h1 className="text-xl font-bold">工作流</h1>
          <span className="text-aether-400 text-sm">{workflows.length} 个模板</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-aether-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <div key={wf.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Workflow size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{wf.name || wf.id}</p>
                    {wf.description && (
                      <p className="text-xs text-aether-400 mt-0.5">{wf.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRun(wf)}
                  disabled={running === wf.id}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {running === wf.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
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
