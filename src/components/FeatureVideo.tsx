import React, { useState, useEffect } from 'react';
import { Play, X, Monitor, Sparkles, Brain, Activity, Shield, Zap, Loader2, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function FeatureVideo() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState("");
  const { darkMode } = useSettings();

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const generateDemoVideo = async () => {
    if (!hasKey) {
      await handleSelectKey();
      return;
    }

    setIsGenerating(true);
    setIsOpen(true);
    setStatus("Initializing AI Video Engine...");

    try {
      // Create a new instance right before making the API call to ensure it uses the latest key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      
      setStatus("Crafting cinematic UI walkthrough...");
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: 'A high-tech cinematic walkthrough of a medical dashboard called MedSight 2.0. Show clean dark UI with glowing emerald green accents, floating 3D medical icons, brain scans, and real-time health charts. Professional, futuristic, and clinical aesthetic.',
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        setStatus("Rendering MedSight 2.0 visuals... " + (Math.random() * 10).toFixed(0) + "%");
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        setStatus("Finalizing demo...");
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || '',
          },
        });
        const blob = await response.blob();
        setGeneratedVideoUrl(URL.createObjectURL(blob));
      }
    } catch (error: any) {
      console.error("Video generation failed:", error);
      
      // Handle Permission Denied or Not Found errors by prompting for a new key
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("Requested entity was not found")) {
        setStatus("Permission denied. Please select a paid API key with billing enabled.");
        // Reset key state and prompt user
        setHasKey(false);
        await handleSelectKey();
      } else {
        setStatus("Generation failed: " + errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const features = [
    { icon: Brain, title: "Clinical AI", desc: "Real-time diagnosis assistance" },
    { icon: Activity, title: "Live Consultation", desc: "Voice-activated medical insights" },
    { icon: Shield, title: "Secure Records", desc: "Encrypted patient data management" },
    { icon: Zap, title: "Smart Analytics", desc: "Predictive health trends" }
  ];

  return (
    <div className={cn(
      "p-6 rounded-3xl border shadow-sm transition-all duration-300",
      darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
            <Monitor size={20} />
          </div>
          <div>
            <h3 className={cn("font-bold transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>Platform Guide</h3>
            <p className="text-xs text-zinc-500">AI-Generated Project Demo</p>
          </div>
        </div>
        <button 
          onClick={generateDemoVideo}
          disabled={isGenerating}
          className={cn(
            "px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20",
            isGenerating && "opacity-50 cursor-not-allowed"
          )}
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generatedVideoUrl ? "Watch Demo" : "Generate Demo"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div key={i} className={cn(
            "p-3 rounded-2xl border transition-colors",
            darkMode ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-50 border-zinc-100"
          )}>
            <f.icon size={16} className="text-emerald-500 mb-2" />
            <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", darkMode ? "text-zinc-400" : "text-zinc-500")}>{f.title}</p>
            <p className="text-[10px] text-zinc-500 leading-tight">{f.desc}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isGenerating && setIsOpen(false)}
            className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl w-full aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 z-10 p-3 bg-zinc-900/80 text-white rounded-2xl hover:bg-zinc-800 transition-all"
              >
                <X size={24} />
              </button>
              
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-6 text-center px-12">
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                      <Video className="absolute inset-0 m-auto text-emerald-500 animate-pulse" size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Generating Your Project Demo</h3>
                      <p className="text-zinc-400 max-w-md mx-auto">{status}</p>
                      {status.includes("Permission denied") && (
                        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-sm">
                          <p className="mb-2">This feature requires a <strong>paid API key</strong> from a Google Cloud project with billing enabled.</p>
                          <a 
                            href="https://ai.google.dev/gemini-api/docs/billing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline font-bold"
                          >
                            Learn about Gemini API Billing →
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  </div>
                ) : generatedVideoUrl ? (
                  <video 
                    autoPlay 
                    loop 
                    controls
                    className="w-full h-full object-cover"
                  >
                    <source src={generatedVideoUrl} type="video/mp4" />
                  </video>
                ) : (
                  <iframe 
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/9uOETcuFjbE?autoplay=1&mute=1&loop=1&playlist=9uOETcuFjbE&controls=0&showinfo=0&rel=0&modestbranding=1"
                    title="MedSight 2.0 Platform Guide"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                )}

                {!isGenerating && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent pointer-events-none" />
                    <div className="absolute bottom-12 left-12 right-12 space-y-4 pointer-events-none">
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
                          {generatedVideoUrl ? "AI Generated Demo" : "Feature Walkthrough"}
                        </div>
                        <div className="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-widest">
                          1080p HD
                        </div>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tight">MedSight 2.0: The Future of Clinical Intelligence</h2>
                      <p className="text-zinc-400 max-w-2xl text-lg leading-relaxed">
                        Discover how our agentic AI platform helps doctors make faster, more accurate decisions with real-time diagnostics, live voice consultation, and advanced medical research grounding.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
