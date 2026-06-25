import { useState, useEffect } from 'react';
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-body text-caption text-danger bg-danger/5 px-4 py-3 rounded-sm border border-danger/15">
              {error}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="无匹配技能" description="尝试修改搜索关键词" />
        ) : (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((skill) => {
              const active = activeIds.includes(skill.id);
              return (
                <motion.button
                  key={skill.id}
                  variants={cardVariants}
                  onClick={() => handleToggle(skill)}
                  className={`card card-glow text-left ${
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
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
