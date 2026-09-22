import React from 'react';
import { StageId, STAGES } from './pipeline-types';

export { type StageId, type StageItem, STAGES } from './pipeline-types';

interface PipelineStepperProps {
  activeStage: StageId;
  onStageChange: (stage: StageId) => void;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  activeStage,
  onStageChange,
}) => {
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' && index < STAGES.length - 1) {
      e.preventDefault();
      onStageChange(STAGES[index + 1].id);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      onStageChange(STAGES[index - 1].id);
    }
  };

  return (
    <nav
      aria-label="Retrieval Pipeline Stages"
      className="w-full bg-[#0A0A0D] border-b border-border py-1.5 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-1.5 sm:gap-2">
        {STAGES.map((stage, idx) => {
          const isActive = activeStage === stage.id;
          const isComplete = idx < activeIndex;
          const stageState = isActive
            ? 'active'
            : isComplete
            ? 'complete'
            : 'upcoming';

          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                data-stage={stageState}
                onClick={() => onStageChange(stage.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                aria-current={isActive ? 'step' : undefined}
                className={`group relative flex items-center space-x-2.5 px-3 py-1.5 rounded-sm text-left transition-all duration-150 flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary ${
                  isActive
                    ? 'bg-surface-2 border border-border-strong shadow-glow-sm'
                    : isComplete
                    ? 'bg-transparent border border-transparent hover:bg-surface-2/50 text-ink-muted'
                    : 'bg-transparent border border-transparent hover:bg-surface-2/30 text-ink-faint'
                }`}
              >
                {/* Step indicator box */}
                <div className="flex items-center justify-center font-mono text-[11px] font-semibold tracking-wider flex-shrink-0">
                  <span
                    className={`w-5 h-5 rounded-sm flex items-center justify-center border transition-colors ${
                      isActive
                        ? 'border-ink-primary bg-ink-primary text-canvas font-bold shadow-sm'
                        : isComplete
                        ? 'border-border-strong bg-surface-3 text-ink-muted'
                        : 'border-border bg-surface-1 text-ink-faint group-hover:border-border-strong'
                    }`}
                  >
                    {isComplete ? '✓' : stage.step}
                  </span>
                </div>

                {/* Stage names and subheads */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-xs font-semibold tracking-tight whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-ink-primary'
                          : isComplete
                          ? 'text-ink-primary/80 group-hover:text-ink-primary'
                          : 'text-ink-muted group-hover:text-ink-primary/70'
                      }`}
                    >
                      {stage.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-faint hidden xl:inline truncate">
                    {stage.subhead}
                  </span>
                </div>

                {/* Subtle active line underneath */}
                {isActive && (
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-2 right-2 h-0.5 bg-attack rounded-full shadow-glow-accent"
                  />
                )}
              </button>

              {/* Connecting Pipeline Conduit */}
              {idx < STAGES.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden lg:block flex-1 h-[1px] min-w-3 max-w-7 transition-colors ${
                    idx < activeIndex ? 'bg-attack/40' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
