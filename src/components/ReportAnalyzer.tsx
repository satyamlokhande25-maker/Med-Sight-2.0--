import React, { useState, useRef } from 'react';
import { 
  FileSearch, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  Brain, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Camera,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { getGroqVisionResponse, getGroqResponse } from '@/services/groq';
import { extractTextFromPDF, getRAGResponse } from '@/services/ragService';
import { CameraCapture } from './CameraCapture';
import { Key } from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

interface FilePreview {
  id: string;
  name: string;
  type: string;
  data: string;
  previewUrl: string;
  size: number;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export function ReportAnalyzer() {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const downloadAnalysis = async () => {
    if (!analysisRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('Generating PDF report...');

    try {
      const imgData = await domToPng(analysisRef.current, {
        scale: 2,
        backgroundColor: '#09090b',
        quality: 1
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => img.onload = resolve);
      
      const pdfHeight = (img.height * pdfWidth) / img.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Clinical_Analysis_${Date.now()}.pdf`);
      toast.success('Analysis report downloaded', { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach(selectedFile => {
      const id = Math.random().toString(36).substring(7);
      
      // Client-side size checks
      const isImage = selectedFile.type.startsWith('image/');
      const isPDF = selectedFile.type === 'application/pdf';
      const maxSize = isImage ? 4 * 1024 * 1024 : 10 * 1024 * 1024; // 4MB for images, 10MB for PDFs

      if (selectedFile.size > maxSize) {
        const errorMsg = `File too large. Max ${isImage ? '4MB' : '10MB'} for ${isImage ? 'images' : 'PDFs'}.`;
        setFiles(prev => [...prev, {
          id,
          name: selectedFile.name,
          type: selectedFile.type,
          data: '',
          previewUrl: '',
          size: selectedFile.size,
          progress: 100,
          status: 'error',
          error: errorMsg
        }]);
        toast.error(`${selectedFile.name}: ${errorMsg}`);
        return;
      }

      const newFile: FilePreview = {
        id,
        name: selectedFile.name,
        type: selectedFile.type,
        data: '',
        previewUrl: URL.createObjectURL(selectedFile),
        size: selectedFile.size,
        progress: 0,
        status: 'uploading'
      };

      setFiles(prev => [...prev, newFile]);

      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
        }
      };

      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          data: base64, 
          progress: 100, 
          status: 'ready' 
        } : f));
      };

      reader.onerror = () => {
        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: 'error', 
          error: 'Failed to read file' 
        } : f));
      };

      reader.readAsDataURL(selectedFile);
    });

    setAnalysis(null);
    setChatHistory([]);
  };

  const handleCameraCapture = (base64: string) => {
    const id = Math.random().toString(36).substring(7);
    const newFile: FilePreview = {
      id,
      name: `camera_capture_${Date.now()}.png`,
      type: 'image/png',
      data: base64.split(',')[1],
      previewUrl: base64,
      size: 0,
      progress: 100,
      status: 'ready'
    };
    setFiles(prev => [...prev, newFile]);
    setAnalysis(null);
    setChatHistory([]);
  };

  const startAnalysis = async () => {
    const readyFiles = files.filter(f => f.status === 'ready');
    if (readyFiles.length === 0) return;

    setIsAnalyzing(true);
    setNeedsKey(false);
    
    try {
      let result = "";
      let context = "";
      
      // Process all ready files to build context
      for (const file of readyFiles) {
        if (file.type === 'application/pdf') {
          const text = await extractTextFromPDF(file.data);
          context += `--- Document: ${file.name} ---\n${text}\n\n`;
        } else if (file.type === 'text/plain') {
          const text = atob(file.data);
          context += `--- Document: ${file.name} ---\n${text}\n\n`;
        } else if (file.type.startsWith('image/')) {
          const prompt = "Extract all medical findings, values, and clinical data from this image in a structured text format.";
          const visionText = await getGroqVisionResponse(prompt, { data: file.data, mimeType: file.type });
          context += `--- Image Analysis: ${file.name} ---\n${visionText}\n\n`;
        }
      }

      if (context) {
        const prompt = "Perform a comprehensive clinical analysis based on the provided medical documents and images. Identify abnormalities, critical values, and provide a structured report with Findings, Impressions, and Recommendations.";
        result = await getRAGResponse(prompt, context, []);
      } else {
        result = "No readable content found in the uploaded files.";
      }
      
      setAnalysis(result);
    } catch (error: any) {
      console.error("Analysis error:", error);
      let msg = "Error analyzing document. Please try again.";
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("limit");
      
      if (errorMsg.includes("GROQ_API_KEY_MISSING") || errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        msg = "⚠️ **API Key is missing or invalid.**\n\nPlease set `GROQ_API_KEY` in your project settings or use the 'Fix API Key' button.";
      } else if (isQuotaError) {
        setNeedsKey(true);
        msg = "❌ **Quota Exceeded.** The shared AI quota for this feature has been reached. Please select your own personal API key to continue with high-quality analysis.";
      } else if (errorMsg.includes("413")) {
        msg = "❌ **File too large.** Please upload a smaller image (under 4MB).";
      } else {
        msg = `❌ **Analysis Error:** ${errorMsg}`;
      }
      setAnalysis(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChat = async () => {
    const readyFiles = files.filter(f => f.status === 'ready');
    if (!chatInput.trim() || readyFiles.length === 0 || isChatting) return;
    
    const userMsg = { role: 'user' as const, text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setIsChatting(true);
    setNeedsKey(false);

    try {
      let context = "";
      // Re-extract context or use cached context (for simplicity we re-extract or use analysis as base)
      // In a real app, we'd cache the context
      for (const file of readyFiles) {
        if (file.type === 'application/pdf') {
          const text = await extractTextFromPDF(file.data);
          context += `--- Document: ${file.name} ---\n${text}\n\n`;
        } else if (file.type === 'text/plain') {
          const text = atob(file.data);
          context += `--- Document: ${file.name} ---\n${text}\n\n`;
        }
      }
      
      // Also include previous analysis if available
      if (analysis) {
        context += `--- Initial Analysis ---\n${analysis}\n\n`;
      }

      const result = await getRAGResponse(currentInput, context, chatHistory);
      
      setChatHistory(prev => [...prev, { role: 'model', text: result }]);
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = "I'm sorry, I encountered an error. Please try again.";
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("limit");

      if (errorMsg.includes("GROQ_API_KEY_MISSING") || errorMsg.includes("API_KEY_MISSING") || errorMsg.includes("API_KEY_DENIED") || errorMsg.includes("401") || errorMsg.includes("403")) {
        setNeedsKey(true);
        errorMessage = "⚠️ **API Key is missing or invalid.**\n\nPlease check your settings.";
      } else if (isQuotaError) {
        setNeedsKey(true);
        errorMessage = "❌ **Quota Exceeded.** Please select your own API key to continue.";
      } else {
        errorMessage = `❌ **Error:** ${errorMsg}`;
      }
      setChatHistory(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsChatting(false);
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
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Medical Report & X-ray Analyzer</h1>
        <p className="text-zinc-400 mt-2">Upload medical reports, lab results, or imaging (X-ray, MRI, CT) for AI-powered RAG analysis and clinical insights.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div 
            className={cn(
              "bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4 min-h-[300px]",
              files.length > 0 ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-emerald-500 hover:bg-zinc-950"
            )}
            onClick={() => files.length > 0 ? null : fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf,text/plain"
              multiple
              onChange={handleFileChange}
            />
            
            {files.length > 0 ? (
              <div className="w-full space-y-4">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f) => (
                    <div key={f.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4 relative group">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                        {f.type.startsWith('image/') ? (
                          <img src={f.previewUrl} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <FileText size={20} className="text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-100 truncate">{f.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${f.progress}%` }}
                              className={cn(
                                "h-full transition-all",
                                f.status === 'error' ? "bg-red-500" : "bg-emerald-500"
                              )}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 w-8">{f.progress}%</span>
                        </div>
                        {f.error && <p className="text-[10px] text-red-500 mt-1 font-medium">{f.error}</p>}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(file => file.id !== f.id)); }}
                        className="p-1.5 bg-zinc-900 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 bg-zinc-800 text-zinc-100 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all"
                  >
                    Add More
                  </button>
                  <button
                    onClick={startAnalysis}
                    disabled={isAnalyzing || files.every(f => f.status !== 'ready')}
                    className="flex-[2] py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
                  >
                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} className="text-white" />}
                    {isAnalyzing ? "Analyzing..." : "Analyze All"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center text-zinc-700 mx-auto">
                  <Upload size={32} />
                </div>
                <div>
                  <p className="text-zinc-100 font-bold">Upload Medical File</p>
                  <p className="text-zinc-500 text-sm mt-1">Drag & drop or click to upload X-rays, lab reports, or clinical notes.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 bg-zinc-800 text-zinc-100 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={14} />
                    Upload
                  </button>
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="py-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <Camera size={14} />
                    Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {showCamera && (
            <CameraCapture 
              onCapture={handleCameraCapture} 
              onClose={() => setShowCamera(false)} 
              title="Capture Medical Document"
            />
          )}

          <div className="bg-zinc-900 p-6 rounded-3xl text-zinc-100 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-xl">
                <Sparkles size={20} className="text-white" />
              </div>
              <h3 className="font-bold">Multimodal RAG</h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Our AI doesn't just read text; it "sees" medical images and correlates them with clinical knowledge to provide structured insights for doctors.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <CheckCircle2 size={20} />
                      </div>
                      <h2 className="text-xl font-bold text-zinc-100">Clinical Analysis Report</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={downloadAnalysis}
                        disabled={isExporting}
                        className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all flex items-center gap-2"
                      >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Export PDF
                      </button>
                      <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                        {needsKey && (
                          <button 
                            onClick={handleOpenKeyDialog}
                            className="mr-4 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1.5"
                          >
                            <Key size={12} />
                            Fix API Key
                          </button>
                        )}
                        <Sparkles size={14} />
                        AI POWERED BY GROQ
                      </div>
                    </div>
                  </div>

                  <div className="markdown-body" ref={analysisRef}>
                    <ReactMarkdown>{analysis}</ReactMarkdown>
                  </div>

                  <div className="mt-10 pt-8 border-t border-zinc-800">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                      <MessageSquare size={16} className="text-emerald-500" />
                      Ask Follow-up Questions
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                      {chatHistory.map((chat, i) => (
                        <div key={i} className={cn(
                          "p-4 rounded-2xl text-sm leading-relaxed",
                          chat.role === 'user' ? "bg-zinc-950 text-zinc-100 ml-12" : "bg-emerald-500/10 text-emerald-400 mr-12 border border-emerald-500/20"
                        )}>
                          <ReactMarkdown>{chat.text}</ReactMarkdown>
                        </div>
                      ))}
                      {isChatting && (
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium italic">
                          <Loader2 size={14} className="animate-spin" />
                          AI is thinking...
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                        placeholder="e.g., Are there any signs of cardiomegaly?"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pr-14 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <button 
                        onClick={handleChat}
                        disabled={!chatInput.trim() || isChatting}
                        className="absolute right-2 top-2 bottom-2 p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : isAnalyzing ? (
              <div className="bg-zinc-900 p-12 rounded-[2.5rem] border border-zinc-800 shadow-sm flex flex-col items-center justify-center gap-6 text-center h-full min-h-[500px]">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                  <Loader2 size={64} className="text-emerald-500 animate-spin relative" />
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-100">Processing Medical Data</p>
                  <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">
                    Our AI is scanning the document and correlating findings with clinical knowledge bases...
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950 p-12 rounded-[2.5rem] border border-zinc-800 flex flex-col items-center justify-center gap-6 text-center h-full min-h-[500px]">
                <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center text-zinc-700">
                  <FileSearch size={48} />
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-100">Ready for Analysis</p>
                  <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
                    Upload a medical document on the left to begin the AI-assisted clinical review.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-4">
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center gap-3">
                    <ImageIcon size={20} className="text-blue-500" />
                    <span className="text-xs font-bold text-zinc-400">X-ray / MRI</span>
                  </div>
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center gap-3">
                    <FileText size={20} className="text-emerald-500" />
                    <span className="text-xs font-bold text-zinc-400">Lab Reports</span>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

  );
}
