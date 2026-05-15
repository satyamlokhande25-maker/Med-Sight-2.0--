import { GoogleGenAI } from "@google/genai";
import { fetchWithRetry } from "../lib/fetchWithRetry";

export const geminiModel = "gemini-3-flash-preview";
export const proModel = "gemini-3.1-pro-preview";
export const liteModel = "gemini-3.1-flash-lite";
export const imageModel = "gemini-3.1-flash-image-preview";
export const videoModel = "veo-3.1-lite-generate-preview";
export const liveModel = "gemini-3.1-flash-live-preview";
export const ttsModel = "gemini-3.1-flash-tts-preview";

export const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

export const getApiKey = (requirePaid: boolean = false) => {
  if (requirePaid) {
    return process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
  }
  return process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.MY_API_KEY;
};

export const getGeminiResponse = async (prompt: string, model: string = geminiModel, config: any = {}, tools?: any[], toolConfig?: any) => {
  try {
    const ai = getAI();
    
    // Attempt standard model
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        ...config,
        tools: tools || config.tools,
        toolConfig: toolConfig || config.toolConfig
      }
    });

    if (response.candidates?.[0]?.groundingMetadata) {
      return {
        text: response.text,
        groundingMetadata: response.candidates[0].groundingMetadata
      };
    }
    
    return response.text;
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    const isQuotaError = errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted") || errorMsg.includes("limit");
    const isNotFoundError = errorMsg.includes("not found") || errorMsg.includes("404");

    if (isQuotaError || isNotFoundError) {
      console.warn(`Gemini Error (${model}): ${errorMsg}. Attempting fallback to proxy...`);
      // Fallback to server-side proxy which might have multiple models/keys
      try {
        const proxyResponse = await fetchWithRetry("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model: geminiModel, config, tools, toolConfig }),
        });

        const data = await proxyResponse.json();
        if (!proxyResponse.ok) throw new Error(data.error || "PROXY_ERROR");
        return data.content;
      } catch (proxyError: any) {
        console.error("Gemini Fallback Proxy Error:", proxyError);
        throw proxyError;
      }
    }
    throw error;
  }
};

export const getMapsGroundingResponse = async (prompt: string, location?: { latitude: number, longitude: number }) => {
  try {
    const response = await fetchWithRetry("/api/gemini/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, location }),
    }, 1, 1000, true, 45000); // 45s timeout for Maps search

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GEMINI_MAPS_ERROR");
    }
    return {
      text: data.content,
      sources: data.sources || []
    };
  } catch (error: any) {
    console.error("Gemini Proxy Error (getMapsGroundingResponse):", error);
    throw error;
  }
};

export const analyzeMedicalDocument = async (prompt: string, fileData?: { data: string, mimeType: string }) => {
  try {
    const ai = getAI();
    
    const parts: any[] = [{ text: prompt }];
    if (fileData) {
      parts.push({
        inlineData: {
          data: fileData.data,
          mimeType: fileData.mimeType
        }
      });
    }

    // Try starting with pro model on frontend
    try {
      const response = await ai.models.generateContent({
        model: proModel,
        contents: { parts },
        config: {
          systemInstruction: "You are a senior radiologist and clinical pathologist. Analyze the provided medical document (X-ray, MRI, or lab report) with high precision. Identify key findings, potential abnormalities, and provide a structured clinical interpretation. Always include a medical disclaimer.",
        }
      });
      return response.text;
    } catch (proError: any) {
      console.warn("Frontend Pro Vision failed, trying Flash...", proError.message);
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: { parts },
      });
      return response.text;
    }
  } catch (error: any) {
    console.error("Frontend Vision failed, falling back to proxy:", error);
    try {
      const response = await fetchWithRetry("/api/gemini/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, fileData, model: geminiModel }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "VISION_PROXY_ERROR");
      return data.content;
    } catch (proxyError: any) {
      console.error("Gemini Vision Proxy Error:", proxyError);
      throw proxyError;
    }
  }
};

/**
 * Extracts structured medical/clinical data from any file (PDF or Image)
 */
export const extractClinicalData = async (fileData: { data: string, mimeType: string }) => {
  const prompt = `Extract all medical findings, lab values, symptoms, history, and clinical data from this document/image. 
  Output it as a highly detailed, structured text summary. 
  Include every detail, table data, and numerical value. 
  If it's an image (X-ray/MRI), describe the findings precisely.
  Be extremely thorough as this will be used as context for further analysis.`;
  
  return analyzeMedicalDocument(prompt, fileData);
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<{ url: string, isFallback: boolean }> => {
  try {
    const response = await fetchWithRetry("/api/gemini/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspectRatio }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GEMINI_IMAGE_ERROR");
    }
    return { url: data.url, isFallback: data.isFallback || false };
  } catch (error: any) {
    console.error("Gemini Image Proxy Error, attempting client-side fallback:", error);
    
    // Fallback to Pollinations.ai (Free, no key required)
    try {
      const seed = Math.floor(Math.random() * 1000000);
      const ratioParts = (aspectRatio || "1:1").split(':').map(Number);
      const widthRatio = ratioParts[0] || 1;
      const heightRatio = ratioParts[1] || 1;
      
      const width = 1024;
      const height = Math.round((width / widthRatio) * heightRatio);
      
      const encodedPrompt = encodeURIComponent(`Professional medical illustration, clinical style, high scientific accuracy, clear labels: ${prompt}`);
      const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;
      
      return { url: imageUrl, isFallback: true };
    } catch (fallbackError) {
      console.error("Client-side fallback failed:", fallbackError);
      throw error;
    }
  }
};

export const generateVideo = async (prompt: string, aspectRatio: string = "16:9") => {
  try {
    const response = await fetchWithRetry("/api/gemini/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspectRatio }),
    }, 1, 1000, true, 300000); // 5 minute timeout for video generation

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GEMINI_VIDEO_ERROR");
    }

    // Fetch the video with the API key returned from proxy (needed for the direct URI)
    const videoResponse = await fetchWithRetry(data.url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': data.apiKey,
      },
    }, 3, 2000, false);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    console.error("Gemini Video Proxy Error:", error);
    throw error;
  }
};

