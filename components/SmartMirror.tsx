import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Search, Mic, ArrowRight, Play, Pause, RefreshCw, Zap, CheckCircle, Terminal, Users, Sparkles, StopCircle, Square } from 'lucide-react';
import { HackathonData } from '../types';
import { analyzeHackathonUrl, getRealTimeFeedback, analyzeVideoDemo } from '../services/geminiService';
import AnalysisResults from './AnalysisResults';

interface Log {
    msg: string;
    type: 'info' | 'success' | 'process';
}

const SmartMirror: React.FC = () => {
    // --- State ---
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<Log[]>([]);
    const [hackathonData, setHackathonData] = useState<HackathonData | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [wpm, setWpm] = useState(0);
    const [coachFeedback, setCoachFeedback] = useState("Ready when you are...");
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [view, setView] = useState<'input' | 'coach' | 'results'>('input');

    // --- Refs ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);
    const lastTranscriptTimeRef = useRef<number>(Date.now());
    const wordCountRef = useRef<number>(0);

    // --- Initialization: Camera ---
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (e) {
                console.error("Camera failed", e);
            }
        };
        initCamera();
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // --- Workflow Visualization ---
    const addLog = (msg: string, type: Log['type'] = 'info') => {
        setLogs(prev => [...prev, { msg, type }]);
    };

    const simulateWorkflow = () => {
        const steps = [
            { msg: "Connecting to Gemini 2.5 Flash...", delay: 500 },
            { msg: "Scraping hackathon URL for details...", delay: 1500 },
            { msg: "Identifying judging panel...", delay: 3000 },
            { msg: "Searching LinkedIn for judge backgrounds...", delay: 4500 },
            { msg: "Analyzing judge values & red flags...", delay: 6000 },
            { msg: "Generating demo script & strategy...", delay: 8000 },
        ];
        
        steps.forEach(step => {
            setTimeout(() => {
                if (isLoading) addLog(step.msg, 'process');
            }, step.delay);
        });
    };

    const handleAnalyze = async () => {
        if (!url) return;
        setIsLoading(true);
        setLogs([]);
        simulateWorkflow();

        try {
            const data = await analyzeHackathonUrl(url);
            addLog("Analysis Complete!", 'success');
            setTimeout(() => {
                setHackathonData(data);
                setView('coach');
                setIsLoading(false);
            }, 1000);
        } catch (e) {
            console.error(e);
            addLog("Error analyzing URL. Trying generic fallback...", 'info');
            setIsLoading(false);
        }
    };

    // --- Jarvis Voice ---
    const speakFeedback = useCallback((text: string) => {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        const googleVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
        if (googleVoice) utterance.voice = googleVoice;
        utterance.rate = 1.05;
        synth.speak(utterance);
    }, []);

    // --- Speech Analysis Logic ---
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const fullText = (finalTranscript + interimTranscript).toLowerCase();
                const now = Date.now();
                const words = fullText.trim().split(/\s+/).length;
                const minutes = (now - lastTranscriptTimeRef.current) / 60000;

                if (minutes > 0.08) {
                    const currentWPM = Math.round((words - wordCountRef.current) / minutes);
                    setWpm(currentWPM > 0 ? currentWPM : 0);
                    wordCountRef.current = words;
                    lastTranscriptTimeRef.current = now;

                    if (currentWPM > 0) {
                         // Debounced feedback request
                         getRealTimeFeedback(fullText.slice(-100), currentWPM).then(fb => {
                             setCoachFeedback(fb);
                             speakFeedback(fb);
                         });
                    }
                }
            };
            recognitionRef.current = recognition;
        }
    }, [speakFeedback]);


    const startRecording = () => {
        if (!streamRef.current) return;
        chunksRef.current = [];
        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9' });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setRecordedBlob(blob);
            setView('results');
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        recognitionRef.current?.start();
        setRecordingTime(0);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            recognitionRef.current?.stop();
            window.speechSynthesis.cancel();
        }
    };

    // Timer
    useEffect(() => {
        let interval: any;
        if (isRecording) {
            interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- Render ---

    // 1. Results View (Separate Component integration)
    if (view === 'results' && recordedBlob && hackathonData) {
        return <AnalysisResults videoBlob={recordedBlob} hackathonData={hackathonData} onRetry={() => {
            setRecordedBlob(null);
            setView('coach');
        }} />;
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
            
            {/* BACKGROUND: Smart Mirror Camera */}
            <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-all duration-700 ${isLoading ? 'blur-sm brightness-50' : 'brightness-75'}`}
            />
            
            {/* OVERLAY: Gradient Vignet */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>

            {/* HEADER */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-rose-300" />
                    </div>
                    <div>
                        <h1 className="font-serif text-xl font-bold tracking-tight">HackJudge AI</h1>
                        <p className="text-xs text-white/50 uppercase tracking-widest">Mirror Mode</p>
                    </div>
                </div>
                {view === 'coach' && (
                    <div className="bg-red-500/20 backdrop-blur border border-red-500/30 px-4 py-1.5 rounded-full flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-red-500 ${isRecording ? 'animate-pulse' : ''}`}></div>
                        <span className="text-xs font-mono font-bold">{isRecording ? 'REC' : 'STANDBY'}</span>
                        <span className="text-xs font-mono w-10">{formatTime(recordingTime)}</span>
                    </div>
                )}
            </div>

            {/* VIEW 1: INPUT & LOGS */}
            {view === 'input' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
                    
                    {/* Input Box */}
                    <div className={`transition-all duration-500 transform ${isLoading ? '-translate-y-12 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                        <h2 className="text-4xl md:text-5xl font-serif text-center mb-8 drop-shadow-xl">
                            Win your next <span className="text-rose-300 italic">Hackathon</span>.
                        </h2>
                        
                        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-2 flex items-center shadow-2xl">
                             <div className="pl-4 text-white/50">
                                <Search className="w-5 h-5" />
                            </div>
                            <input 
                                type="text" 
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Paste Luma or Devpost link..." 
                                className="w-full bg-transparent border-none text-white text-lg px-4 py-4 focus:ring-0 placeholder-white/30 outline-none font-medium"
                                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            />
                            <button 
                                onClick={handleAnalyze}
                                className="bg-white text-black hover:bg-rose-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                            >
                                Analyze <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Workflow Terminal (Appears during Loading) */}
                    {isLoading && (
                        <div className="absolute bottom-24 w-full max-w-xl">
                            <div className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-mono text-white/60 uppercase">Processing Chamber</span>
                                </div>
                                <div className="p-4 font-mono text-sm space-y-2 h-48 overflow-y-auto flex flex-col-reverse">
                                     {logs.map((log, i) => (
                                         <div key={i} className={`flex items-center gap-3 animate-slide-up ${log.type === 'success' ? 'text-emerald-400' : 'text-white/80'}`}>
                                             <span className="text-white/20">Step {i+1}:</span>
                                             {log.type === 'process' && <div className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />}
                                             {log.msg}
                                         </div>
                                     ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: COACH (Mirror Overlay) */}
            {view === 'coach' && hackathonData && (
                <div className="absolute inset-0 z-20 flex p-6 pt-24 gap-6">
                    
                    {/* LEFT PANEL: Strategy & Script */}
                    <div className="w-1/3 h-full flex flex-col gap-4 animate-fade-in-left">
                        
                        {/* Judges Summary */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="w-4 h-4 text-rose-300" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">The Panel</h3>
                            </div>
                            <div className="space-y-3">
                                {hackathonData.judges.slice(0, 3).map((j, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">{j.name[0]}</div>
                                        <div className="overflow-hidden">
                                            <div className="text-sm font-bold truncate">{j.name}</div>
                                            <div className="text-xs text-white/50 truncate">{j.role} @ {j.company}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Script Teleprompter */}
                        <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 overflow-hidden relative group">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-4 sticky top-0">Your Script</h3>
                            <div className="h-full overflow-y-auto scrollbar-hide text-lg leading-relaxed font-medium text-white/90 space-y-4 pb-20">
                                {hackathonData.strategy?.generatedScript?.split('\n\n').map((p, i) => (
                                    <p key={i} className="hover:text-rose-200 transition-colors cursor-pointer">{p}</p>
                                )) || <p>Script not available.</p>}
                            </div>
                            {/* Fade at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                        </div>
                    </div>

                    {/* CENTER: Clean Camera View (No overlay) */}
                    <div className="flex-1"></div>

                    {/* RIGHT PANEL: Live Feedback */}
                    <div className="w-80 h-full flex flex-col justify-end gap-4 animate-fade-in-right pb-12">
                         
                         {/* Live WPM */}
                         {isRecording && (
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                                <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Pace</div>
                                <div className="flex items-end gap-2">
                                    <span className={`text-4xl font-bold ${wpm > 160 ? 'text-rose-400' : 'text-white'}`}>{wpm}</span>
                                    <span className="text-sm mb-1">wpm</span>
                                </div>
                            </div>
                         )}

                         {/* Coach Box */}
                         <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Jarvis Coach</h3>
                            </div>
                            <p className="text-xl font-serif italic text-rose-100 leading-snug">
                                "{coachFeedback}"
                            </p>
                         </div>

                         {/* Controls */}
                         <div className="flex justify-center pt-4">
                            {!isRecording ? (
                                <button onClick={startRecording} className="bg-white text-black hover:scale-105 transition-transform rounded-full w-16 h-16 flex items-center justify-center shadow-lg shadow-rose-500/20">
                                    <div className="w-6 h-6 bg-rose-500 rounded-full"></div>
                                </button>
                            ) : (
                                <button onClick={stopRecording} className="bg-white text-black hover:scale-105 transition-transform rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
                                    <Square className="w-6 h-6 fill-black" />
                                </button>
                            )}
                         </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default SmartMirror;