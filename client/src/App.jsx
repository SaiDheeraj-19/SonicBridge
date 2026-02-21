import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useWebSocket } from './hooks/useWebSocket';

const LANGUAGES = [
  { code: 'en-IN', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'te-IN', name: 'Telugu' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'kn-IN', name: 'Kannada' },
  { code: 'ml-IN', name: 'Malayalam' },
  { code: 'mr-IN', name: 'Marathi' },
  { code: 'bn-IN', name: 'Bengali' },
];

function App() {
  const [currentView, setCurrentView] = useState('welcome'); // welcome, portal, host, participant
  const [isDarkMode, setIsDarkMode] = useState(false); // Design is light by default, except participant

  // Connection & Translation states
  const [sourceLang, setSourceLang] = useState('en-IN');
  const [targetLang, setTargetLang] = useState('hi-IN');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const processQueueRef = useRef(null);

  const [hostListeners, setHostListeners] = useState(0);
  const [hostLatency, setHostLatency] = useState(0);

  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const [hostLeftCountdown, setHostLeftCountdown] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // Handle active theme class on body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle host left automated teardown
  useEffect(() => {
    let timer;
    if (hostLeftCountdown !== null && hostLeftCountdown > 0) {
      timer = setTimeout(() => {
        setHostLeftCountdown(prev => prev - 1);
      }, 1000);
    } else if (hostLeftCountdown === 0) {
      // Countdown finished - Reset room state
      const resetRoom = () => {
        setRoomCode('');
        setJoinCode('');
        setHostLeftCountdown(null);
        setCurrentView('portal');
      };
      resetRoom();
    }
    return () => clearTimeout(timer);
  }, [hostLeftCountdown]);



  const processAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift();

    try {
      if (!window.sharedAudioContext) {
        window.sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // WebSocket returns binary messages as Blob. AudioContext requires ArrayBuffer.
      let arrayBuffer = buffer;
      if (buffer instanceof Blob) {
        arrayBuffer = await buffer.arrayBuffer();
      }

      // Resume context if suspended (browser autoplay policy)
      if (window.sharedAudioContext.state === 'suspended') {
        await window.sharedAudioContext.resume();
      }

      const decodedData = await window.sharedAudioContext.decodeAudioData(arrayBuffer);
      const source = window.sharedAudioContext.createBufferSource();
      source.buffer = decodedData;
      source.connect(window.sharedAudioContext.destination);
      source.onended = () => {
        if (processQueueRef.current) processQueueRef.current();
      };
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      if (processQueueRef.current) processQueueRef.current();
    }
  }, []);

  useEffect(() => {
    processQueueRef.current = processAudioQueue;
  }, [processAudioQueue]);

  const playAudioBuffer = useCallback(async (buffer) => {
    audioQueueRef.current.push(buffer);
    if (!isPlayingRef.current && processQueueRef.current) {
      processQueueRef.current();
    }
  }, []);

  const onWebSocketMessage = useCallback((data) => {
    if (data instanceof ArrayBuffer || data instanceof Blob) {
      playAudioBuffer(data);
      return;
    }

    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'transcript') {
          setTranscript(prev => prev + ' ' + msg.text);
        } else if (msg.type === 'translation') {
          setTranslatedText(prev => prev + ' ' + msg.text);
        } else if (msg.type === 'roomCreated') {
          setRoomCode(msg.roomId);
          setCurrentView('host');
          setTranscript('');
          setTranslatedText('');
          audioQueueRef.current = [];
        } else if (msg.type === 'joined') {
          setRoomCode(msg.roomId);
          setCurrentView('participant');
          setTranscript('');
          setTranslatedText('');
          audioQueueRef.current = [];
        } else if (msg.type === 'error') {
          alert('SonicBridge System: ' + msg.message);
          setCurrentView('portal');
          setRoomCode('');
          setJoinCode('');
          setHostListeners(0);
        } else if (msg.type === 'hostLeft') {
          setHostLeftCountdown(15);
        } else if (msg.type === 'userJoined' || msg.type === 'userLeft') {
          setHostListeners(msg.activeUsers || 0);
        } else if (msg.type === 'pong') {
          setHostLatency(Date.now() - msg.timestamp);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    } else {
      // Binary audio data
      playAudioBuffer(data);
    }
  }, [playAudioBuffer]);

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const fallbackUrl = isLocal ? `ws://${window.location.hostname}:5001` : 'wss://sonicbridge-backend.onrender.com';
  const wsUrl = import.meta.env.VITE_WS_URL || fallbackUrl;
  const { isConnected, sendMessage } = useWebSocket(wsUrl, onWebSocketMessage);

  // Host ping interval for real-time latency calculate
  useEffect(() => {
    let pingInterval;
    if (currentView === 'host' && isConnected) {
      pingInterval = setInterval(() => {
        sendMessage(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }, 2000);
    }
    return () => clearInterval(pingInterval);
  }, [currentView, isConnected, sendMessage]);

  const handleLanguageChange = (newLang) => {
    setTargetLang(newLang);
    if (currentView === 'participant' && roomCode) {
      setTranslatedText('');
      audioQueueRef.current = [];
      sendMessage(JSON.stringify({ type: 'updateLanguage', targetLang: newLang }));
    }
  };

  const onAudioChunk = useCallback((chunk) => {
    sendMessage(chunk);
  }, [sendMessage]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder(onAudioChunk);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      sendMessage(JSON.stringify({ type: 'stop' }));
    } else {
      setTranscript('');
      setTranslatedText('');
      sendMessage(JSON.stringify({
        type: 'start',
        sourceLang
      }));
      await startRecording();
    }
  };


  // --- Welcome View ---
  const renderWelcome = () => (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-between px-6 py-12 md:px-12 md:py-16 bg-background-light dark:bg-background-dark text-charcoal dark:text-slate-100">
      <div className="grain-overlay"></div>

      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-50">
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
          <span className="material-symbols-outlined text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>

      <div className="h-10 w-full opacity-0"></div>

      <div className="flex flex-col items-center justify-center text-center space-y-12 max-w-4xl z-10 transition-all duration-700">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-ultra dot-matrix-logo">
            SONICBRIDGE
          </h1>
          <div className="flex items-center gap-2 mt-4 opacity-40">
            <span className="w-[6px] h-[6px] rounded-full bg-primary animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-widest font-medium">System Active</span>
          </div>
        </div>

        <p className="text-charcoal/60 dark:text-slate-400 text-sm md:text-base lg:text-lg font-light tracking-wide max-w-lg leading-relaxed">
          Bridging voices through real-time AI translation.
        </p>

        <div className="pt-8">
          <button
            onClick={() => setCurrentView('portal')}
            className="group relative flex w-32 h-32 md:w-40 md:h-40 items-center justify-center rounded-full bg-charcoal dark:bg-white text-white dark:text-charcoal transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.05]"
          >
            <span className="dot-matrix-logo text-[10px] md:text-xs tracking-widest font-bold">ENTER</span>
            <span className="absolute inset-0 rounded-full border border-charcoal/10 dark:border-white/10 scale-110 group-hover:scale-125 transition-transform duration-700 opacity-0 group-hover:opacity-100"></span>
          </button>
        </div>
      </div>

      <footer className="flex w-full items-center justify-center gap-8 md:gap-16 z-10 flex-wrap">
        <button onClick={() => setCurrentView('about')} className="text-[10px] md:text-xs font-medium tracking-[0.2em] text-charcoal/40 dark:text-slate-500 hover:text-primary transition-colors duration-300">ABOUT</button>
        <button onClick={() => setCurrentView('legal')} className="text-[10px] md:text-xs font-medium tracking-[0.2em] text-charcoal/40 dark:text-slate-500 hover:text-primary transition-colors duration-300">LEGAL</button>
      </footer>

      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>
      <div class="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>
    </main>
  );

  // --- Portal View ---
  const renderPortal = () => (
    <div className="relative flex flex-col items-center justify-between min-h-screen w-full py-16 px-8 bg-paper-white dark:bg-[#0a0a0a] text-charcoal dark:text-slate-100 transition-colors">

      <header className="w-full flex justify-between px-4 mb-auto max-w-6xl mx-auto">
        <button onClick={() => setCurrentView('welcome')} className="material-symbols-outlined text-charcoal/40 dark:text-white/40 hover:opacity-100 transition-opacity">arrow_back</button>
        <div className="dot-matrix text-[10px] tracking-[0.8em] text-[#1A1A1A]/60 dark:text-white/60 select-none mr-[-0.8em]">SonicBridge</div>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="material-symbols-outlined text-charcoal/40 dark:text-white/40 hover:opacity-100 transition-opacity text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</button>
      </header>

      <main className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-6xl mx-auto my-auto z-10 mt-12 mb-12">
        {/* Create Room */}
        <div
          onClick={() => {
            sendMessage(JSON.stringify({ type: 'createRoom' }));
          }}
          className="premium-card w-full md:w-[420px] h-[480px] rounded-[32px] flex flex-col items-center justify-between p-16 text-center cursor-pointer group"
        >
          <h2 className="dot-matrix text-[10px] tracking-[0.4em] opacity-40">Create Room</h2>
          <div className="w-full flex-col flex items-center justify-center flex-1">
            <button className="w-20 h-20 rounded-full charcoal-circle flex items-center justify-center pointer-events-none">
              <div className="w-2 h-2 bg-white dark:bg-black rounded-full transition-transform group-hover:scale-150"></div>
            </button>
          </div>
          <p className="text-[9px] uppercase tracking-[0.5em] font-medium opacity-30 mt-auto">Session Start</p>
        </div>

        {/* Join Room */}
        <div className="premium-card w-full md:w-[420px] h-[480px] rounded-[32px] flex flex-col items-center justify-between p-16 text-center">
          <h2 className="dot-matrix text-[10px] tracking-[0.4em] opacity-40">Join Room</h2>
          <div className="w-full space-y-10 flex-col flex items-center justify-center flex-1">
            <input
              className="w-full max-w-[200px] bg-transparent border-0 border-b border-[#E5E5E5] dark:border-white/20 focus:border-[#1A1A1A] dark:focus:border-white focus:ring-0 text-center py-2 text-sm tracking-[0.5em] font-mono transition-colors uppercase outline-none"
              placeholder="ROOM ID"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              onClick={() => {
                // Initialize AudioContext during explicit user interaction to bypass Autoplay Policies
                if (!window.sharedAudioContext) {
                  window.sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (window.sharedAudioContext.state === 'suspended') {
                  window.sharedAudioContext.resume();
                }

                if (joinCode) {
                  const upperCode = joinCode.toUpperCase();
                  sendMessage(JSON.stringify({ type: 'joinRoom', roomId: upperCode, targetLang }));
                }
              }}
              className="btn-outline w-full max-w-[200px]"
            >
              Connect
            </button>
          </div>
          <p className="text-[9px] uppercase tracking-[0.5em] font-medium opacity-30 mt-auto">Secure Entry</p>
        </div>
      </main>

      <footer className="w-full flex flex-col items-center justify-center mt-auto gap-8">
        <div className="w-12 h-[1px] bg-[#E5E5E5] dark:bg-white/10"></div>
        <p className="text-[8px] uppercase tracking-[0.8em] opacity-20 hover:opacity-100 transition-opacity cursor-default font-medium">
          System v.1.0.42_S
        </p>
      </footer>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-12 left-12 text-[9px] font-mono tracking-widest opacity-20 rotate-90 origin-left uppercase">Bridge_Neutral_01</div>
        <div className="absolute bottom-12 right-12 text-[9px] font-mono tracking-widest opacity-20 -rotate-90 origin-right uppercase">Paper_White_Series</div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-24 bg-gradient-to-b from-[#E5E5E5] dark:from-white/10 to-transparent"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-24 bg-gradient-to-t from-[#E5E5E5] dark:from-white/10 to-transparent"></div>
      </div>
    </div>
  );

  // --- Host View ---
  const renderHost = () => (
    <div className="flex h-screen w-full flex-col bg-[#F9F9F9] dark:bg-[#0a0a0a] text-charcoal dark:text-white transition-colors">
      <header className="flex items-center justify-between px-8 md:px-16 py-12 z-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('portal')}>
          <div className="size-2 bg-charcoal dark:bg-white rounded-full"></div>
          <h2 className="text-[13px] font-medium tracking-tight">SONICBRIDGE</h2>
        </div>
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex items-center gap-2">
            <span className="small-caps text-[11px] opacity-40">SYSTEM READY</span>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="material-symbols-outlined text-charcoal/40 dark:text-white/40 hover:opacity-100 transition-opacity text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative px-6 -mt-12 overflow-y-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-1.5 border-b border-charcoal/5 dark:border-white/10 mb-4">
            <span className="small-caps text-[10px] opacity-40">PRIVATE BROADCAST ROOM</span>
          </div>
          <h1
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
            }}
            className="dot-matrix text-[6rem] md:text-[10rem] lg:text-[12rem] font-bold leading-none cursor-pointer hover:opacity-75 transition-opacity"
            title="Click to copy Room ID"
          >
            {roomCode}
          </h1>
          <div className="flex justify-center pt-2 h-4">
            <button
              onClick={() => {
                const url = window.location.href.split('?')[0]; // clean url
                navigator.clipboard.writeText(`Join my SonicBridge room: ${roomCode}\n${url}`);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="small-caps text-[10px] opacity-40 hover:opacity-100 transition-opacity tracking-widest"
            >
              {isCopied ? "COPIED TO CLIPBOARD" : "COPY ACCESS LINK"}
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center mb-10">
          <div className="absolute size-[300px] md:size-[380px] rounded-full border border-charcoal/[0.03] dark:border-white/[0.05]"></div>
          <button
            onClick={handleToggleRecording}
            className={`relative z-10 charcoal-circle flex flex-col items-center justify-center size-48 md:size-56 rounded-full group ${isRecording ? 'opacity-90' : ''}`}
          >
            <span className={`dot-matrix-btn text-white dark:text-black ml-1 ${isRecording ? 'text-red-400 dark:text-red-500' : ''}`}>
              {isRecording ? 'PAUSE' : 'START'}
            </span>
          </button>
          <div className="absolute -bottom-16 text-center">
            {isRecording ? (
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> <span className="small-caps text-[11px] opacity-80 text-red-500">MIC ACTIVE</span></div>
            ) : (
              <span className="small-caps text-[11px] opacity-40">TAP TO BROADCAST</span>
            )}
          </div>
        </div>

        {/* Translation Stream display for Host to see what's going on */}
        <div className="w-full max-w-5xl px-4 md:px-8 mt-12 mb-8">
          <div className="glass-panel rounded-2xl p-6 md:p-10 relative overflow-hidden h-36 md:h-48 flex flex-col">
            <div className="flex justify-between items-center mb-4 md:mb-8">
              <div className="flex items-center gap-4 md:gap-8">
                <div className="flex flex-col">
                  <span className="small-caps text-[9px] opacity-30 mb-1">SESSION</span>
                  <span className="small-caps text-[10px] opacity-60 text-green-500">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="small-caps text-[9px] opacity-30 mb-1">SYNC</span>
                  <span className="small-caps text-[10px] opacity-60">{isRecording ? 'ACTIVE' : 'IDLE'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 small-caps text-[10px]">
                <span className="opacity-30">SOURCE:</span>
                <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="bg-transparent opacity-80 outline-none text-right cursor-pointer">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-charcoal text-black dark:text-white">{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-auto custom-scrollbar">
              {transcript ? (
                <p className="text-sm md:text-base font-medium opacity-80 text-center px-4 leading-relaxed">
                  {transcript}
                </p>
              ) : (
                <p className="small-caps text-[11px] opacity-30 tracking-[0.2em] text-center">
                  Waiting for data stream...
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-8 md:px-16 py-8 flex items-center justify-between z-20">
        <div className="flex gap-8 md:gap-12 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="small-caps text-[9px] opacity-30">LATENCY</span>
            <span className="text-[11px] font-mono opacity-80">{hostLatency}MS</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="small-caps text-[9px] opacity-30">LISTENERS</span>
            <span className="text-[11px] font-mono opacity-80">{hostListeners}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-10">
          <button className="small-caps text-[10px] opacity-60 hover:opacity-100 transition-opacity">MICROPHONE</button>
          <div className="h-4 w-px bg-charcoal/10 dark:bg-white/10 hidden md:block"></div>
          <button onClick={() => {
            if (isRecording) handleToggleRecording();
            sendMessage(JSON.stringify({ type: 'closeRoom' }));
            setCurrentView('portal');
          }} className="small-caps text-[11px] opacity-30 hover:opacity-100 hover:text-red-500 transition-all">
            TERMINATE
          </button>
        </div>
      </footer>
    </div>
  );

  // --- Participant View ---
  const renderParticipant = () => (
    <div className="participant-bg text-charcoal dark:text-slate-100 min-h-screen flex flex-col w-full relative transition-colors duration-500">
      <header className="glass-header sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('portal')}>
            <div className="size-2 bg-charcoal dark:bg-white rounded-full"></div>
            <h2 className="text-[13px] font-medium tracking-tight">SONICBRIDGE</h2>
          </div>
          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/20 hidden md:block"></div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-primary-green animate-ping' : 'bg-red-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-primary-green' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-black/40 dark:text-slate-400">{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <label className="block px-1 text-[10px] text-black/40 dark:text-slate-500 uppercase tracking-tighter mb-1">Target Language</label>
            <div className="flex items-center border border-black/10 dark:border-white/20 rounded-lg px-2 hover:border-black/30 dark:hover:border-white/40 transition-colors cursor-pointer bg-white/40 dark:bg-black/40">
              <select value={targetLang} onChange={(e) => handleLanguageChange(e.target.value)} className="text-sm font-medium w-full py-1.5 pr-6 bg-transparent text-black dark:text-white outline-none cursor-pointer">
                {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-white text-black dark:bg-black dark:text-white">{l.name}</option>)}
              </select>
            </div>
          </div>

          {/* Theme Toggle mapped for Participant */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 rounded-full flex items-center justify-center border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-xl text-black/60 dark:text-white/60">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>

          <button onClick={() => setCurrentView('portal')} className="w-10 h-10 rounded-full flex items-center justify-center border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center opacity-40 z-10 w-full px-4 sm:px-0">
          <p className="text-[10px] uppercase tracking-[0.4em] mb-1">Live Session</p>
          <h2 className="text-sm font-light uppercase tracking-widest">{roomCode}</h2>
        </div>

        <div className="w-full max-w-4xl h-[65vh] flex flex-col gap-12 custom-scrollbar overflow-y-auto pb-32 sm:pb-24 z-10 mx-auto px-4 mt-12 sm:mt-16 transcript-container">
          <div className="mt-auto text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight text-center tracking-tight text-charcoal dark:text-white transition-opacity duration-300">
            {translatedText ? translatedText : <span className="opacity-40 italic font-light text-xl sm:text-2xl md:text-4xl text-center">Waiting for host audio...</span>}
          </div>
        </div>

        <div className="absolute bottom-6 sm:bottom-12 w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center sm:items-end px-4 sm:px-10 gap-6 sm:gap-0 pb-safe">
          <div className="flex flex-col gap-1 items-center sm:items-start text-center sm:text-left hidden md:flex">
            <span className="dot-matrix text-[10px] text-black/40 dark:text-slate-500">Signal Strength</span>
            <div className="flex gap-1 justify-center sm:justify-start">
              <div className="w-1 h-3 bg-primary-green"></div>
              <div className="w-1 h-3 bg-primary-green"></div>
              <div className="w-1 h-3 bg-primary-green"></div>
              <div className="w-1 h-3 bg-black/10 dark:bg-white/20"></div>
            </div>
          </div>

          <div className="text-center sm:text-right hidden sm:block">
            <p className="dot-matrix text-[10px] text-black/40 dark:text-slate-500 mb-1">Host Broadcast</p>
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <span className="material-symbols-outlined text-sm text-primary-green">mic</span>
              <span className="text-xs font-medium tracking-widest uppercase text-charcoal dark:text-white">Live Sync</span>
            </div>
          </div>

          <div className="sm:hidden block w-full relative">
            <label className="block px-1 text-[10px] text-black/40 dark:text-slate-500 uppercase tracking-tighter mb-1 text-center">Target Language</label>
            <div className="flex mx-auto max-w-[200px] items-center border border-black/10 dark:border-white/20 rounded-lg px-2 transition-colors cursor-pointer bg-white/40 dark:bg-black/40">
              <select value={targetLang} onChange={(e) => handleLanguageChange(e.target.value)} className="text-xs font-medium w-full py-2 bg-transparent text-charcoal dark:text-white outline-none cursor-pointer text-center">
                {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-white text-black dark:bg-black dark:text-white">{l.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed top-0 left-0 w-full h-[2px] bg-primary-green/20 overflow-hidden z-20 pointer-events-none">
        <div className="h-full bg-primary-green w-1/3 shadow-[0_0_10px_#13ec13] animate-[pulse_2s_infinite]"></div>
      </div>

      {hostLeftCountdown !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300">
          <div className="bg-paper-white dark:bg-[#0a0a0a] p-10 rounded-[32px] max-w-sm w-full text-center shadow-2xl border border-charcoal/10 dark:border-white/10 mx-4">
            <span className="material-symbols-outlined text-[40px] text-red-500 mb-6 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]">warning</span>
            <h3 className="text-xl font-bold tracking-tight text-charcoal dark:text-white mb-3">The meeting has ended</h3>
            <p className="text-sm text-charcoal/60 dark:text-slate-400 mb-4 font-medium leading-relaxed">
              The host has terminated the session.
            </p>
            <div className="flex flex-col items-center justify-center p-4 bg-charcoal/5 dark:bg-white/5 rounded-2xl mb-8">
              <span className="text-[32px] font-mono text-charcoal dark:text-white leading-none mb-1">{hostLeftCountdown}</span>
              <span className="small-caps text-[10px] opacity-40">SECONDS REMAINING</span>
            </div>
            <button
              onClick={() => { setHostLeftCountdown(null); setCurrentView('portal'); setRoomCode(''); setJoinCode(''); }}
              className="btn-outline w-full text-xs"
            >
              LEAVE NOW
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // --- About View ---
  const renderAbout = () => (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full py-16 px-8 bg-paper-white dark:bg-[#0a0a0a] text-charcoal dark:text-slate-100 transition-colors">
      <header className="absolute top-12 w-full flex justify-between px-12 max-w-6xl mx-auto">
        <button onClick={() => setCurrentView('welcome')} className="material-symbols-outlined text-charcoal/40 dark:text-white/40 hover:opacity-100 transition-opacity">arrow_back</button>
        <div className="dot-matrix text-[10px] tracking-[0.8em] text-[#1A1A1A]/60 dark:text-white/60 select-none mr-[-0.8em]">ABOUT</div>
        <div className="w-6"></div>
      </header>
      <main className="max-w-2xl text-center space-y-8 animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight">SonicBridge</h1>
        <p className="text-lg text-charcoal/60 dark:text-slate-400 font-light leading-relaxed">
          SonicBridge is a high-performance, real-time audio translation platform designed to eliminate language barriers in live environments.
          By combining browser-side WebRTC noise suppression with server-side neural filtering and speaker verification, we ensure that translation is both accurate and secure.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 text-left">
          <div className="p-6 rounded-2xl border border-charcoal/5 dark:border-white/5 bg-charcoal/[0.02] dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold mb-2">Voice Isolation</h3>
            <p className="text-xs text-charcoal/40 dark:text-slate-500">4-layer pipeline removing background noise and background voices.</p>
          </div>
          <div className="p-6 rounded-2xl border border-charcoal/5 dark:border-white/5 bg-charcoal/[0.02] dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold mb-2">Live AI Sync</h3>
            <p className="text-xs text-charcoal/40 dark:text-slate-500">Sub-second latency powered by Sarvam AI's localized language models.</p>
          </div>
        </div>
      </main>
    </div>
  );

  // --- Legal View ---
  const renderLegal = () => (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full py-16 px-8 bg-paper-white dark:bg-[#0a0a0a] text-charcoal dark:text-slate-100 transition-colors">
      <header className="absolute top-12 w-full flex justify-between px-12 max-w-6xl mx-auto">
        <button onClick={() => setCurrentView('welcome')} className="material-symbols-outlined text-charcoal/40 dark:text-white/40 hover:opacity-100 transition-opacity">arrow_back</button>
        <div className="dot-matrix text-[10px] tracking-[0.8em] text-[#1A1A1A]/60 dark:text-white/60 select-none mr-[-0.8em]">LEGAL</div>
        <div className="w-6"></div>
      </header>
      <main className="max-w-2xl text-left space-y-12 animate-fade-in">
        <section>
          <h2 className="text-xs font-bold tracking-[0.2em] mb-4 uppercase opacity-40">Privacy Policy</h2>
          <p className="text-sm text-charcoal/60 dark:text-slate-400 leading-relaxed italic">
            "Your privacy is prioritized. Audio data is processed in real-time and is NOT stored on our servers after the session expires. Speech embeddings are transient and tied only to the active room session."
          </p>
        </section>
        <section>
          <h2 className="text-xs font-bold tracking-[0.2em] mb-4 uppercase opacity-40">Terms of Service</h2>
          <p className="text-sm text-charcoal/60 dark:text-slate-400 leading-relaxed">
            By using SonicBridge, you agree to the responsible use of AI translation. This service is provided "as is" with high-reliability targets for educational and corporate bridging.
          </p>
        </section>
        <section className="pt-8 border-t border-charcoal/5 dark:border-white/5">
          <p className="text-[10px] opacity-20 tracking-widest uppercase">© 2026 SonicBridge Systems. v1.0.42_S</p>
        </section>
      </main>
    </div>
  );

  return (
    <>
      {currentView === 'welcome' && renderWelcome()}
      {currentView === 'portal' && renderPortal()}
      {currentView === 'host' && renderHost()}
      {currentView === 'participant' && renderParticipant()}
      {currentView === 'about' && renderAbout()}
      {currentView === 'legal' && renderLegal()}
    </>
  );
}

export default App;
