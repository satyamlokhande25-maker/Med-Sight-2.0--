import { fetchWithRetry } from "../lib/fetchWithRetry";

export const geminiModel = "gemini-3-flash-latest";
export const proModel = "gemini-3.1-pro-preview";
export const liteModel = "gemini-3.1-flash-lite-preview";
export const imageModel = "gemini-3-flash-preview"; // Fallback for image analysis if needed
export const videoModel = "veo-3.1-lite-generate-preview";
export const liveModel = "gemini-3.1-flash-live-preview";
export const ttsModel = "gemini-3.1-flash-tts-preview";

export const getApiKey = (requirePaid: boolean = false) => {
  // This is now mostly for compatibility as we use proxies
  // But we still need it for direct client-side fetch of video blobs
  if (requirePaid) {
    return process.env.API_KEY || process.env.MY_API_KEY;
  }
  return process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
};

export const getGeminiResponse = async (prompt: string, model: string = geminiModel, config: any = {}, tools?: any[], toolConfig?: any) => {
  try {
    const response = await fetchWithRetry("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, config, tools, toolConfig }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "GEMINI_API_ERROR");
    }
    
    // Return both content and grounding metadata if available
    if (data.groundingMetadata) {
      return {
        text: data.content,
        groundingMetadata: data.groundingMetadata
      };
    }
    
    return data.content;
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    const isQuotaError = errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted");
    
    if (isQuotaError) {
      console.warn("Gemini Quota Exceeded (getGeminiResponse).");
    } else {
      console.error("Gemini Proxy Error (getGeminiResponse):", error);
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
    const response = await fetchWithRetry("/api/gemini/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, fileData, model: proModel }),
    });

    const data = await response.json();
    if (!response.ok) {
      // If Pro fails, try Flash fallback via proxy
      if (response.status !== 401) {
        const fallbackResponse = await fetchWithRetry("/api/gemini/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, fileData, model: geminiModel }),
        });
        const fallbackData = await fallbackResponse.json();
        if (fallbackResponse.ok) return fallbackData.content;
      }
      throw new Error(data.error || "GEMINI_VISION_ERROR");
    }
    return data.content;
  } catch (error: any) {
    console.error("Gemini Proxy Error (analyzeMedicalDocument):", error);
    throw error;
  }
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

