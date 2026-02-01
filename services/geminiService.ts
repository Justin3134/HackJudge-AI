import { GoogleGenAI, Type } from "@google/genai";
import { HackathonData, AnalysisResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
// Using gemini-2.0-flash-exp as requested by user. 
// If this fails in your specific environment, try 'gemini-1.5-flash' or 'gemini-1.5-pro'.
const MODEL_FAST = 'gemini-2.0-flash-exp'; 
const MODEL_REASONING = 'gemini-2.0-flash-exp';

export const analyzeHackathonUrl = async (url: string): Promise<HackathonData> => {
  try {
    const prompt = `
      I need to analyze a hackathon from this URL: ${url}.
      
      TASK:
      1. Use Google Search to find the specific Hackathon event details. 
      2. IF the URL is a Luma/Devpost link, try to find the "Judges" section.
      3. CRITICAL: IF specific judges are NOT listed on the page or found via search, you MUST create 3 "Archetype Judges" based on the hackathon theme.
         - Example Archetypes: "The Technical Lead", "The VC Investor", "The Product Designer".
         - Do NOT return an empty judges list. I need exactly 3 profiles if none are found.
      4. For each judge (real or inferred):
         - Search/Predict their professional background.
         - Identify values, red flags, and talking points.
      
      5. Generate a "Winning Demo Strategy" containing:
         - A generatedScript (3 mins long).
         - Key phrases to use.
         - A structure (timeline).

      OUTPUT:
      Return strictly valid JSON matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_REASONING,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Explicitly enable search
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            url: { type: Type.STRING },
            criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
            judges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  values: { type: Type.ARRAY, items: { type: Type.STRING } },
                  focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendedTalkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
              }
            },
            strategy: {
              type: Type.OBJECT,
              properties: {
                structure: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING },
                      action: { type: Type.STRING }
                    }
                  }
                },
                keyPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                featuresToEmphasize: { type: Type.ARRAY, items: { type: Type.STRING } },
                generatedScript: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      let data: HackathonData;
      try {
          data = JSON.parse(response.text) as HackathonData;
      } catch (e) {
          console.error("Failed to parse JSON", e);
          throw new Error("Invalid JSON response from AI");
      }
      
      // Data Sanitation to prevent crashes
      if (!data.judges || !Array.isArray(data.judges) || data.judges.length === 0) {
           // Fallback if AI ignores instructions
           data.judges = [
               {
                   name: "The Technical Judge",
                   role: "Senior Engineer",
                   company: "Tech Corp",
                   values: ["Clean Code", "Scalability"],
                   focusAreas: ["Architecture", "Stack choice"],
                   redFlags: ["Spaghetti code", "Security flaws"],
                   recommendedTalkingPoints: ["Mention your tech stack", "Explain how it scales"]
               },
               {
                   name: "The Product Judge",
                   role: "Product Manager",
                   company: "Innovation Inc",
                   values: ["User Experience", "Problem/Solution Fit"],
                   focusAreas: ["UI/UX", "User Journey"],
                   redFlags: ["Confusing UI", "No clear problem statement"],
                   recommendedTalkingPoints: ["Show the user flow", "Explain the 'Why'"]
               }
           ];
      }

      if (!data.strategy) {
          data.strategy = {
              structure: [],
              keyPhrases: [],
              featuresToEmphasize: [],
              generatedScript: "Could not generate script. Please try analyzing again."
          };
      }
      
      // Ensure strategy sub-properties exist
      if (!data.strategy.generatedScript) data.strategy.generatedScript = "Script generation incomplete.";
      if (!data.strategy.structure) data.strategy.structure = [];
      if (!data.strategy.keyPhrases) data.strategy.keyPhrases = [];
      
      return data;
    }
    throw new Error("No data returned from Gemini");
  } catch (error) {
    console.error("Hackathon Analysis Failed:", error);
    throw error;
  }
};

export const analyzeVideoDemo = async (videoBlob: Blob, hackathonData: HackathonData): Promise<AnalysisResult> => {
  try {
    // Convert Blob to Base64
    const base64Video = await blobToBase64(videoBlob);
    
    // Fallback if judges is empty (shouldn't happen with sanitation above)
    const judgesList = hackathonData.judges && hackathonData.judges.length > 0 
        ? hackathonData.judges.map(j => j.name).join(', ')
        : "Standard Hackathon Judges";

    const prompt = `
      Analyze this hackathon demo video. 
      Context: This is a submission for ${hackathonData.title}.
      Judges are: ${judgesList}.
      Criteria: ${hackathonData.criteria?.join(', ') || 'General Hackathon Criteria'}.

      Provide a strict judging analysis.
      1. Give an overall score out of 100.
      2. List 3-5 specific strengths.
      3. List 3-5 specific areas for improvement with timestamps if possible.
      4. For each judge listed above, predict exactly what they would say based on their background and this video.
      5. Generate 5 likely Q&A questions these specific judges would ask.

      Return strictly valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "video/mp4", // Assuming recorded as compatible format, usually webm/mp4
              data: base64Video
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            judgeSpecificFeedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  judgeName: { type: Type.STRING },
                  feedback: { type: Type.STRING }
                }
              }
            },
            qaQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("Analysis failed");

  } catch (error) {
    console.error("Video Analysis Failed", error);
    throw error;
  }
}

export const getRealTimeFeedback = async (transcript: string, wpm: number): Promise<string> => {
    try {
        const prompt = `
        You are an intense but helpful hackathon coach named Jarvis.
        The presenter is speaking at ${wpm} words per minute.
        Here is their latest sentence: "${transcript}".
        
        Give a ONE sentence, punchy coaching tip. 
        Examples: "Slow down, you're losing clarity!", "Great energy, keep it up!", "Explain the 'Why' before the 'How'!".
        If the WPM is > 160, tell them to slow down. If < 110, tell them to speed up.
        `;

        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
            config: {
                maxOutputTokens: 30,
            }
        });
        return response.text || "Keep going!";
    } catch (e) {
        return "Keep going!";
    }
}

// Helper to convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}