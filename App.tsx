import React, { useRef, useState } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { TranscriptionBubble } from './components/TranscriptionBubble';
import { StatusIndicator } from './components/StatusIndicator';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    sessionState,
    transcriptionHistory,
    startSession,
    endSession,
    errorMessage: hookError,
  } = useGeminiLive();

  const handleStartSession = async () => {
    setErrorMessage(null);
    if (sessionState !== 'idle' && sessionState !== 'ended' && sessionState !== 'error') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await startSession(stream, videoRef);
        } catch (sessionError) {
          // Session failed to start, clean up the media stream
          stream.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          throw sessionError;
        }
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
          setErrorMessage('Camera and microphone access was denied. Please allow access to start a session.');
      } else {
          setErrorMessage('Could not access camera and microphone. Please ensure they are not in use by another application.');
      }
    }
  };

  const handleEndSession = () => {
    endSession();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const isActive = sessionState === 'active';
  const isConnecting = sessionState === 'connecting';
  const finalErrorMessage = errorMessage || hookError;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <header className="w-full p-4 flex justify-between items-center bg-gray-900/80 backdrop-blur-sm z-10 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            Labor AI Pro
          </h1>
        </div>
        <StatusIndicator state={sessionState} />
      </header>

      <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
        <div className="flex-grow flex flex-col items-center justify-center p-4 relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isActive && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center">
              <div className="max-w-md">
                <h2 className="text-3xl font-bold mb-4">Your On-the-Job AI Partner</h2>
                <p className="text-gray-400 mb-6">
                  Get expert guidance on safety, tools, and procedures. Show Labor AI Pro your worksite and ask for real-time advice on PPE, tool selection, or next steps.
                </p>
                {finalErrorMessage && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm" role="alert">
                      <p>{finalErrorMessage}</p>
                    </div>
                )}
                <button
                    onClick={handleStartSession}
                    disabled={isConnecting}
                    className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold rounded-full hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-wait"
                  >
                  {isConnecting ? 'Connecting...' : 'Start Session'}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="w-full md:w-96 bg-gray-800/50 backdrop-blur-md flex flex-col border-l border-gray-700 h-[40vh] md:h-auto overflow-hidden">
          <div className="flex-grow p-4 overflow-y-auto flex flex-col-reverse">
            <div className="space-y-4">
              {transcriptionHistory.map((item, index) => (
                <TranscriptionBubble key={index} author={item.author} text={item.text} />
              ))}
               {transcriptionHistory.length === 0 && !isConnecting && (
                  <div className="text-center text-gray-400 text-sm">
                    Your job consultation will appear here.
                  </div>
                )}
                 {isConnecting && (
                  <div className="text-center text-gray-400 text-sm animate-pulse">
                    Establishing secure connection...
                  </div>
                )}
            </div>
          </div>
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={isActive ? handleEndSession : handleStartSession}
              disabled={isConnecting}
              className={`w-full py-3 font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-wait ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {isConnecting ? 'Connecting...' : isActive ? 'End Session' : 'Start Session'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;