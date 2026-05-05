import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Sparkles, 
  Loader2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download,
  RotateCcw,
  Clock,
  Layout,
  Type,
  Film,
  Image as ImageIcon,
  AlertCircle,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { generateImage, generateVideo } from '@/services/gemini';
import { toast } from 'sonner';

export function PatientEducation() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVisual, setGeneratedVisual] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [visualType, setVisualType] = useState<'image' | 'video'>('image');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Analyzing medical request...",
    "Synthesizing anatomical data...",
    "Rendering high-definition visual...",
    "Applying clinical accuracy filters...",
    "Finalizing educational content...",
    "Almost ready, medical visuals take time to perfect..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 5000);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    // Proactively check for API key for Video/High-end Image generation
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }

    setIsGenerating(true);
    setGeneratedVisual(null);
    setIsFallback(false);
    setError(null);
    setNeedsKey(false);
    setStatus(`Generating educational ${visualType}...`);

    try {
      let result;
      if (visualType === 'image') {
        const imageResult = await generateImage(prompt, '16:9');
        result = imageResult.url;
        setIsFallback(imageResult.isFallback);
      } else {
        result = await generateVideo(prompt, '16:9');
        setIsFallback(false);
      }
      setGeneratedVisual(result);
      setStatus('');
    } catch (error: any) {
      console.error("Generation error:", error);
      const errorMsg = error.message || "";
      if (errorMsg === "QUOTA_EXCEEDED") {
        setNeedsKey(true);
        setError("The shared AI quota for this feature has been exceeded. Please select your own personal API key to continue.");
      } else if (errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        setError(`A Paid Gemini API Key is required for ${visualType} generation. Please select a key from a project with billing enabled.`);
      } else {
        setError(`Error generating ${visualType}: ${errorMsg}`);
      }
      setStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      handleGenerate();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Patient Education</h1>
        <p className="text-zinc-400 mt-2">Create high-quality medical illustrations and educational videos to help patients understand their conditions.</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between gap-3 text-red-500">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
          {needsKey && (
            <button 
              onClick={handleOpenKeyDialog}
              className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all flex items-center gap-2"
            >
              <Key size={14} />
              Select API Key
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Visual Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setVisualType('image')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all",
                    visualType === 'image' 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  <ImageIcon size={18} />
                  <span className="text-xs font-bold uppercase">Image</span>
                </button>
                <button
                  onClick={() => setVisualType('video')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all",
                    visualType === 'video' 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  <Film size={18} />
                  <span className="text-xs font-bold uppercase">Video</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Educational Topic</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., How insulin works in the body for a type 2 diabetic patient..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                rows={4}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating {visualType}...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate {visualType === 'image' ? 'Visual' : 'Video'}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {generatedVisual ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl"
              >
                <div className="aspect-video bg-black relative group">
                  {visualType === 'video' && generatedVisual ? (
                    <video 
                      src={generatedVisual} 
                      controls 
                      className="w-full h-full object-contain"
                      autoPlay
                    />
                  ) : (
                    <img 
                      src={generatedVisual || ''} 
                      alt="Educational Visual" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {isFallback && (
                    <div className="absolute bottom-6 left-6 right-6 bg-amber-500/90 backdrop-blur p-3 rounded-xl flex items-center justify-between gap-3 text-white shadow-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <p className="text-[10px] font-bold uppercase tracking-wider">Shared Quota Exceeded • Fallback Mode</p>
                      </div>
                      <button 
                        onClick={handleOpenKeyDialog}
                        className="px-3 py-1 bg-white text-amber-600 rounded-lg text-[10px] font-bold hover:bg-zinc-100 transition-all flex items-center gap-1"
                      >
                        <Key size={10} />
                        Use Personal Key
                      </button>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <a 
                      href={generatedVisual || ''} 
                      download={`medical-education-${visualType}.png`}
                      className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
                    >
                      <Download size={24} />
                    </a>
                  </div>
                </div>
                <div className="p-6 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      {visualType === 'image' ? <ImageIcon size={20} /> : <Film size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-100">Educational {visualType === 'image' ? 'Visual' : 'Video'} Ready</p>
                      <p className="text-xs text-zinc-500">High-resolution medical {visualType}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGeneratedVisual(null)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-3xl h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
                {isGenerating ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div>
                      <p className="text-zinc-100 font-bold">{loadingMessages[loadingMessageIndex]}</p>
                      <p className="text-zinc-500 text-sm mt-1">Creating a detailed visual explanation for your patient.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700 mb-6">
                      <Video size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-300">Ready to Generate</h3>
                    <p className="text-zinc-500 max-w-md mt-2">
                      Enter a medical topic to create a high-quality visual guide for patient education.
                    </p>
                  </>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
