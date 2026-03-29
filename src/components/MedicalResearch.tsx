import React, { useState } from 'react';
import { 
  Search, 
  BookOpen, 
  ExternalLink, 
  Globe, 
  Loader2, 
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { getGroqResponse } from '@/services/groq';
import { Key, Settings } from 'lucide-react';

export function MedicalResearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{ text: string; sources: any[] } | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setResult(null);
    setNeedsKey(false);

    try {
      const prompt = `You are a medical research assistant. Provide a highly detailed, evidence-based summary of the latest research and clinical insights for the following query: "${query}". Include citations if possible (even if they are from your training data). Structure your response with clear headings.`;
      const response = await getGroqResponse([{ role: 'user', content: prompt }]);
      setResult({ text: response, sources: [] });
    } catch (error: any) {
      console.error("Search error:", error);
      let msg = "Error performing search. Please try again.";
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("limit");

      if (errorMsg.includes("GROQ_API_KEY_MISSING") || errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        msg = "⚠️ **API Key is missing or invalid.**\n\nPlease check your settings or use the 'Fix API Key' button.";
      } else if (isQuotaError) {
        setNeedsKey(true);
        msg = "❌ **Quota Exceeded.** The shared AI quota has been reached. Please select your own personal API key to continue.";
      } else {
        msg = `❌ **Error:** ${errorMsg}`;
      }
      setResult({ text: msg, sources: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenSettings = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Medical Research & Insights</h1>
        <p className="text-zinc-400 mt-2">Access the latest medical research, clinical trials, and evidence-based insights powered by Groq's high-speed inference.</p>
      </header>

      <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm space-y-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for clinical guidelines, drug interactions, or recent medical breakthroughs..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 pr-32 text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className="absolute right-3 top-3 bottom-3 px-8 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20"
          >
            {isSearching ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Search size={20} />
                Search
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="bg-zinc-950 p-8 rounded-3xl border border-zinc-800 leading-relaxed text-zinc-300">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest mb-4">
                      {needsKey && (
                        <button 
                          onClick={handleOpenSettings}
                          className="mr-4 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
                        >
                          <Settings size={12} />
                          Set Groq Key
                        </button>
                      )}
                      <Sparkles size={14} />
                      AI SYNTHESIZED INSIGHTS
                    </div>
                    <div className="markdown-body">
                      <ReactMarkdown>{result.text}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ) : isSearching ? (
                <div className="bg-zinc-950 p-12 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="text-zinc-100 font-bold">Scanning Medical Databases...</p>
                    <p className="text-zinc-500 text-sm mt-1">Synthesizing up-to-date clinical information from trusted sources.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-950 p-12 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700">
                    <BookOpen size={32} />
                  </div>
                  <div>
                    <p className="text-zinc-100 font-bold">Start Your Research</p>
                    <p className="text-zinc-500 text-sm mt-1">Enter a query above to get AI-powered insights from Groq's medical knowledge base.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Globe size={16} className="text-emerald-500" />
              Verified Sources
            </h3>
            <div className="space-y-3">
              {result && result.sources.length > 0 ? (
                result.sources.map((source: any, i: number) => (
                  <a
                    key={i}
                    href={source.web?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Source {i + 1}</span>
                      <ExternalLink size={14} className="text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-zinc-100 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {source.web?.title || 'Medical Resource'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2 truncate">{source.web?.uri}</p>
                  </a>
                ))
              ) : (
                <div className="p-8 border-2 border-dashed border-zinc-800 rounded-3xl text-center">
                  <p className="text-xs text-zinc-600 font-medium italic">Sources will appear here after your search.</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-950 p-6 rounded-3xl text-zinc-100 border border-zinc-800 space-y-4">
              <h4 className="font-bold flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                Research Tips
              </h4>
              <ul className="space-y-3 text-xs text-zinc-500 font-medium">
                <li className="flex gap-2">
                  <ArrowRight size={14} className="text-emerald-500 shrink-0" />
                  Be specific with drug names and dosages.
                </li>
                <li className="flex gap-2">
                  <ArrowRight size={14} className="text-emerald-500 shrink-0" />
                  Ask for recent clinical trial results (2024-2025).
                </li>
                <li className="flex gap-2">
                  <ArrowRight size={14} className="text-emerald-500 shrink-0" />
                  Request evidence-based treatment protocols.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
