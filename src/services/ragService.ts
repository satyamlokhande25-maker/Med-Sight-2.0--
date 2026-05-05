import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure pdfjs worker using local file via Vite for reliability
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    console.log("Starting PDF extraction...");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const loadingTask = pdfjs.getDocument({ 
      data: bytes,
      useWorkerFetch: true,
      isEvalSupported: false,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (item as any).str)
          .join(" ")
          .replace(/\s+/g, ' ')
          .trim();
        
        fullText += `[Page ${i}]\n${pageText}\n\n`;
      } catch (pageError) {
        console.warn(`Error extracting text from page ${i}:`, pageError);
        fullText += `[Page ${i} - Extraction Error]\n`;
      }
    }
    
    if (!fullText.trim()) {
      throw new Error("No text could be extracted from the PDF. It might be an image-only PDF or encrypted.");
    }
    
    return fullText;
  } catch (error: any) {
    console.error("Detailed PDF Extraction Error:", error);
    throw new Error(`PDF Extraction Failed: ${error.message || "Unknown error"}`);
  }
}

import { fetchWithRetry } from '../lib/fetchWithRetry';
import { getGeminiResponse } from './gemini';

export async function getRAGResponse(
  question: string, 
  context: string, 
  history: { role: 'user' | 'model', text: string }[]
): Promise<string> {
  const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

  try {
    const response = await fetchWithRetry("/api/rag/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context, history: historyText }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("NON_JSON_RESPONSE");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "RAG_API_ERROR");
    }

    return data.content;
  } catch (error: any) {
    console.error("RAG API Error, attempting Gemini fallback:", error);
    
    // Fallback to Gemini for RAG
    try {
      const prompt = `
        You are a highly skilled medical assistant. Use the following extracted medical information and conversation history to answer the doctor's question.
        If the information is not in the context, say you don't know based on the provided documents.
        Be precise, professional, and highlight any critical findings.

        Context:
        ${context}

        Conversation History:
        ${historyText}

        Question: ${question}
      `;
      
      return await getGeminiResponse(prompt);
    } catch (fallbackError) {
      console.error("Gemini RAG fallback also failed:", fallbackError);
      throw error;
    }
  }
}
