import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Session, type Blob, type GoogleGenAI as GoogleGenAIType } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio';
import { blobToBase64 } from '../utils/image';
import type { SessionState, TranscriptionItem, SearchResult } from '../types';

const FRAME_RATE = 5; // Send 5 frames per second
const JPEG_QUALITY = 0.7;

// Get backend URL - in production use same origin, in dev use localhost:3001
const getBackendURL = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const BACKEND_URL = getBackendURL();

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
  const connectionTimeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const genAIRef = useRef<GoogleGenAIType | null>(null);

  /**
   * Search documents using RAG
   * Generates embedding for query and searches Qdrant
   */
  const searchDocuments = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      console.log('[RAG] Searching for:', query);

      // Generate embedding for the query
      if (!genAIRef.current) {
        throw new Error('GoogleGenAI not initialized');
      }

      const embeddingResult = await genAIRef.current.models.embedContent({
        model: 'text-embedding-004',
        contents: [query],
      });
      const queryVector = embeddingResult.embeddings[0].values;

      console.log('[RAG] Generated query embedding, vector size:', queryVector.length);

      // Search backend
      const response = await fetch(`${BACKEND_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_vector: queryVector,
          limit: 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[RAG] Found', data.count, 'results');

      return data.results || [];

    } catch (error) {
      console.error('[RAG] Search error:', error);
      return [];
    }
  }, []);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

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

    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Clean up canvas element
    canvasRef.current = null;
  }, []);

  const startSession = useCallback(async (stream: MediaStream, videoElRef: React.RefObject<HTMLVideoElement>) => {
    setSessionState('connecting');
    setErrorMessage(null);
    setTranscriptionHistory([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';

    // Set connection timeout (30 seconds)
    connectionTimeoutRef.current = window.setTimeout(() => {
      setErrorMessage('Connection timed out. Please try again.');
      setSessionState('error');
      cleanup();
    }, 30000);

    try {
      // Check backend connection before starting
      try {
        const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
        if (!healthResponse.ok) {
          console.warn('[RAG] Backend not available - document search will be disabled');
        } else {
          const healthData = await healthResponse.json();
          console.log('[RAG] Backend connected:', healthData.message);
        }
      } catch (error) {
        console.warn('[RAG] Backend connection check failed - document search will be disabled');
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      genAIRef.current = ai;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: 'You are Labor AI Pro, an expert assistant for skilled trade professionals like electricians, plumbers, and construction workers. Provide clear, concise, and safety-conscious advice. When analyzing images or video, focus on tools, materials, safety equipment (PPE), and work procedures. Your tone should be professional, helpful, and direct. When users ask questions about safety procedures, regulations, or technical documentation, use the search_documents function to retrieve relevant information from the uploaded manuals and guides.',
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [{
            functionDeclarations: [{
              name: 'search_documents',
              description: 'Search safety manuals, technical documentation, and procedural guides for relevant information. Use this when users ask about safety procedures, regulations, best practices, or technical specifications.',
              parameters: {
                type: 'object' as any,
                properties: {
                  query: {
                    type: 'string' as any,
                    description: 'The search query - be specific about what information is needed (e.g., "electrical safety grounding procedures", "OSHA fall protection requirements")'
                  }
                },
                required: ['query']
              }
            }]
          }],
        },
        callbacks: {
          onopen: async () => {
            // Clear connection timeout - connection succeeded
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }

            setSessionState('active');

            // Store the session in ref when connection opens
            const session = await sessionPromise;
            sessionRef.current = session;

            // Setup input audio streaming with AudioWorklet
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = audioContext;

            // Resume AudioContext if suspended (required by browser autoplay policy)
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }

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
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({ media: pcmBlob }).catch(err => {
                  console.error('Failed to send audio data:', err);
                  setErrorMessage('Failed to send audio data');
                });
              }
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination); // Connect to destination to satisfy some browser requirements

            // Setup video frame streaming
            if (!canvasRef.current) {
              canvasRef.current = document.createElement('canvas');
            }
            const canvasEl = canvasRef.current;
            const ctx = canvasEl.getContext('2d');

            frameIntervalRef.current = window.setInterval(() => {
              const videoEl = videoElRef.current;
              if (!ctx || !videoEl || videoEl.readyState < 2) return;

              canvasEl.width = videoEl.videoWidth;
              canvasEl.height = videoEl.videoHeight;
              ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
              canvasEl.toBlob(
                (blob) => {
                  if (blob && sessionRef.current) {
                    blobToBase64(blob)
                      .then(base64Data => {
                        // Double-check session is still active before sending
                        if (sessionRef.current) {
                          const sendPromise = sessionRef.current.sendRealtimeInput({
                            media: { data: base64Data, mimeType: 'image/jpeg' }
                          });

                          // Only add catch handler if we get a promise back
                          if (sendPromise && typeof sendPromise.catch === 'function') {
                            sendPromise.catch(err => {
                              // Silently ignore errors when session is closing
                              if (sessionState !== 'inactive') {
                                console.error('Failed to send video frame:', err);
                              }
                            });
                          }
                        }
                      })
                      .catch(err => {
                        console.error('Failed to encode video frame:', err);
                      });
                  }
                },
                'image/jpeg',
                JPEG_QUALITY
              );
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle function calls from Gemini
            if (message.toolCall) {
              const toolCall = message.toolCall;
              console.log('[RAG] Function call received:', toolCall.functionCalls);

              for (const functionCall of toolCall.functionCalls || []) {
                if (functionCall.name === 'search_documents') {
                  const query = functionCall.args?.query;
                  console.log('[RAG] Executing search for:', query);

                  try {
                    const results = await searchDocuments(query);

                    // Format results for the model
                    let responseText = '';
                    if (results.length === 0) {
                      responseText = 'No relevant documents found.';
                    } else {
                      responseText = `Found ${results.length} relevant document sections:\n\n`;
                      results.forEach((result: SearchResult, index: number) => {
                        const score = (result.score * 100).toFixed(1);
                        responseText += `${index + 1}. [Score: ${score}%] ${result.payload?.text || 'No text'}\n`;
                        if (result.payload?.source) {
                          responseText += `   Source: ${result.payload.source}\n`;
                        }
                        responseText += '\n';
                      });
                    }

                    console.log('[RAG] Sending function response with', results.length, 'results');

                    // Send function response back to Gemini
                    if (sessionRef.current) {
                      await sessionRef.current.sendToolResponse({
                        functionResponses: [{
                          id: functionCall.id,
                          name: functionCall.name,
                          response: { result: responseText }
                        }]
                      });
                    }
                  } catch (error) {
                    console.error('[RAG] Function execution error:', error);

                    // Send error response
                    if (sessionRef.current) {
                      await sessionRef.current.sendToolResponse({
                        functionResponses: [{
                          id: functionCall.id,
                          name: functionCall.name,
                          response: { error: 'Failed to search documents' }
                        }]
                      });
                    }
                  }
                }
              }
            }

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
            if (base64Audio && typeof base64Audio === 'string') {
              try {
                if (!outputAudioContextRef.current) {
                  outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const audioContext = outputAudioContextRef.current;

                // Resume AudioContext if suspended (required by browser autoplay policy)
                if (audioContext.state === 'suspended') {
                  await audioContext.resume();
                }

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

                const decodedData = decode(base64Audio);
                const audioBuffer = await decodeAudioData(decodedData, audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
              } catch (error) {
                console.error('Failed to decode and play audio:', error);
                // Don't crash the app, just skip this audio chunk
              }
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

      // Session will be stored in sessionRef when onopen callback is triggered
      // No need to await here as it's already handled in onopen

    } catch (error) {
      console.error('Failed to start session:', error);
      setErrorMessage('Failed to initialize AI session. Please check your connection and try again.');
      setSessionState('error');
      cleanup();
    }
  }, [cleanup]);

  const endSession = useCallback(() => {
    setSessionState(currentState => {
      if (currentState !== 'active' && currentState !== 'connecting') {
        return currentState; // No change
      }
      cleanup();
      return 'ended';
    });
  }, [cleanup]);
  
  const sendTextMessage = useCallback(async (text: string) => {
    if (!sessionRef.current || sessionState !== 'active') {
      console.warn('[Text] Cannot send message - session not active');
      return;
    }

    try {
      console.log('[Text] Sending message:', text);

      // Add user message to transcription history immediately
      setTranscriptionHistory(prev => [...prev, { author: 'user', text }]);

      // Send text to Gemini Live session
      await sessionRef.current.sendRealtimeInput({
        text: text
      });

      console.log('[Text] Message sent successfully');
    } catch (error) {
      console.error('[Text] Failed to send message:', error);
      setErrorMessage('Failed to send message');
    }
  }, [sessionState]);

  useEffect(() => {
    return () => {
        cleanup();
    };
  }, [cleanup]);

  return {
    sessionState,
    transcriptionHistory,
    startSession,
    endSession,
    sendTextMessage,
    errorMessage
  };
};