
export type SessionState = 'idle' | 'connecting' | 'active' | 'error' | 'ended';

export interface TranscriptionItem {
  author: 'user' | 'model';
  text: string;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: {
    text?: string;
    source?: string;
    chunkIndex?: number;
    totalChunks?: number;
    uploadedAt?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
  vector?: number[];
}
