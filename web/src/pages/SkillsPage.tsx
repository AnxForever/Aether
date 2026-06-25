import { useState, useEffect } from 'react';
import { getSkills, toggleSkill } from '../api/client';
import { Zap, Search, Loader2, Wrench } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeIds, setActiveIds] = useState<string[]>([]);

  useEffect(() => {
    getSkills().then((res) => {
      if (res.success && res.data?.skills) setSkills(res.data.skills as Skill[]);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (skill: Skill) => {
    const next = activeIds.includes(skill.id)
      ? activeIds.filter((id) => id !== skill.id)
      : [...activeIds, skill.id];
    setActiveIds(next);
    await toggleSkill(skill.id, !activeIds.includes(skill.id));
  };

  const filtered = skills.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Zap size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-h1 text-ink">技能管理</h1>
            <p className="font-body text-caption text-ink-muted">{skills.length} 个可用工具</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="field w-full pl-9"
            placeholder="搜索技能..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-ink-muted" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map((skill) => {
              const active = activeIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  onClick={() => handleToggle(skill)}
                  className={`card text-left hover:border-white/[0.10] transition-all ${
                    active ? 'border-accent/30 bg-accent/[0.04]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body text-caption text-ink leading-tight truncate">
                      {skill.name}
                    </span>
                    <span
                      className="w-[6px] h-[6px] rounded-full shrink-0 transition-colors"
                      style={{ backgroundColor: active ? '#22c55e' : '#334155' }}
                    />
                  </div>
                  {skill.version && (
                    <p className="font-body text-[10px] text-ink-ghost mt-1">v{skill.version}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
