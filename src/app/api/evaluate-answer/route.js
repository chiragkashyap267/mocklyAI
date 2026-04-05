import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export const maxDuration = 60; // Allow Vercel to run up to 60s for retry logic

export async function POST(req) {
  try {
    const { question, idealConcepts, userAnswer } = await req.json();

    if (!question || !userAnswer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Model is loaded inside the retry loop now to ensure dynamic key rotation on failures

    const conceptsString = Array.isArray(idealConcepts) 
      ? idealConcepts.join(', ') 
      : typeof idealConcepts === 'string' 
        ? idealConcepts 
        : 'None specified';

    const prompt = `You are a highly experienced technical interviewer and hiring manager. 
    You are evaluating a candidate's spoken response to an interview question.
    
    Interview Question: "${question}"
    Ideal Concepts they should ideally mention: ${conceptsString}
    
    Candidate's Transcribed Spoken Answer:
    """
    ${userAnswer}
    """
    
    Critique the candidate's answer accurately but constructively. Compare their answer against the ideal concepts.
    
    Return your evaluation STRICTLY as a JSON object with no markdown block wrappers. Use this exact structure:
    {
      "score": <number between 1 and 10>,
      "feedback": "A concise, supportive paragraph giving feedback on their answer. Call out what they did correctly.",
      "improvement": "A concise sentence pointing out 1 area where they could improve or an important concept they missed from the ideal concepts."
    }
    `;

    const maxRetries = 3;
    let attempt = 0;
    let evaluation = null;

    while (attempt < maxRetries) {
      try {
        const geminiModel = getGeminiModel();
        if (!geminiModel) throw new Error('Gemini API is not configured on the server.');

        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();
        
        const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        evaluation = JSON.parse(cleanJson);
        break; // Success!
      } catch (err) {
        attempt++;
        console.warn(`Gemini Evaluation attempt ${attempt} failed:`, err.message);
        
        if (attempt >= maxRetries) {
          throw err; // Exhausted retries, proceed to fallback
        }
        
        // Wait 2.5s, then 5s before trying again to let the rate limit cool down
        await new Promise(res => setTimeout(res, 2500 * attempt));
      }
    }

    return NextResponse.json({ evaluation });

  } catch (error) {
    console.error('Final Gemini Evaluation Error:', error);
    // Ultimate fallback only if all 3 retries completely fail
    return NextResponse.json({ 
      evaluation: {
        score: 5,
        feedback: "Your answer was recorded successfully. (AI evaluation is currently unavailable due to high server load).",
        improvement: "Continue practicing structure and depth."
      } 
    });
  }
}
