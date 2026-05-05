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
import { getGeminiResponse, liteModel } from '../services/gemini';
import { getGroqResponse } from '../services/groq';
import { toast } from 'sonner';

export function MedicalResearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [result, setResult] = useState<{ text: string; sources: any[]; searchEntryPoint?: string } | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setResult(null);
    setNeedsKey(false);

    try {
      // Step 1: Attempt to get search grounding from Gemini (using Lite for best quota availability)
      let searchSources: any[] = [];
      let searchEntryPoint: string | undefined = undefined;

      try {
        const tools = [{ googleSearch: {} }];
        const systemInstruction = "You are a medical research search engine. Your ONLY task is to find high-quality, verified medical sources and clinical trials. Return a list of the most relevant sources found.";
        
        // Use liteModel (Gemini 1.5 Flash) for best quota reliability
        // Pass tools at the top level for better SDK support
        const searchResponse = await getGeminiResponse(query, liteModel, { systemInstruction }, tools as any);
        
        if (typeof searchResponse === 'object' && searchResponse.groundingMetadata) {
          const metadata = searchResponse.groundingMetadata;
          
          if (metadata.groundingChunks) {
            searchSources = metadata.groundingChunks
              .map((chunk: any) => chunk.web || chunk.place)
              .filter((source: any) => source && (source.uri || source.uri) && (source.title || source.placeName))
              .map((source: any) => ({
                title: source.title || source.placeName,
                uri: source.uri
              }));
          }
          
          searchEntryPoint = metadata.searchEntryPoint?.renderedContent;
        }
      } catch (searchError: any) {
        const errorMsg = searchError.message?.toLowerCase() || "";
        const isQuotaError = errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted");
        
        if (isQuotaError) {
          console.warn("Search grounding quota hit, proceeding with Groq knowledge base.");
          toast.info("Live search quota reached. Using AI medical knowledge base.", {
            description: "For live web search, please add your own API key in settings."
          });
        } else {
          console.warn("Search grounding failed:", searchError);
        }
      }

      // Step 2: Use Groq for high-performance synthesis
      const searchContext = searchSources.length > 0 
        ? `\n\nVerified Search Results for context:\n${searchSources.map((s, i) => `[Source ${i+1}]: ${s.title} - ${s.uri}`).join('\n')}`
        : "";

      const groqMessages = [
        { 
          role: 'system' as const, 
          content: `You are a world-class medical research assistant. Provide a highly detailed, evidence-based summary of the latest research and clinical insights. 
          
          CRITICAL INSTRUCTIONS:
          1. Provide specific clinical data, trial results, or guideline updates.
          2. Use the provided search results if available to ground your answer in the latest evidence.
          3. If no search results are provided, rely on your extensive internal medical knowledge.
          4. Structure your response with clear headings (e.g., Clinical Overview, Recent Breakthroughs, Treatment Protocols).
          5. Include a medical disclaimer at the end.${searchContext}` 
        },
        { role: 'user' as const, content: query }
      ];

      const groqResponse = await getGroqResponse(groqMessages);
      
      setResult({ 
        text: groqResponse || "No insights generated.", 
        sources: searchSources, 
        searchEntryPoint: searchEntryPoint 
      });

    } catch (error: any) {
      console.error("Search error:", error);
      const errorMsg = error.message?.toLowerCase() || "";
      const isQuotaError = errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted");
      let msg = error.message || "Error performing search. Please try again.";

      if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("not found") || error.message?.includes("MISSING")) {
        msg = "⚠️ **API Key Issue.** Please check your Gemini API key in the project settings or use the 'Fix API Key' button.";
        setNeedsKey(true);
      } else if (isQuotaError) {
        msg = "❌ **Quota Exceeded.** The shared AI quota for this feature has been reached. Please select your own personal API key to continue with high-quality research.";
        setNeedsKey(true);
      }
      
      setResult({ text: msg, sources: [] });
      toast.error(isQuotaError ? "Quota Exceeded" : "Search Error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Medical Research & Insights</h1>
        <p className="text-zinc-400 mt-2">Access the latest medical research, clinical trials, and evidence-based insights powered by Groq AI with real-time search grounding.</p>
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
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest">
                        <Sparkles size={14} />
                        GROQ POWERED MEDICAL INSIGHTS
                      </div>
                      {needsKey && (
                        <button 
                          onClick={handleOpenKeyDialog}
                          className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
                        >
                          <AlertCircle size={12} />
                          Fix API Key
                        </button>
                      )}
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
                    <p className="text-zinc-500 text-sm mt-1">Enter a query above to get AI-powered insights from real-time medical databases.</p>
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
              {result && result.searchEntryPoint && (
                <div 
                  className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden [&_a]:text-emerald-500 [&_a]:font-bold [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:text-xs [&_a]:uppercase [&_a]:tracking-wider"
                  dangerouslySetInnerHTML={{ __html: result.searchEntryPoint }}
                />
              )}
              {result && result.sources.length > 0 ? (
                result.sources.map((source: any, i: number) => (
                  <a
                    key={i}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Source {i + 1}</span>
                      <ExternalLink size={14} className="text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-zinc-100 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {source.title || 'Medical Resource'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2 truncate">{source.uri}</p>
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
