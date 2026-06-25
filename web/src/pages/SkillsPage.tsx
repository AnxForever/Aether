import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getSkills, toggleSkill } from '../api/client';
import { Zap, Search, Wrench } from 'lucide-react';
import { createLogger } from '../../../src/utils/logger';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const logger = createLogger('SkillsPage');

interface Skill {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
  description?: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

/** Determine skill category from name prefix */
function categorizeSkill(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('gmail')) return 'Gmail';
  if (lower.startsWith('github')) return 'GitHub';
  if (lower.startsWith('google')) return 'Google';
  if (lower.startsWith('office') || lower.startsWith('excel') || lower.startsWith('word') || lower.startsWith('ppt')) return 'Office';
  if (lower.startsWith('system') || lower.startsWith('file') || lower.startsWith('shell') || lower.startsWith('fs')) return 'System';
  if (lower.startsWith('creative') || lower.startsWith('image') || lower.startsWith('draw') || lower.startsWith('write')) return 'Creative';
  return 'Other';
}

const CATEGORY_ORDER = ['Gmail', 'GitHub', 'Google', 'Office', 'System', 'Creative', 'Other'];

interface CategoryGroup {
  category: string;
  skills: Skill[];
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkills()
      .then((res) => {
        if (res.success && res.data?.skills) setSkills(res.data.skills as Skill[]);
        setLoading(false);
      })
      .catch((err) => {
        logger.error('获取技能列表失败:', err);
        setError('获取技能列表失败，请检查网络连接');
        setLoading(false);
      });
  }, []);

  const handleToggle = async (skill: Skill) => {
    const wasActive = activeIds.includes(skill.id);
    const next = wasActive
      ? activeIds.filter((id) => id !== skill.id)
      : [...activeIds, skill.id];
    setActiveIds(next);
    try {
      await toggleSkill(skill.id, !wasActive);
    } catch (err) {
      logger.error('切换技能失败:', err as Error);
      setActiveIds(wasActive ? [...activeIds, skill.id] : activeIds.filter((id) => id !== skill.id));
    }
  };

  const filtered = skills.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Build category groups
  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, Skill[]>();
    for (const s of filtered) {
      const cat = categorizeSkill(s.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, skills: map.get(c)! }));
  }, [filtered]);

  const totalActive = activeIds.length;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center ring-1 ring-accent/10">
            <Zap size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">技能管理</h1>
            <p className="font-body text-sm text-ink-muted">
              {skills.length} 个可用工具
              {totalActive > 0 && <span className="ml-2 text-accent">· {totalActive} 个已启用</span>}
            </p>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-body text-sm text-danger bg-danger/5 px-4 py-3 rounded-sm border border-danger/15">
              {error}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="无匹配技能" description="尝试修改搜索关键词" />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const featured = group.skills.slice(0, 2);
              const rest = group.skills.slice(2);
              return (
                <div key={group.category}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="font-ui text-[10px] text-ink-muted tracking-widest uppercase">{group.category}</span>
                    <div className="flex-1 border-t border-border-subtle" />
                    <span className="font-body text-[10px] text-ink-ghost">{group.skills.length} 项</span>
                  </div>

                  <motion.div
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {featured.map((skill) => {
                      const active = activeIds.includes(skill.id);
                      return (
                        <motion.button
                          key={skill.id}
                          variants={cardVariants}
                          onClick={() => handleToggle(skill)}
                          role="switch"
                          aria-checked={active}
                          className={`card card-glow text-left border-l-[3px] ${active ? 'border-accent/30 bg-accent/[0.04] border-l-accent/40' : 'border-l-accent/0'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-body text-sm text-ink leading-tight truncate">
                              {skill.name}
                            </span>
                            {active ? (
                              <span className="font-body text-[9px] text-accent bg-accent/10 px-1.5 py-[1px] rounded-sm whitespace-nowrap shrink-0 leading-tight">
                                已启用
                              </span>
                            ) : (
                              <span className="w-[6px] h-[6px] rounded-full shrink-0 transition-colors" style={{ backgroundColor: '#334155' }} />
                            )}
                          </div>
                          {skill.description && (
                            <p className="font-body text-[10px] text-ink-muted mt-1 truncate">{skill.description}</p>
                          )}
                          {skill.version && (
                            <p className="font-body text-[10px] text-ink-ghost mt-1">v{skill.version}</p>
                          )}
                        </motion.button>
                      );
                    })}
                    {rest.map((skill) => {
                      const active = activeIds.includes(skill.id);
                      return (
                        <motion.button
                          key={skill.id}
                          variants={cardVariants}
                          onClick={() => handleToggle(skill)}
                          role="switch"
                          aria-checked={active}
                          className={`card card-glow text-left ${active ? 'border-accent/30 bg-accent/[0.04]' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-body text-sm text-ink leading-tight truncate">
                              {skill.name}
                            </span>
                            {active ? (
                              <span className="font-body text-[9px] text-accent bg-accent/10 px-1.5 py-[1px] rounded-sm whitespace-nowrap shrink-0 leading-tight">
                                已启用
                              </span>
                            ) : (
                              <span className="w-[6px] h-[6px] rounded-full shrink-0 transition-colors" style={{ backgroundColor: '#334155' }} />
                            )}
                          </div>
                          {skill.description && (
                            <p className="font-body text-[10px] text-ink-muted mt-1 truncate">{skill.description}</p>
                          )}
                          {skill.version && (
                            <p className="font-body text-[10px] text-ink-ghost mt-1">v{skill.version}</p>
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
