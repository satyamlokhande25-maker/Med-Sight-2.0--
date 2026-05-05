import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Trash2, AlertCircle, Zap, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { getGroqResponse } from '@/services/groq';

import { AuthProvider, useAuth } from '@/contexts/AuthProvider';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: `Hello Dr. ${user?.displayName || 'Doctor'}. I am Medsight AI, your clinical assistant powered by Groq. How can I help you analyze patient data or research medical information today?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setNeedsKey(false);

    try {
      const groqMessages = newMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.text
      }));
      
      const response = await getGroqResponse(groqMessages);
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      
      let errorMessage = "I'm sorry, I encountered an error. Please try again.";
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("limit");

      if (errorMsg.includes("GROQ_API_KEY_MISSING") || errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        errorMessage = "⚠️ **API Key is missing or invalid.**\n\nPlease check your settings or use the 'Fix API Key' button.";
      } else if (isQuotaError) {
        setNeedsKey(true);
        errorMessage = "❌ **Quota Exceeded.** The shared AI quota has been reached. Please select your own personal API key to continue.";
      } else {
        errorMessage = `❌ **Error:** ${errorMsg}`;
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-zinc-900 rounded-3xl border border-zinc-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Clinical Assistant</h2>
            <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
              <Zap size={12} className="fill-emerald-500" />
              AI POWERED BY GROQ (LLAMA 3.3)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
        {needsKey && (
          <button 
            onClick={handleOpenSettings}
            className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
          >
            <Key size={12} />
            Set Groq Key
          </button>
        )}
          <button 
            onClick={() => {
              setMessages([messages[0]]);
              setNeedsKey(false);
            }}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={cn(
              "flex gap-4 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-400"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-emerald-500 text-white rounded-tr-none" 
                : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700"
            )}>
              <div className="markdown-body">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-zinc-800 text-zinc-500 rounded-tl-none border border-zinc-700 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-zinc-950/50 border-t border-zinc-800">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything about patient symptoms, drug interactions, or research..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pr-14 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none shadow-sm"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 mt-3 text-center font-medium uppercase tracking-wider">
          AI-generated content should be verified by a licensed medical professional.
        </p>
      </div>

    </div>
  );
}
