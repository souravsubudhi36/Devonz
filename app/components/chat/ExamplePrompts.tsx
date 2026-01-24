import React, { useState, useCallback } from 'react';

const ALL_PROMPTS = [
  { text: 'AI Landing Page Builder', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'AI Customer Support Chatbot Platform', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'AI Interview Screening Platform', icon: 'i-ph:monitor-duotone', color: 'text-purple-400' },
  { text: 'Sales Pitch Presentation', icon: 'i-ph:presentation-chart-duotone', color: 'text-pink-400' },
  { text: 'Referral Program Platform', icon: 'i-ph:users-duotone', color: 'text-purple-400' },
  { text: 'AI Social Media Manager', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'E-commerce Dashboard', icon: 'i-ph:storefront-duotone', color: 'text-green-400' },
  { text: 'Project Management Tool', icon: 'i-ph:kanban-duotone', color: 'text-blue-400' },
  { text: 'AI Content Generator', icon: 'i-ph:article-duotone', color: 'text-orange-400' },
  { text: 'Portfolio Website', icon: 'i-ph:briefcase-duotone', color: 'text-indigo-400' },
  { text: 'Real-time Chat Application', icon: 'i-ph:chat-circle-dots-duotone', color: 'text-teal-400' },
  { text: 'Invoice Generator Tool', icon: 'i-ph:receipt-duotone', color: 'text-yellow-400' },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  const [prompts, setPrompts] = useState(() => shuffleArray(ALL_PROMPTS).slice(0, 6));

  const refreshPrompts = useCallback(() => {
    setPrompts(shuffleArray(ALL_PROMPTS).slice(0, 6));
  }, []);

  return (
    <div id="examples" className="relative flex flex-col gap-4 w-full max-w-3xl mx-auto mt-6">
      {/* Title */}
      <h3 className="text-center text-sm font-medium text-white/90">Not sure where to start? Try one of these:</h3>

      {/* Prompt buttons */}
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {prompts.map((prompt, index: number) => {
          return (
            <button
              key={`${prompt.text}-${index}`}
              onClick={(event) => {
                sendMessage?.(event, prompt.text);
              }}
              className="group flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-200
                border border-[#3d5a7f]/40 
                text-white/80 hover:text-white
                hover:border-[#4d6a8f] hover:shadow-[0_0_16px_rgba(61,90,127,0.25)]"
              style={{
                backgroundColor: 'rgba(30, 58, 95, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(30, 58, 95, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(30, 58, 95, 0.2)';
              }}
            >
              <div className={`${prompt.icon} ${prompt.color} text-base`} />
              <span>{prompt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Refresh button */}
      <button
        onClick={refreshPrompts}
        className="flex items-center gap-2 mx-auto px-3 py-1.5 text-sm text-[#6b8bb8] hover:text-[#8badd4] transition-colors bg-transparent"
      >
        <div className="i-ph:arrows-clockwise text-base" />
        <span>Try different ideas</span>
      </button>
    </div>
  );
}
