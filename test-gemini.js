const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.split('GEMINI_API_KEY=')[1].split('\n')[0].trim();

const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function test() {
  try {
    const prompt = `Return EXACTLY this JSON: { "score": 8 }`;
    const res = await model.generateContent(prompt);
    console.log("SUCCESS:", res.response.text());
  } catch (err) {
    console.log("ERROR MESSAGE:", err.message);
    if(err.status) console.log("ERROR STATUS:", err.status);
  }
}

test();
