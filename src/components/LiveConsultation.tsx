import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Activity,
  User,
  Bot,
  Zap,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { liveModel, getApiKey } from '@/services/gemini';
import { Key } from 'lucide-react';

export function LiveConsultation() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [needsKey, setNeedsKey] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopConsultation();
    };
  }, []);

  const startConsultation = async () => {
    setIsConnecting(true);
    setTranscript([]);
    setNeedsKey(false);

    try {
      const apiKey = getApiKey(true);
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      const session = await ai.live.connect({
        model: liveModel,
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playAudio(base64Audio);
            }
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setTranscript(prev => [...prev, { role: 'model', text: message.serverContent!.modelTurn!.parts[0].text! }]);
            }
          },
          onclose: () => {
            stopConsultation();
          },
          onerror: (error) => {
            console.error("Live API error:", error);
            stopConsultation();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Medsight AI, a real-time clinical assistant. You are helping a doctor during a consultation. Provide quick, accurate medical insights and help with diagnosis based on the conversation.",
        },
      });
      sessionRef.current = session;
    } catch (error: any) {
      console.error("Failed to connect to Live API:", error);
      setIsConnecting(false);
      
      let errorMessage = "Failed to connect to Live API. Please try again.";
      if (error.message === "API_KEY_MISSING" || error.message === "API_KEY_DENIED" || error.message.includes("403")) {
        setNeedsKey(true);
        errorMessage = "⚠️ **Gemini API Key is missing or denied.**\n\nPlease select a valid paid API key to use Live Consultation.";
      }
      setTranscript(prev => [...prev, { role: 'model', text: errorMessage }]);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  const stopConsultation = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => console.error("Error closing AudioContext:", err));
    }
    audioContextRef.current = null;
    
    setIsConnected(false);
    setIsConnecting(false);
  };

  const startAudioCapture = async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };
    } catch (error) {
      console.error("Microphone access error:", error);
    }
  };

  const playAudio = (base64Data: string) => {
    if (!isSpeakerOn || !audioContextRef.current || audioContextRef.current.state === 'closed') return;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }
    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden relative">
      <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
            isConnected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-800 text-zinc-400"
          )}>
            <Mic size={24} className={isConnected ? "animate-pulse" : ""} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Live AI Consultation</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
              )} />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {isConnected ? "CONNECTED - LOW LATENCY" : isConnecting ? "CONNECTING..." : "READY TO START"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {needsKey && (
            <button 
              onClick={handleOpenKeyDialog}
              className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
            >
              <Key size={12} />
              Fix API Key
            </button>
          )}
          <div className="px-4 py-2 bg-zinc-800 rounded-xl flex items-center gap-2 text-zinc-400 text-xs font-bold">
            <Zap size={14} className="text-emerald-500" />
            GEMINI 2.5 NATIVE AUDIO
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto space-y-8 scrollbar-hide">
        {!isConnected && !isConnecting ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="relative w-32 h-32 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-emerald-500">
                <Mic size={48} />
              </div>
            </div>
            <div className="max-w-md space-y-4">
              <h3 className="text-2xl font-bold text-zinc-100">Start Real-time Consultation</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Connect with Medsight AI for a low-latency voice consultation. The AI will listen and respond in real-time to help you during patient visits.
              </p>
              <button 
                onClick={startConsultation}
                className="px-10 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20"
              >
                Connect Now
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              <div className="flex items-center gap-4">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: isMuted ? 4 : [10, Math.random() * 60 + 20, 10],
                      opacity: isMuted ? 0.3 : 1
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.5, 
                      delay: i * 0.05 
                    }}
                    className="w-1.5 bg-emerald-500 rounded-full"
                  />
                ))}
              </div>
              <p className="text-zinc-500 font-medium text-sm animate-pulse">
                {isMuted ? "Microphone Muted" : "AI is listening..."}
              </p>
            </div>

            <div className="space-y-4">
              {transcript.map((t, i) => (
                <motion.div
                  initial={{ opacity: 0, x: t.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={cn(
                    "flex gap-3",
                    t.role === 'user' ? "flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    t.role === 'user' ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500 text-white"
                  )}>
                    {t.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed max-w-[80%]",
                    t.role === 'user' ? "bg-zinc-900 text-zinc-300" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  )}>
                    {t.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-center gap-6">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          disabled={!isConnected}
          className={cn(
            "p-5 rounded-2xl transition-all shadow-lg",
            isMuted ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
          )}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button 
          onClick={stopConsultation}
          disabled={!isConnected && !isConnecting}
          className="p-6 bg-red-600 text-white rounded-3xl hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20"
        >
          <PhoneOff size={32} />
        </button>

        <button 
          onClick={() => setIsSpeakerOn(!isSpeakerOn)}
          disabled={!isConnected}
          className={cn(
            "p-5 rounded-2xl transition-all shadow-lg",
            !isSpeakerOn ? "bg-zinc-800 text-zinc-600" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
          )}
        >
          {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
      </div>

      {isConnecting && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-50">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
            <Loader2 size={64} className="text-emerald-500 animate-spin relative" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-zinc-100">Establishing Secure Connection</p>
            <p className="text-zinc-500 text-sm">Connecting to Gemini Live API...</p>
          </div>
        </div>
      )}
    </div>
  );
}
