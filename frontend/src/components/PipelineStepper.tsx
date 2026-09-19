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
      className="w-full bg-[#0D0D0F] border-b border-border py-2 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-1 sm:gap-2">
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
                className="group relative flex items-center space-x-2 px-2.5 py-1.5 rounded text-left transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary data-[stage=active]:bg-surface-2 data-[stage=active]:border-b-2 data-[stage=active]:border-ink-primary data-[stage=complete]:opacity-85 hover:bg-surface-2/60"
              >
                {/* Step indicator */}
                <div className="flex items-center justify-center font-mono text-[11px] font-semibold tracking-wider">
                  <span
                    className={`w-5 h-5 rounded-sm flex items-center justify-center border ${
                      isActive
                        ? 'border-ink-primary bg-ink-primary text-canvas font-bold'
                        : isComplete
                        ? 'border-border-strong bg-surface-2 text-ink-muted'
                        : 'border-border text-ink-faint'
                    }`}
                  >
                    {isComplete ? '✓' : stage.step}
                  </span>
                </div>

                {/* Stage titles */}
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs font-semibold tracking-tight whitespace-nowrap ${
                      isActive
                        ? 'text-ink-primary'
                        : isComplete
                        ? 'text-ink-primary/90'
                        : 'text-ink-muted'
                    }`}
                  >
                    {stage.name}
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted hidden xl:inline truncate">
                    {stage.subhead}
                  </span>
                </div>
              </button>

              {/* Connecting Pipeline Line */}
              {idx < STAGES.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden md:block flex-1 h-[1px] min-w-2 max-w-8 ${
                    idx < activeIndex ? 'bg-ink-muted/40' : 'bg-border'
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
