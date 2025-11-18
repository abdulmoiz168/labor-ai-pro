
import React from 'react';
import type { SessionState } from '../types';

interface StatusIndicatorProps {
  state: SessionState;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state }) => {
  const stateConfig = {
    idle: { text: 'Idle', color: 'bg-gray-500' },
    connecting: { text: 'Connecting', color: 'bg-yellow-500 animate-pulse' },
    active: { text: 'Live', color: 'bg-green-500 animate-pulse' },
    error: { text: 'Error', color: 'bg-red-500' },
    ended: { text: 'Ended', color: 'bg-gray-500' },
  };

  const { text, color } = stateConfig[state];

  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`}></span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
};
