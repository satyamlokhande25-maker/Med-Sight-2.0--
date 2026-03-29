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
const groqVisionModel = "llama-3.2-90b-vision-preview";
const geminiModel = "gemini-3-flash-preview";
const videoModel = "veo-3.1-fast-generate-preview";

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
      const { prompt, model = geminiModel } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      res.json({ content: response.text || "No response generated." });
    } catch (error: any) {
      console.error("Gemini Chat Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/vision", async (req, res) => {
    try {
      const { prompt, fileData, model = groqVisionModel } = req.body;
      const apiKey = process.env.API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
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
        model: model === groqVisionModel ? "gemini-3.1-pro-preview" : model,
        contents: { parts },
        config: {
          systemInstruction: "You are a senior radiologist and clinical pathologist. Analyze the provided medical document (X-ray, MRI, or lab report) with high precision. Identify key findings, potential abnormalities, and provide a structured clinical interpretation. Always include a disclaimer that this is an AI-assisted analysis and must be verified by a human specialist.",
        }
      });
      
      res.json({ content: response.text || "No analysis generated." });
    } catch (error: any) {
      console.error("Gemini Vision Proxy Error:", error);
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
      
      const imagePrompt = `Professional medical illustration, high-definition clinical style, scientific accuracy, clear anatomical labels, 4k resolution, medical textbook quality: ${prompt}`;
      
      let response;
      try {
        // Model 1: 2.5 Flash Image
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts: [{ text: imagePrompt }] },
          config: {
            imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
          },
        });
      } catch (error1: any) {
        console.warn("Gemini 2.5 Flash Image failed, falling back to 3.1 Flash Image...", error1.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          // Model 2: 3.1 Flash Image
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: { parts: [{ text: imagePrompt }] },
            config: {
              imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
            },
          });
        } catch (error2: any) {
          console.warn("Gemini 3.1 Flash Image failed, falling back to 3 Pro Image...", error2.message);
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            // Model 3: 3 Pro Image
            response = await ai.models.generateContent({
              model: "gemini-3-pro-image-preview",
              contents: { parts: [{ text: imagePrompt }] },
              config: {
                imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
              },
            });
          } catch (error3: any) {
            console.warn("All Gemini image models failed, attempting Pollinations.ai fallback...", error3.message);
            try {
              const seed = Math.floor(Math.random() * 1000000);
              const encodedPrompt = encodeURIComponent(`Professional medical illustration, clinical style, high scientific accuracy, clear labels: ${prompt}`);
              const pollinationUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
              
              // We return this as a valid URL
              return res.json({ url: pollinationUrl, isFallback: true });
            } catch (pollinationError: any) {
              console.error("Pollinations.ai fallback failed:", pollinationError.message);
              if (error3.message?.includes("429") || error3.message?.includes("quota")) {
                return res.status(429).json({ error: "QUOTA_EXCEEDED" });
              }
              throw error3;
            }
          }
        }
      }

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageUrl) {
        throw new Error("No image data returned from Gemini.");
      }

      res.json({ url: imageUrl });
    } catch (error: any) {
      console.error("Gemini Image Proxy Error:", error);
      if (error.message?.includes("429") || error.message?.includes("quota")) {
        return res.status(429).json({ error: "QUOTA_EXCEEDED" });
      }
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
          },
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
              },
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
      res.json({ 
        content: response.text || "No response generated.",
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
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
        return res.status(401).json({ error: "GROQ_API_KEY_MISSING" });
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
      console.error("Groq Chat Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rag/chat", async (req, res) => {
    try {
      const { question, context, history } = req.body;
      const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "GROQ_API_KEY_MISSING" });
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

      const template = `
        You are a highly skilled medical assistant. Use the following extracted medical information and conversation history to answer the doctor's question.
        If the information is not in the context, say you don't know based on the provided documents.
        Be precise, professional, and highlight any critical findings.

        Context:
        {context}

        Conversation History:
        {history}

        Question: {question}

        Answer:
      `;

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
      console.error("RAG Chat Error:", error);
      res.status(500).json({ error: error.message });
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
      console.error("Groq Vision Proxy Error:", error);
      
      // Handle specific Groq errors if possible
      if (error.status === 413) {
        return res.status(413).json({ error: "File too large for Groq Vision API." });
      }
      
      res.status(500).json({ error: error.message || "Unknown error during vision analysis" });
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
