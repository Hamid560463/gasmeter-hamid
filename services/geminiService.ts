
import { GoogleGenAI, Type } from "@google/genai";

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

    const prompt = "Identify the numeric gas meter reading (counter) shown on the device in this image. Return ONLY the number in a JSON format.";

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
              description: "The numeric reading found on the gas meter display."
            }
          },
          required: ["value"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return { value: null };

    const parsed = JSON.parse(resultText);
    return { value: typeof parsed.value === 'number' ? parsed.value : null };

  } catch (error) {
    console.error("Gemini AI OCR Error:", error);
    return { value: null };
  }
};
