import { useState, useEffect } from 'react';
import { getSkills, toggleSkill } from '../api/client';
import { Zap, Search, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/app';

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
  const { activeSkills, toggleActiveSkill } = useAppStore();

  useEffect(() => {
    getSkills().then((res) => {
      if (res.success && res.data) {
        setSkills((res.data.skills as Skill[]) || []);
      }
      setLoading(false);
    });
  }, []);

  const handleToggle = async (skill: Skill) => {
    const newState = !activeSkills.includes(skill.id);
    toggleActiveSkill(skill.id);
    await toggleSkill(skill.id, newState);
  };

  const filtered = skills.filter(
    (s) =>
      !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Zap size={24} className="text-yellow-400" />
          <h1 className="text-xl font-bold">技能管理</h1>
          <span className="text-aether-400 text-sm">{skills.length} 个可用</span>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aether-500" />
          <input
            className="input w-full pl-10"
            placeholder="搜索技能..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-aether-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((skill) => {
              const isActive = activeSkills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  onClick={() => handleToggle(skill)}
                  className={`card text-left transition-all hover:scale-[1.02] ${
                    isActive ? 'border-blue-500/50 bg-blue-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{skill.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-green-400' : 'bg-aether-600'
                      }`}
                    />
                  </div>
                  {skill.version && (
                    <p className="text-xs text-aether-500 mt-1">v{skill.version}</p>
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
