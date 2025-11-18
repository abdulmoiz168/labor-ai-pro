import React, { useRef, useState } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { TranscriptionBubble } from './components/TranscriptionBubble';
import { StatusIndicator } from './components/StatusIndicator';
import { Logo } from './components/Logo';

// Get backend URL - in production use same origin, in dev use localhost:3001
const getBackendURL = () => {
  // Check if running on localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  // In production, use same origin (Vercel)
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const BACKEND_URL = getBackendURL();

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const {
    sessionState,
    transcriptionHistory,
    startSession,
    endSession,
    sendTextMessage,
    errorMessage: hookError,
  } = useGeminiLive();

  const [textInput, setTextInput] = useState<string>('');

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

  const readFileAsBase64 = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleDocumentUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('error');
      setUploadMessage('File is larger than 10MB limit.');
      return;
    }

    if (
      file.type !== 'application/pdf' &&
      !file.type.startsWith('text/') &&
      !file.name.toLowerCase().endsWith('.txt')
    ) {
      setUploadStatus('error');
      setUploadMessage('Please upload PDF or text files.');
      return;
    }

    try {
      setUploadStatus('uploading');
      setUploadMessage('Uploading and indexing document...');

      const base64 = await readFileAsBase64(file);

      const response = await fetch(`${BACKEND_URL}/api/upload-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'Upload failed');
      }

      setUploadStatus('success');
      setUploadMessage(result?.message || 'Document uploaded successfully.');
    } catch (uploadError) {
      console.error('Document upload failed:', uploadError);
      let message = 'Upload failed';
      if (uploadError instanceof TypeError) {
        message = `Cannot reach backend at ${BACKEND_URL}. Make sure the server is running (npm run backend) and the port is accessible.`;
      } else if (uploadError instanceof Error) {
        message = uploadError.message;
      }
      setUploadStatus('error');
      setUploadMessage(message);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleDocumentUpload(file);
    event.target.value = '';
  };

  const handleUploadButtonClick = () => {
    if (uploadStatus === 'uploading') return;
    fileInputRef.current?.click();
  };

  const handleSendText = async () => {
    const message = textInput.trim();
    if (!message || sessionState !== 'active' || !sendTextMessage) return;

    try {
      await sendTextMessage(message);
      setTextInput(''); // Clear input after sending
    } catch (error) {
      console.error('Failed to send text message:', error);
    }
  };

  const handleTextKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendText();
    }
  };

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
          <div className="p-4 border-t border-gray-700 space-y-3">
            {/* Text input for sending messages */}
            {isActive && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleTextKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
                />
                <button
                  onClick={handleSendText}
                  disabled={!textInput.trim()}
                  className="px-6 py-3 font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white"
                >
                  Send
                </button>
              </div>
            )}

            {isActive && (
              <button
                onClick={handleEndSession}
                disabled={isConnecting}
                className="w-full py-3 font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-wait bg-red-600 hover:bg-red-700 text-white"
              >
                End Session
              </button>
            )}

            <div>
              <input
                ref={fileInputRef}
                id="documentUpload"
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={handleUploadButtonClick}
                disabled={uploadStatus === 'uploading'}
                className="w-full py-3 font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-wait bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>

            {uploadMessage && (
              <p
                className={`text-sm ${uploadStatus === 'error' ? 'text-red-300' : 'text-green-300'}`}
              >
                {uploadMessage}
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
