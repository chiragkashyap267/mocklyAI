import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = (failedKeys = []) => {
  // Pool all available keys from the environment
  let keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10,
    process.env.GEMINI_API_KEY_11
  ].filter(Boolean); // Remove any undefined or empty keys

  // Filter out the keys that failed during this specific request
  let availableKeys = keys.filter(key => !failedKeys.includes(key));

  if (availableKeys.length === 0) {
    if (keys.length > 0) {
      console.warn("All available Gemini API keys have failed. Falling back to pool.");
      availableKeys = keys;
    } else {
      console.error("No Gemini API keys found in environment variables.");
      return { model: null, keyUsed: null };
    }
  }

  // Randomly select an API key for load balancing
  const randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
  
  const genAI = new GoogleGenerativeAI(randomKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  return { model, keyUsed: randomKey };
};
