import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { question, idealConcepts, userAnswer, isHindi } = await req.json();

    if (!question || !userAnswer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const conceptsString = Array.isArray(idealConcepts)
      ? idealConcepts.join(', ')
      : typeof idealConcepts === 'string'
        ? idealConcepts
        : 'None specified';

    // Detect Hindi in request or content (Devanagari Unicode block)
    const hindiInAnswer  = isHindi || /[\u0900-\u097F]/.test(userAnswer);
    const languageNote   = hindiInAnswer
      ? `\n\n⚠️ IMPORTANT: The candidate answered in Hindi or Hinglish (Hindi + English mix). This is acceptable — evaluate their conceptual understanding regardless of the input language. Your feedback, score, and improvement suggestions MUST be written in English.`
      : '';

    const prompt = `You are a highly experienced technical interviewer and hiring manager at a top Indian tech company.
You are evaluating a candidate's spoken voice response to an interview question.

Interview Question: "${question}"
Ideal Concepts to mention: ${conceptsString}

Candidate's Transcribed Spoken Answer:
"""
${userAnswer}
"""

Critique the candidate's answer accurately but constructively. Voice answers are informal — do not penalize for filler words or grammar. Compare conceptual understanding against the ideal concepts.${languageNote}

Return your evaluation STRICTLY as a JSON object with NO markdown block wrappers:
{
  "score": <number 1-10>,
  "feedback": "A concise, supportive 2-3 sentence paragraph. Acknowledge what they got right first.",
  "improvement": "One specific actionable improvement or important concept they missed."
}`;

    const maxRetries = 3;
    let attempt    = 0;
    let evaluation = null;

    while (attempt < maxRetries) {
      try {
        const geminiModel = getGeminiModel();
        if (!geminiModel) throw new Error('Gemini API is not configured on the server.');

        const result       = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson    = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        evaluation         = JSON.parse(cleanJson);
        break;
      } catch (err) {
        attempt++;
        console.warn(`Gemini Evaluation attempt ${attempt} failed:`, err.message);
        if (attempt >= maxRetries) throw err;
        await new Promise(res => setTimeout(res, 2500 * attempt));
      }
    }

    return NextResponse.json({ evaluation });

  } catch (error) {
    console.error('Final Gemini Evaluation Error:', error);
    return NextResponse.json({
      evaluation: {
        score:       5,
        feedback:    'Your answer was recorded successfully. (AI evaluation is temporarily unavailable due to high load.)',
        improvement: 'Focus on structured answers with clear examples.',
      },
    });
  }
}
