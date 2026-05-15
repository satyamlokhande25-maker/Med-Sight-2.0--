import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const groqModel = "llama-3.3-70b-versatile";
const groqVisionModel = "llama-3.2-11b-vision-preview";
const geminiModel = "gemini-3-flash-preview";
const proGeminiModel = "gemini-3.1-pro-preview";
const videoModel = "veo-3.1-lite-generate-preview";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development'
    });
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { prompt, model = geminiModel, config = {}, tools, toolConfig } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const models = [
        model,
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      ].filter((m, i, self) => self.indexOf(m) === i); // Unique models

      let lastError = null;
      for (const currentModel of models) {
        try {
          console.log(`Attempting Gemini chat with model: ${currentModel}...`);
          
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              ...config,
              tools: tools || config.tools || (config.googleSearch ? [{ googleSearch: {} }] : undefined),
            },
            toolConfig: toolConfig || config.toolConfig,
          } as any);
          
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          if (groundingMetadata) {
            console.log(`Grounding metadata found for ${currentModel}`);
          }

          return res.json({ 
            content: response.text || "No response generated.",
            groundingMetadata: groundingMetadata
          });
        } catch (err: any) {
          lastError = err;
          const errorMsg = err.message?.toLowerCase() || "";
          const isQuotaError = errorMsg.includes("quota") || 
                             err.status === "RESOURCE_EXHAUSTED" ||
                             err.status === 429 ||
                             err.message?.includes("429");
          
          if (isQuotaError) {
            console.warn(`Model ${currentModel} quota exceeded. Trying next model...`);
            continue;
          }
          console.error(`Model ${currentModel} failed:`, err.message);
          continue;
        }
      }

      throw lastError || new Error("All Gemini models failed.");
    } catch (error: any) {
      console.error("Gemini Chat Proxy Error:", error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || 
                         error.status === "RESOURCE_EXHAUSTED" ||
                         error.message?.includes("429") ||
                         error.status === 429;
      
      if (isQuotaError) {
        return res.status(429).json({ error: "QUOTA_EXCEEDED", message: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/vision", async (req, res) => {
    try {
      const { prompt, fileData, model = "gemini-3.1-pro-preview" } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const models = [
        model,
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite"
      ].filter((m, i, self) => self.indexOf(m) === i);

      let lastError = null;
      for (const currentModel of models) {
        try {
          console.log(`Attempting Gemini vision with model: ${currentModel}...`);
          const parts: any[] = [{ text: prompt }];
          
          if (fileData) {
            parts.push({
              inlineData: {
                data: fileData.data,
                mimeType: fileData.mimeType
              }
            });
          }

          const response = await ai.models.generateContent({
            model: currentModel === groqVisionModel ? "gemini-3.1-pro-preview" : currentModel,
            contents: { parts },
            config: {
              systemInstruction: "You are a senior radiologist and clinical pathologist. Analyze the provided medical document (X-ray, MRI, or lab report) with high precision. Identify key findings, potential abnormalities, and provide a structured clinical interpretation. Always include a disclaimer that this is an AI-assisted analysis and must be verified by a human specialist.",
            }
          });
          
          return res.json({ content: response.text || "No analysis generated." });
        } catch (err: any) {
          lastError = err;
          const isQuotaError = err.message?.toLowerCase().includes("quota") || 
                             err.status === "RESOURCE_EXHAUSTED" ||
                             err.message?.includes("429") ||
                             err.status === 429;
          
          if (isQuotaError) {
            console.warn(`Model ${currentModel} vision quota exceeded. Waiting 1s before next model...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          console.error(`Model ${currentModel} vision failed:`, err.message);
          continue;
        }
      }

      throw lastError || new Error("All Gemini vision models failed.");
    } catch (error: any) {
      console.error("Gemini Vision Proxy Error:", error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || 
                         error.status === "RESOURCE_EXHAUSTED" ||
                         error.message?.includes("429") ||
                         error.status === 429;
      
      if (isQuotaError) {
        return res.status(429).json({ error: "QUOTA_EXCEEDED", message: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/image", async (req, res) => {
    try {
      const { prompt, aspectRatio = "1:1" } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const imagePrompt = `Professional medical illustration for patient education, high-definition clinical style, scientific accuracy, clear anatomical labels, 4k resolution, medical textbook quality, white background, realistic lighting: ${prompt}`;
      
      let response;
      let lastError = null;

      // 1. Try Imagen models (Paid only)
      const imagenModels = ['imagen-4.0-generate-001', 'imagen-3.0-generate-001'];
      for (const model of imagenModels) {
        try {
          console.log(`Attempting image generation with Imagen model: ${model}...`);
          const imagenResponse = await ai.models.generateImages({
            model: model,
            prompt: imagePrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: aspectRatio as any,
            },
          });
          const base64Data = imagenResponse.generatedImages[0].image.imageBytes;
          if (base64Data) {
            console.log(`Successfully generated image with Imagen model: ${model}`);
            return res.json({ url: `data:image/png;base64,${base64Data}` });
          }
        } catch (err: any) {
          lastError = err;
          const isPaidError = err.message?.includes("paid plans") || 
                             err.status === "INVALID_ARGUMENT" || 
                             err.status === "PERMISSION_DENIED" ||
                             err.message?.includes("403");
          
          if (isPaidError) {
            console.log(`Imagen model ${model} skipped: Paid plan required or access denied.`);
          } else {
            console.warn(`Imagen model ${model} failed:`, err.message);
          }
        }
      }

      // 2. Try Gemini Image Models in sequence
      const models = [
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
        "gemini-flash-latest"
      ];

      for (const model of models) {
        try {
          console.log(`Attempting image generation with model: ${model}...`);
          
          const genConfig: any = {
            imageConfig: { 
              aspectRatio: aspectRatio as any
            },
            // googleSearch is the correct tool name for grounding
            tools: [{
              googleSearch: {}
            }]
          };
          
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount <= maxRetries) {
            try {
              response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: imagePrompt }] },
                config: genConfig,
              });
              break; // Success
            } catch (err: any) {
              const isQuotaError = err.message?.toLowerCase().includes("quota") || 
                                 err.status === "RESOURCE_EXHAUSTED" ||
                                 err.message?.includes("429") ||
                                 err.status === 429;
              
              if (isQuotaError && retryCount < maxRetries) {
                retryCount++;
                console.log(`Quota hit for ${model}, retrying in 2s... (Attempt ${retryCount})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              throw err;
            }
          }
          
          const parts = response.candidates?.[0]?.content?.parts || [];
          let imageData = null;
          for (const part of parts) {
            if (part.inlineData?.data) {
              imageData = part.inlineData.data;
              break;
            }
          }

          if (imageData) {
            console.log(`Successfully generated image with model: ${model}`);
            return res.json({ url: `data:image/png;base64,${imageData}` });
          } else {
            console.warn(`Model ${model} returned no image data.`);
          }
        } catch (err: any) {
          lastError = err;
          const isQuotaError = err.message?.toLowerCase().includes("quota") || 
                             err.status === "RESOURCE_EXHAUSTED" ||
                             err.message?.includes("429") ||
                             err.status === 429;
          
          if (isQuotaError) {
            console.warn(`Model ${model} quota exceeded (429). Waiting 1s before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.warn(`Model ${model} failed:`, err.message || err);
          }
          // Continue to next model
        }
      }

      // 3. Final Fallback: Pollinations.ai
      console.log("All Gemini image models failed or hit quota. Falling back to Pollinations.ai...");
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(`Professional medical illustration, clinical style, high scientific accuracy, clear labels: ${prompt}`);
        // Using Flux model on Pollinations for high quality
        const pollinationUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
        
        return res.json({ url: pollinationUrl, isFallback: true });
      } catch (pollinationError: any) {
        console.error("Pollinations.ai fallback failed:", pollinationError.message);
        // If even fallback fails, return the last Gemini error
        if (lastError?.message?.includes("quota") || lastError?.status === "RESOURCE_EXHAUSTED") {
          return res.status(429).json({ error: "QUOTA_EXCEEDED" });
        }
        throw lastError || pollinationError;
      }
    } catch (error: any) {
      console.error("Gemini Image Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/video", async (req, res) => {
    try {
      const { prompt, aspectRatio = "16:9" } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY; // Veo requires paid key
      if (!apiKey) {
        return res.status(401).json({ error: "PAID_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      let operation = await ai.models.generateVideos({
        model: videoModel,
        prompt: `High-quality medical educational animation, clear clinical visualization, professional medical style: ${prompt}`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio as any
        }
      });

      // Poll for completion (in a real app, we might use a background job, but for simplicity we poll here)
      // Note: This might timeout on some proxies, but for short videos it's usually okay.
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error("No video URI returned from Veo.");
      }

      res.json({ url: downloadLink, apiKey: apiKey }); // Return link and key for client-side fetch
    } catch (error: any) {
      console.error("Gemini Video Proxy Error:", error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || 
                         error.status === "RESOURCE_EXHAUSTED" ||
                         error.message?.includes("429") ||
                         error.status === 429;
      
      if (isQuotaError) {
        return res.status(429).json({ error: "QUOTA_EXCEEDED", message: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/maps", async (req, res) => {
    try {
      const { prompt, location } = req.body;
      console.log(`Maps search request: "${prompt}"`, location ? `at ${location.latitude}, ${location.longitude}` : "without location");
      
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Maps Search Error: GEMINI_API_KEY is missing");
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = "You are a medical facility locator. Your primary task is to find real-world clinics, hospitals, and doctors. You MUST use the Google Maps tool for every search to provide accurate, grounded locations. Always return the grounding chunks provided by the tool.";
      
      let response;
      try {
        // Try Pro model first for better results
        response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleMaps: {} }],
            toolConfig: location ? {
              retrievalConfig: {
                latLng: {
                  latitude: location.latitude,
                  longitude: location.longitude
                }
              }
            } : undefined
          }
        });
      } catch (proError: any) {
        console.warn("Gemini Pro Maps search failed, falling back to Flash...", proError.message);
        // Wait 1 second before retry to avoid immediate quota hit
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          // Fallback to Flash model
          response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              systemInstruction,
              tools: [{ googleMaps: {} }],
              toolConfig: location ? {
                retrievalConfig: {
                  latLng: {
                    latitude: location.latitude,
                    longitude: location.longitude
                  }
                }
              } : undefined
            },
          });
        } catch (flashError: any) {
          console.warn("Gemini Flash Maps search failed, falling back to Lite...", flashError.message);
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Final fallback to Lite model
          try {
            response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-preview",
              contents: prompt,
              config: {
                systemInstruction,
                tools: [{ googleMaps: {} }],
                toolConfig: location ? {
                  retrievalConfig: {
                    latLng: {
                      latitude: location.latitude,
                      longitude: location.longitude
                    }
                  }
                } : undefined
              }
            });
          } catch (liteError: any) {
            console.error("All Gemini models failed for Maps search:", liteError);
            if (liteError.message?.includes("429") || liteError.message?.includes("quota")) {
              return res.status(429).json({ error: "QUOTA_EXCEEDED" });
            }
            throw liteError;
          }
        }
      }
      
      console.log("Maps search successful, returning results.");
      
      const groundings = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundings.map((g: any) => {
        // Normalize maps/place chunks for the frontend ClinicLocator
        if (g.place) {
          return { 
            maps: { 
              title: g.place.placeName, 
              address: g.place.address, 
              uri: g.place.uri 
            } 
          };
        }
        if (g.maps) {
          return {
            maps: {
              title: g.maps.title,
              address: g.maps.address,
              uri: g.maps.uri
            }
          };
        }
        if (g.web) {
          return {
            maps: {
              title: g.web.title,
              address: g.web.uri, // fallback
              uri: g.web.uri
            }
          };
        }
        return g;
      });

      res.json({ 
        content: response.text || "No response generated.",
        sources: sources
      });
    } catch (error: any) {
      console.error("Gemini Maps Proxy Error:", error);
      
      // Provide more specific error messages
      let errorMessage = error.message || "Unknown Maps Search Error";
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return res.status(429).json({ error: "QUOTA_EXCEEDED" });
      }
      if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("invalid API key")) {
        return res.status(401).json({ error: "API_KEY_DENIED" });
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/groq/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
      
      if (!apiKey) {
        console.warn("GROQ_API_KEY missing, falling back to Gemini for chat...");
        throw new Error("GROQ_API_KEY_MISSING");
      }

      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages,
        model: groqModel,
        temperature: 0.7,
        max_tokens: 1024,
      });

      res.json({ content: completion.choices[0]?.message?.content || "No response." });
    } catch (error: any) {
      console.error("Groq Chat Proxy Error (Attempting Gemini fallback):", error.message);
      
      try {
        const { messages } = req.body;
        const geminiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
        
        if (!geminiKey) {
          return res.status(401).json({ error: "ALL_API_KEYS_MISSING" });
        }

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        // Convert Groq messages to Gemini format (more robustly)
        const systemMessage = messages.find((m: any) => m.role === 'system')?.content;
        const geminiMessages = messages
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

        if (geminiMessages.length === 0) {
          throw new Error("No user or assistant messages found to send to Gemini.");
        }

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: geminiMessages,
          config: {
            systemInstruction: systemMessage,
          }
        });

        res.json({ content: response.text || "No response generated." });
      } catch (fallbackError: any) {
        console.error("Groq Gemini Fallback Error:", fallbackError);
        res.status(500).json({ error: fallbackError.message });
      }
    }
  });

  app.post("/api/rag/chat", async (req, res) => {
    try {
      const { question, context, history } = req.body;
      const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
      
      const template = `
        You are a highly skilled medical assistant and clinical analyst. Your goal is to provide precise, evidence-based answers based ONLY on the provided medical context.

        CRITICAL INSTRUCTIONS:
        1. GROUNDING: Your answer must be strictly grounded in the provided "Context". Use specific values, dates, and findings from the documents.
        2. NO HALLUCINATION: If the information required to answer the question is not present in the context, explicitly state: "Based on the provided documents, I cannot find information regarding [topic]."
        3. CLINICAL PRECISION: Use professional medical terminology. Highlight critical values (e.g., extremely high/low lab results) and explain their significance in simple terms for the patient if needed.
        4. STRUCTURE: Use clear headings, bullet points, and bold text for key findings.
        5. GROUND LEVEL INSIGHTS: Provide practical, actionable insights based on the report. Don't just list values; explain what they mean for the patient's health.
        6. UP-TO-DATE: If the question requires general medical knowledge beyond the specific patient data, you may provide it but clearly distinguish it from the patient-specific findings.

        Context:
        {context}

        Conversation History:
        {history}

        Question: {question}

        Answer:
      `;

      if (!apiKey) {
        console.warn("GROQ_API_KEY missing, falling back to Gemini for RAG...");
        throw new Error("GROQ_API_KEY_MISSING");
      }

      const { ChatGroq } = await import("@langchain/groq");
      const { PromptTemplate } = await import("@langchain/core/prompts");
      const { StringOutputParser } = await import("@langchain/core/output_parsers");
      const { RunnableSequence } = await import("@langchain/core/runnables");

      const model = new ChatGroq({
        apiKey,
        model: groqModel,
        temperature: 0.1,
      });

      const prompt = PromptTemplate.fromTemplate(template);
      const outputParser = new StringOutputParser();

      const chain = RunnableSequence.from([
        prompt,
        model,
        outputParser,
      ]);

      const response = await chain.invoke({
        context,
        history,
        question,
      });

      res.json({ content: response });
    } catch (error: any) {
      console.error("RAG Chat Error (Attempting Gemini fallback):", error.message);
      
      try {
        const { question, context, history } = req.body;
        const geminiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
        
        if (!geminiKey) {
          return res.status(401).json({ error: "ALL_API_KEYS_MISSING" });
        }

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        const systemInstruction = `
          You are a highly skilled medical assistant and clinical analyst. Your goal is to provide precise, evidence-based answers based ONLY on the provided medical context.
          
          CRITICAL INSTRUCTIONS:
          1. GROUNDING: Your answer must be strictly grounded in the provided "Context". Use specific values and findings.
          2. NO HALLUCINATION: If the information required to answer the question is not present in the context, explicitly state: "Based on the provided documents, I cannot find information regarding [topic]."
          3. CLINICAL PRECISION: Use professional medical terminology. Highlight critical values and explain their significance.
          4. GROUND LEVEL INSIGHTS: Provide practical, actionable insights based on the report.
          5. SEARCH: If the user asks for general medical information or "up-to-date" research, use the Google Search tool to provide grounded external information.
        `;

        const prompt = `
          Context:
          ${context}

          Conversation History:
          ${history}

          Question: ${question}
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          }
        });

        res.json({ content: response.text || "No response generated." });
      } catch (fallbackError: any) {
        console.error("RAG Gemini Fallback Error:", fallbackError);
        res.status(500).json({ error: fallbackError.message });
      }
    }
  });

  app.post("/api/groq/vision", async (req, res) => {
    try {
      const { prompt, fileData } = req.body;
      const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
      
      if (!apiKey) {
        console.error("GROQ_API_KEY is missing in environment variables.");
        return res.status(401).json({ error: "GROQ_API_KEY_MISSING" });
      }

      if (!fileData || !fileData.data || !fileData.mimeType) {
        return res.status(400).json({ error: "Invalid file data provided." });
      }

      console.log(`Analyzing image: ${fileData.mimeType}, prompt length: ${prompt.length}`);

      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileData.mimeType};base64,${fileData.data}`,
                },
              },
            ],
          },
        ],
        model: groqVisionModel,
        temperature: 0.5, // Lower temperature for more factual analysis
        max_tokens: 1024,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Groq returned an empty response.");
      }

      res.json({ content });
    } catch (error: any) {
      console.error("Groq Vision Proxy Error (Attempting Gemini fallback):", error.message);
      
      try {
        const { prompt, fileData } = req.body;
        const geminiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
        
        if (!geminiKey) {
          return res.status(401).json({ error: "ALL_API_KEYS_MISSING" });
        }

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: fileData.data,
                  mimeType: fileData.mimeType,
                },
              },
            ],
          },
          config: {
            systemInstruction: "You are a senior medical imaging specialist. Analyze the provided image and prompt with clinical accuracy. Provide a structured interpretation and include a medical disclaimer.",
          }
        });

        res.json({ content: response.text || "No response generated." });
      } catch (fallbackError: any) {
        console.error("Groq Vision Gemini Fallback Error:", fallbackError);
        res.status(500).json({ error: fallbackError.message });
      }
    }
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      
      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "Missing required email fields (to, subject, text/html)" });
      }

      // Check if SMTP credentials are provided
      let smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      
      // SMART USER FALLBACK: If the user provided a password for satyamlokhande01@gmail.com,
      // but SMTP_USER is different, we should use the correct one.
      let smtpUser = process.env.SMTP_USER || "satyamlokhande01@gmail.com";
      
      // FALLBACK: Use the App Password provided by the user if SMTP_PASS is missing or invalid
      let smtpPass = process.env.SMTP_PASS;
      if (!smtpPass || smtpPass.length < 8) {
        console.log("Using provided App Password fallback: glzr epuc vlky ddsw");
        smtpPass = "glzr epuc vlky ddsw";
        // If we're using the fallback password, we MUST use the matching email
        smtpUser = "satyamlokhande01@gmail.com";
      }

      // Strip spaces from password (common mistake with App Passwords)
      if (smtpPass) {
        smtpPass = smtpPass.replace(/\s+/g, '');
      }

      const fromEmail = process.env.FROM_EMAIL || smtpUser;

      // SMART FALLBACK: If the user put the app name in SMTP_HOST, fix it automatically
      const trimmedHost = smtpHost?.trim() || "";
      if (trimmedHost.toLowerCase() === 'midsight' || trimmedHost.toLowerCase() === 'medsight' || !trimmedHost.includes('.')) {
        if (smtpUser.endsWith('@gmail.com')) {
          console.log("Smart Fallback: Invalid SMTP_HOST detected. Automatically switching to smtp.gmail.com");
          smtpHost = "smtp.gmail.com";
        }
      }

      console.log(`Attempting to send email via SMTP Host: ${smtpHost}, Port: ${smtpPort}, User: ${smtpUser}`);

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn("SMTP credentials missing. Simulating email send for demo purposes.");
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.json({ 
          success: true, 
          simulated: true,
          message: "Email send simulated (SMTP credentials missing in .env)" 
        });
      }

      const transporterOptions: any = {
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      };

      if (smtpHost === "smtp.gmail.com") {
        transporterOptions.service = "gmail";
      } else {
        transporterOptions.host = smtpHost;
        transporterOptions.port = smtpPort;
        transporterOptions.secure = smtpPort === 465;
      }

      const transporter = nodemailer.createTransport(transporterOptions);

      const info = await transporter.sendMail({
        from: `"Midsight AI" <${smtpUser}>`,
        to,
        subject,
        text,
        html,
      });

      console.log("Email sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Email Sending Error:", error);
      
      // Provide more helpful messages for common DNS/Connection errors
      if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND') {
        const hostname = error.hostname || "the SMTP host";
        return res.status(500).json({ 
          error: `DNS Resolution Error: Could not find host '${hostname}'. Please check your SMTP_HOST environment variable. Ensure it is a valid SMTP server address (e.g., smtp.gmail.com).` 
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(500).json({ 
          error: `Connection Error: Could not connect to the SMTP server. Please check your SMTP_HOST and SMTP_PORT.` 
        });
      }

      // Handle Gmail App Password error specifically
      if (error.message && error.message.includes("Application-specific password required")) {
        return res.status(500).json({ 
          error: "Gmail requires an 'App Password' because 2-Step Verification is enabled on your account. Please generate one in your Google Account settings and use it as SMTP_PASS in the Settings menu." 
        });
      }

      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.post("/api/test-connection", async (req, res) => {
    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      
      let smtpUser = process.env.SMTP_USER || "satyamlokhande01@gmail.com";
      let smtpPass = process.env.SMTP_PASS;
      
      if (!smtpPass || smtpPass.length < 8) {
        smtpPass = "glzr epuc vlky ddsw";
        smtpUser = "satyamlokhande01@gmail.com";
      }

      // Strip spaces from password
      if (smtpPass) {
        smtpPass = smtpPass.replace(/\s+/g, '');
      }

      const transporterOptions: any = {
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      };

      if (smtpHost === "smtp.gmail.com") {
        transporterOptions.service = "gmail";
      } else {
        transporterOptions.host = smtpHost;
        transporterOptions.port = smtpPort;
        transporterOptions.secure = smtpPort === 465;
      }

      const transporter = nodemailer.createTransport(transporterOptions);

      await transporter.verify();
      res.json({ success: true, message: "SMTP Connection successful!" });
    } catch (error: any) {
      console.error("SMTP Test Error:", error);
      let errorMessage = error.message;
      if (errorMessage.includes("Application-specific password required")) {
        errorMessage = "Gmail requires an 'App Password'. Please use the 16-digit code you generated.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Catch-all for non-existent API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler - MUST be last
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error:", err);
    
    // If it's an API request, always return JSON
    if (req.path.startsWith('/api/')) {
      return res.status(err.status || 500).json({ 
        error: err.message || "Internal Server Error",
        path: req.url 
      });
    }
    
    // Otherwise, let the default handler or SPA handler deal with it
    next(err);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Current directory: ${process.cwd()}`);
  });
}

startServer();
