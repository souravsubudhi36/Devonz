import { useState, useRef, useCallback, type PropsWithChildren } from 'react';

const ThoughtBox = ({ title, children }: PropsWithChildren<{ title: string }>) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => {
      if (prev && contentRef.current) {
        contentRef.current.scrollTop = 0;
      }

      return !prev;
    });
  }, []);

  return (
    <div className="bg-bolt-elements-background-depth-2 shadow-md rounded-lg border border-bolt-elements-borderColor">
      {/* Header — always visible, never scrolls away */}
      <div
        onClick={handleToggle}
        className="p-4 flex items-center gap-4 rounded-lg text-bolt-elements-textSecondary font-medium leading-5 text-sm cursor-pointer select-none"
      >
        <div className="i-ph:brain-thin text-2xl flex-shrink-0" />
        <div>
          <span>{title}</span>{' '}
          {!isExpanded && <span className="text-bolt-elements-textTertiary">- Click to expand</span>}
        </div>
      </div>

      {/* Content — scrollable when expanded, fully hidden when collapsed */}
      <div
        ref={contentRef}
        className={`
          transition-all duration-300
          ${isExpanded ? 'max-h-96 overflow-y-auto opacity-100 p-4 pt-0' : 'max-h-0 overflow-hidden opacity-0'}
        `}
      >
        {children}
      </div>
    </div>
  );
};

export default ThoughtBox;
