import { fetchWithRetry } from "../lib/fetchWithRetry";
import { getGeminiResponse, analyzeMedicalDocument } from "./gemini";

export const getGroqResponse = async (messages: { role: 'user' | 'assistant' | 'system', content: string }[]) => {
  try {
    const response = await fetchWithRetry("/api/groq/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("NON_JSON_RESPONSE");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GROQ_API_ERROR");
    }

    return data.content;
  } catch (error: any) {
    console.error("Groq API Error, attempting Gemini fallback:", error);
    
    // Fallback to Gemini if Groq fails
    try {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";
      const systemMessage = messages.find(m => m.role === 'system')?.content || "";
      const fullPrompt = systemMessage ? `${systemMessage}\n\nUser: ${lastUserMessage}` : lastUserMessage;
      
      return await getGeminiResponse(fullPrompt);
    } catch (fallbackError) {
      console.error("Gemini fallback also failed:", fallbackError);
      throw error; // Throw original error if fallback also fails
    }
  }
};

export const getGroqVisionResponse = async (prompt: string, fileData: { data: string, mimeType: string }) => {
  try {
    const response = await fetchWithRetry("/api/groq/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, fileData }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("NON_JSON_RESPONSE");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GROQ_API_ERROR");
    }

    return data.content;
  } catch (error: any) {
    console.error("Groq Vision API Error, attempting Gemini fallback:", error);
    
    // Fallback to Gemini Vision if Groq Vision fails
    try {
      return await analyzeMedicalDocument(prompt, fileData);
    } catch (fallbackError) {
      console.error("Gemini Vision fallback also failed:", fallbackError);
      throw error;
    }
  }
};
