import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Loader2, 
  Maximize2,
  AlertCircle,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { generateImage } from '@/services/gemini';
import { toast } from 'sonner';

export function MedicalImaging() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Analyzing anatomical request...",
    "Consulting medical database...",
    "Synthesizing clinical visualization...",
    "Applying high-definition textures...",
    "Finalizing medical illustration..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 4000);
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
        // The user might have cancelled or selected. 
        // We proceed and let the API call fail gracefully if still no key.
      }
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setIsFallback(false);
    setError(null);
    setNeedsKey(false);

    try {
      const result = await generateImage(prompt, aspectRatio);
      setGeneratedImage(result.url);
      setIsFallback(result.isFallback);
    } catch (error: any) {
      console.error("Image generation error:", error);
      const errorMsg = error.message || "";
      
      if (errorMsg === "QUOTA_EXCEEDED") {
        setNeedsKey(true);
        setError("The shared AI quota for image generation has been exceeded. To continue generating high-quality medical images, please select your own personal API key.");
      } else if (errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        setError("Gemini API Key is required or has been denied. Please select a valid paid API key.");
      } else {
        // If it's not a quota or key error, it might be a general error.
        // The service already falls back to Pollinations, so we shouldn't reach here 
        // unless Pollinations also fails.
        setError(`Error generating image: ${errorMsg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      handleGenerate(); // Retry after key selection
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Medical Imaging & Visualization</h1>
        <p className="text-zinc-400 mt-2">Generate high-quality medical diagrams and patient education visuals using AI.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Visualization Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Cross-section of a human heart showing mitral valve prolapse..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-2">
                {['1:1', '3:4', '4:3', '16:9'].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold transition-all border",
                      aspectRatio === ratio 
                        ? "bg-emerald-500 text-white border-emerald-500" 
                        : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-emerald-500"
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating Visualization...
                </>
              ) : (
                <>
                  <Sparkles size={20} className="text-white" />
                  Generate Medical Image
                </>
              )}
            </button>
          </div>

          <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20 flex gap-4">
            <div className="p-2 bg-emerald-500 rounded-xl text-white shrink-0 h-fit">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">AI Visualization Disclaimer</p>
              <p className="text-xs text-emerald-200/60 mt-1 leading-relaxed">
                These images are AI-generated for educational and visualization purposes. They should not be used for diagnostic purposes or as a primary source of clinical truth.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 min-h-[400px] flex items-center justify-center relative overflow-hidden group">
          <AnimatePresence mode="wait">
            {generatedImage ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full flex items-center justify-center p-4"
              >
                <img 
                  src={generatedImage} 
                  alt="Generated Medical Visualization" 
                  className="max-w-full max-h-full rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
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
                <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={generatedImage} 
                    download="medical-visualization.png"
                    className="p-3 bg-zinc-900/90 backdrop-blur rounded-xl text-zinc-100 hover:bg-zinc-800 transition-all shadow-lg"
                  >
                    <Download size={20} />
                  </a>
                  <button 
                    onClick={() => window.open(generatedImage, '_blank')}
                    className="p-3 bg-zinc-900/90 backdrop-blur rounded-xl text-zinc-100 hover:bg-zinc-800 transition-all shadow-lg"
                  >
                    <Maximize2 size={20} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center space-y-4 px-6">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mx-auto">
                  <ImageIcon size={32} />
                </div>
                <div>
                  <p className="text-zinc-100 font-bold">No Image Generated</p>
                  <p className="text-zinc-500 text-sm mt-1">Enter a prompt and click generate to create a medical visualization.</p>
                </div>
              </div>
            )}
          </AnimatePresence>

          {isGenerating && (
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-emerald-500 font-bold animate-pulse">{loadingMessages[loadingMessageIndex]}</p>
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
