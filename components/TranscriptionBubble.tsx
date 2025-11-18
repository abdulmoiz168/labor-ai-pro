import React from 'react';

interface TranscriptionBubbleProps {
  author: 'user' | 'model';
  text: string;
}

export const TranscriptionBubble: React.FC<TranscriptionBubbleProps> = ({ author, text }) => {
  const isUser = author === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="text-xs text-gray-400 mb-1 px-1">{isUser ? 'You' : 'Labor AI Pro'}</div>
      <div
        className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? 'bg-orange-600 text-white rounded-br-none'
            : 'bg-gray-700 text-gray-200 rounded-bl-none'
        }`}
      >
        {text}
      </div>
    </div>
  );
};