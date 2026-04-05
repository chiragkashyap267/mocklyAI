import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = () => {
  // Pool all available keys from the environment
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean); // Remove any undefined or empty keys

  if (keys.length === 0) {
    console.error("No Gemini API keys found in environment variables.");
    return null;
  }

  // Randomly select an API key for load balancing
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  
  const genAI = new GoogleGenerativeAI(randomKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};
