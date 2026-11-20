import React from 'react';
import type { WorkspaceTab } from '../types/interview';

interface TopNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  hasActiveSession: boolean;
  hasStudyPlan: boolean;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'interview', label: 'Mock Interview' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'study-plan', label: 'Study Plan' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  hasActiveSession,
  hasStudyPlan,
  onPrimaryAction,
  primaryActionLabel,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('setup')}
          className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          PyBench
        </button>

        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const isDisabled =
              (item.id === 'interview' || item.id === 'evaluation') &&
              !hasActiveSession;
            const isPlanDisabled =
              item.id === 'study-plan' && !hasActiveSession && !hasStudyPlan;
            const disabled = isDisabled || isPlanDisabled;

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'text-slate-950'
                    : disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
