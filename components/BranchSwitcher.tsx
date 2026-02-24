
import React from 'react';
import { Branch } from '../types.ts';

interface BranchSwitcherProps {
  activeBranch: Branch;
  onBranchChange: (branch: Branch) => void;
}

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({ activeBranch, onBranchChange }) => {
  return (
    <div className="w-full min-w-0 flex space-x-12 border-b border-fcDivider px-4">
      <button 
        onClick={() => onBranchChange('Harare')}
        className={`pb-4 text-[12px] font-bold tracking-widest transition-all border-b-2 ${
          activeBranch === 'Harare' ? 'border-fcGold text-fcSlate' : 'border-transparent text-fcMuted hover:text-fcSlate'
        }`}
      >
        Harare
      </button>
      <button 
        onClick={() => onBranchChange('Bulawayo')}
        className={`pb-4 text-[12px] font-bold tracking-widest transition-all border-b-2 ${
          activeBranch === 'Bulawayo' ? 'border-fcGold text-fcSlate' : 'border-transparent text-fcMuted hover:text-fcSlate'
        }`}
      >
        Bulawayo
      </button>
    </div>
  );
};
