import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Session, type Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio';
import { blobToBase64 } from '../utils/image';
import type { SessionState, TranscriptionItem } from '../types';

const FRAME_RATE = 5; // Send 5 frames per second
const JPEG_QUALITY = 0.7;

// AudioWorklet processor code as a string
const audioWorkletProcessor = `
  class PcmProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      if (input.length > 0) {
        const channelData = input[0];
        const l = channelData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          // Convert float from -1.0 to 1.0 to 16-bit signed integer
          int16[i] = Math.max(-1, Math.min(1, channelData[i])) * 32767;
        }
        // Post the raw PCM data buffer back to the main thread
        this.port.postMessage(new Uint8Array(int16.buffer));
      }
      return true;
    }
  }
  registerProcessor('pcm-processor', PcmProcessor);
`;


export const useGeminiLive = () => {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionItem[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    audioWorkletNodeRef.current?.port.close();
    audioWorkletNodeRef.current?.disconnect();
    audioWorkletNodeRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;

    inputAudioContextRef.current?.close().catch(console.error);
    inputAudioContextRef.current = null;

    outputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current = null;
    
    if (workletUrlRef.current) {
        URL.revokeObjectURL(workletUrlRef.current);
        workletUrlRef.current = null;
    }

    sessionRef.current?.close();
    sessionRef.current = null;

    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startSession = useCallback(async (stream: MediaStream, videoElRef: React.RefObject<HTMLVideoElement>) => {
    setSessionState('connecting');
    setErrorMessage(null);
    setTranscriptionHistory([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: 'You are Labor AI Pro, an expert assistant for skilled trade professionals like electricians, plumbers, and construction workers. Provide clear, concise, and safety-conscious advice. When analyzing images or video, focus on tools, materials, safety equipment (PPE), and work procedures. Your tone should be professional, helpful, and direct.',
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
        callbacks: {
          onopen: async () => {
            setSessionState('active');
            
            // Setup input audio streaming with AudioWorklet
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = audioContext;

            const workletBlob = new Blob([audioWorkletProcessor], { type: 'application/javascript' });
            workletUrlRef.current = URL.createObjectURL(workletBlob);
            await audioContext.audioWorklet.addModule(workletUrlRef.current);
            
            const source = audioContext.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            
            const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
            audioWorkletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event) => {
              const pcmData: Uint8Array = event.data;
              const pcmBlob: Blob = {
                data: encode(pcmData),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(console.error);
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination); // Connect to destination to satisfy some browser requirements

            // Setup video frame streaming
            const canvasEl = document.createElement('canvas');
            const ctx = canvasEl.getContext('2d');

            frameIntervalRef.current = window.setInterval(() => {
              const videoEl = videoElRef.current;
              if (!ctx || !videoEl || videoEl.readyState < 2) return;
              
              canvasEl.width = videoEl.videoWidth;
              canvasEl.height = videoEl.videoHeight;
              ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
              canvasEl.toBlob(
                (blob) => {
                  if (blob) {
                    blobToBase64(blob).then(base64Data => {
                       sessionPromise.then(session => {
                        session.sendRealtimeInput({
                          media: { data: base64Data, mimeType: 'image/jpeg' }
                        });
                      }).catch(console.error);
                    }).catch(console.error);
                  }
                },
                'image/jpeg',
                JPEG_QUALITY
              );
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if(message.serverContent?.turnComplete) {
              const newItems: TranscriptionItem[] = [];
              const userInput = currentInputTranscriptionRef.current.trim();
              const modelOutput = currentOutputTranscriptionRef.current.trim();
              if (userInput) newItems.push({ author: 'user', text: userInput });
              if (modelOutput) newItems.push({ author: 'model', text: modelOutput });

              if (newItems.length > 0) {
                setTranscriptionHistory(prev => [...prev, ...newItems]);
              }
              
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
              }
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              
              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setErrorMessage('A connection error occurred. The session has ended.');
            setSessionState('error');
            cleanup();
          },
          onclose: (e: CloseEvent) => {
            setSessionState('ended');
            cleanup();
          },
        },
      });
      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('Failed to start session:', error);
      setErrorMessage('Failed to initialize AI session. Please check your connection and try again.');
      setSessionState('error');
      cleanup();
    }
  }, [cleanup]);

  const endSession = useCallback(() => {
    if (sessionState !== 'active' && sessionState !== 'connecting') return;
    cleanup();
    setSessionState('ended');
  }, [sessionState, cleanup]);
  
  useEffect(() => {
    return () => {
        cleanup();
    };
  }, [cleanup]);

  return { sessionState, transcriptionHistory, startSession, endSession, errorMessage };
};