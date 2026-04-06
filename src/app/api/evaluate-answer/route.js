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
You are evaluating a candidate's SPOKEN voice answer that was captured via automatic speech recognition (ASR/STT).

⚠️ CRITICAL — ASR Transcription Errors:
The candidate's answer below was captured by a microphone and converted to text automatically. It WILL contain:
- Speech recognition errors and mishearing (e.g. "cementing HTML" = "semantic HTML", "Tom document" = "DOM document")
- Filler words (umm, uh, like, so, basically)
- Incomplete sentences due to natural speech patterns
- Hinglish mix (Hindi words inserted into English speech)

Your job:
STEP 1 — Mentally reconstruct the candidate's INTENDED meaning by correcting likely ASR errors and filler words.
STEP 2 — Evaluate their conceptual understanding based on the reconstructed meaning, NOT the literal broken text.
STEP 3 — Score generously for correct concepts even if the words are garbled, as this is voice input.

Interview Question: "${question}"
Ideal Concepts to mention: ${conceptsString}

Candidate's Raw ASR Transcript (may be garbled):
"""
${userAnswer}
"""

Evaluation rules:
- Voice answers are informal — NEVER penalize grammar, filler words, or word order
- A score of 7+ means they understood the core concept
- A score of 4-6 means partial understanding
- A score below 4 means they clearly don't know the concept
- Be encouraging and constructive
- Do NOT quote the garbled transcript back to them verbatim${languageNote}

Return your evaluation STRICTLY as a valid JSON object with NO markdown code blocks:
{
  "score": <integer 1-10>,
  "feedback": "2-3 sentences. Start by acknowledging what they got right (based on reconstructed meaning). Be warm and constructive.",
  "improvement": "One specific, actionable concept they missed or should elaborate on next time."
}`;

    const maxRetries = 5;
    let attempt    = 0;
    let evaluation = null;
    let failedKeys = [];

    while (attempt < maxRetries) {
      let currentKey = null;
      try {
        const { model: geminiModel, keyUsed } = getGeminiModel(failedKeys);
        currentKey = keyUsed;
        
        if (!geminiModel) throw new Error('Gemini API is not configured on the server.');

        const result       = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson    = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        evaluation         = JSON.parse(cleanJson);
        break;
      } catch (err) {
        attempt++;
        if (currentKey) failedKeys.push(currentKey);
        console.warn(`Gemini Evaluation attempt ${attempt} failed:`, err.message);
        if (attempt >= maxRetries) throw err;
        await new Promise(res => setTimeout(res, 800)); // Fast retry with a new key
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
