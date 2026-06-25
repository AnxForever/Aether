import { memo } from 'react';

const PROMPTS = [
  { label: '解释 TypeScript 泛型', hint: '帮我解释 TypeScript 泛型的概念和用法，包含实际代码示例' },
  { label: '写一个 React Hook', hint: '帮我写一个自定义 React Hook，用于处理常见的副作用场景' },
  { label: '帮我优化这段代码', hint: '帮我优化这段代码，提升性能和可读性' },
  { label: '比较 Claude 和 GPT 的区别', hint: '帮我比较 Claude 和 GPT 模型的特点、优势和适用场景' },
];

interface SuggestedPromptsProps {
  onSelect: (text: string) => void;
}

function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="w-full max-w-xl mx-auto mt-8">
      <p className="font-ui text-[10px] text-ink-ghost uppercase tracking-widest text-center mb-4">
        快速开始
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => onSelect(prompt.label)}
            className="
              text-left px-4 py-3 rounded-sm
              bg-accent/[0.06] border border-accent/[0.08]
              hover:bg-accent/[0.14] hover:border-accent/[0.2]
              hover:scale-[1.02] hover:shadow-[0_0_10px_rgba(6,182,212,0.12)]
              transition-all duration-150 ease-out
              cursor-pointer group
            "
          >
            <span className="font-body text-mono text-ink-secondary group-hover:text-ink transition-colors duration-150">
              {prompt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(SuggestedPrompts);
