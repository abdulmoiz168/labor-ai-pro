
export type SessionState = 'idle' | 'connecting' | 'active' | 'error' | 'ended';

export interface TranscriptionItem {
  author: 'user' | 'model';
  text: string;
}
