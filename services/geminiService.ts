
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the AI client using the modern named parameter pattern
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface AIResult {
  value: number | null;
}

export const extractMeterReading = async (base64DataUrl: string): Promise<AIResult> => {
  try {
    // Extract base64 data and mime type
    const matches = base64DataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 format");
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    const prompt = "Analyze the image of this industrial gas meter. Identify the large numeric digits on the counter. Return ONLY the number in JSON format.";

    // Use ai.models.generateContent directly as per unified SDK guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            value: {
              type: Type.NUMBER,
              description: "The numeric value read from the gas meter's counter."
            }
          },
          required: ["value"]
        }
      }
    });

    // Access the .text property directly (not a method)
    const resultText = response.text;
    if (!resultText) return { value: null };

    const parsed = JSON.parse(resultText);
    return { value: typeof parsed.value === 'number' ? parsed.value : null };

  } catch (error) {
    console.error("Gemini AI OCR Error:", error);
    return { value: null };
  }
};
