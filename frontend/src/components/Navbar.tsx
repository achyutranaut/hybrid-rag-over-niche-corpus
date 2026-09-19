import React from 'react';
import { OverviewResponse } from '../types/api';
import { ResearchHeader } from './ResearchHeader';
import { PipelineStepper } from './PipelineStepper';
import { TabId, StageId, tabToStage } from './pipeline-types';

export type { TabId, StageId } from './pipeline-types';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  overview: OverviewResponse | null;
  backendOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  overview,
  backendOnline,
}) => {
  const currentStage = tabToStage(activeTab);

  const handleStageChange = (stage: StageId) => {
    switch (stage) {
      case 'corpus':
        onTabChange('overview');
        break;
      case 'query':
        onTabChange('query_understanding');
        break;
      case 'retrieve':
        onTabChange('playground');
        break;
      case 'rerank':
        onTabChange('inspector');
        break;
      case 'evaluate':
        onTabChange('evaluation');
        break;
      case 'architecture':
        onTabChange('architecture');
        break;
      case 'methodology':
        onTabChange('methodology');
        break;
    }
  };

  return (
    <div className="w-full flex flex-col">
      <ResearchHeader overview={overview} backendOnline={backendOnline} />
      <PipelineStepper activeStage={currentStage} onStageChange={handleStageChange} />
    </div>
  );
};
