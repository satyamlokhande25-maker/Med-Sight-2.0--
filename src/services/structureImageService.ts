import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateStructureImage(structureText: string) {
  const prompt = `Create a professional, clean, and high-resolution infographic showing a file folder structure for a software project named "MedSight 2.0". 
  The style should be modern, minimalist, and tech-oriented (like a developer documentation site). 
  Use a dark theme with neon blue and white accents. 
  The structure should clearly show folders like 'src', 'components', 'services', 'lib', and 'server.ts' with appropriate icons for folders and files. 
  Text should be crisp and readable. 
  Here is the structure to visualize:
  ${structureText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: "16:9", imageSize: "1K" },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
