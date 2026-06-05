import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = (failedKeys = []) => {
  // grab all keys defined in env
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
  ].filter(Boolean);

  // skip keys that already failed this request
  let available = keys.filter(k => !failedKeys.includes(k));

  if (available.length === 0) {
    if (keys.length > 0) {
      // all failed, reset and try again from the full pool
      console.warn('All Gemini keys failed — falling back to full pool');
      available = keys;
    } else {
      console.error('No Gemini API keys found in environment');
      return { model: null, keyUsed: null };
    }
  }

  // pick one at random for load balancing across keys
  const picked = available[Math.floor(Math.random() * available.length)];

  const genAI = new GoogleGenerativeAI(picked);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  return { model, keyUsed: picked };
};
