import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export const maxDuration = 60; // Allow Vercel to run up to 60s for retry logic

export async function POST(req) {
  try {
    const { resumeText, jobRole, experienceLevel } = await req.json();

    if (!jobRole) {
      return NextResponse.json({ error: 'Missing job role.' }, { status: 400 });
    }

    // Model configuration is now checked directly inside the retry loop

    const hasResume = resumeText && resumeText.trim().length > 0;
    const level     = experienceLevel || 'Mid-Level';

    // Difficulty guidance injected into the prompt
    const difficultyGuide = {
      'Internship':        'very beginner-friendly, conceptual, no jargon – test basic awareness and learning mindset',
      'Junior / Entry-Level': 'fundamentals-focused, practical understanding, basic problem solving',
      'Mid-Level':         'solid depth – test real-world project experience, trade-offs, and design awareness',
      'Senior':            'deep expertise – architecture decisions, performance, scalability, code quality at scale',
      'Lead / Manager':    'leadership, cross-team coordination, system design at scale, mentoring, conflict resolution',
    };
    const difficultyHint = difficultyGuide[level] || difficultyGuide['Mid-Level'];

    // ── TECHNICAL ROUND PROMPT ─────────────────────────────────────────────
    const technicalPrompt = hasResume
      ? `You are a senior technical interviewer at a top tech company.

Target Job Role: ${jobRole}
Experience Level: ${level} — ${difficultyHint}

Candidate Resume:
"""
${resumeText}
"""

Task: Generate exactly 10 technical interview questions.
Rules — READ CAREFULLY:
1. EACH question MUST test ONE single concept. Do NOT merge multiple questions into one sentence.
   BAD:  "What is React and how does it compare to Vue?"
   GOOD: "What is the purpose of the virtual DOM in React?"
2. Base every question on actual skills, tools, projects listed in the resume.
3. Adjust difficulty to the ${level} level described above.
4. Questions must be progressively challenging — start simpler, end harder.
5. NO behavioral or HR questions — only technical.
6. Return ONLY a JSON array, no markdown wrappers, no explanation text.

JSON structure (array of exactly 10):
[
  {
    "question": "Single focused technical question here",
    "questionType": "technical",
    "focusArea": "1-3 word category (e.g. React Hooks, System Design, SQL)",
    "idealAnswerConcepts": ["Key concept 1", "Key concept 2", "Key concept 3"]
  }
]`
      : `You are a senior technical interviewer at a top tech company.

Target Job Role: ${jobRole}
Experience Level: ${level} — ${difficultyHint}

No resume provided. Generate exactly 10 general technical interview questions.
Rules — READ CAREFULLY:
1. EACH question MUST test ONE single concept only.
   BAD:  "Explain closures and also how they relate to memory leaks."
   GOOD: "What is a closure in JavaScript?"
2. Cover a variety of relevant technical areas for a ${jobRole} role.
3. Adjust difficulty to ${level} level described above.
4. Start simpler, get progressively harder.
5. NO behavioral/HR questions — technical only.
6. Return ONLY a JSON array, no markdown wrappers.

JSON structure (array of exactly 10):
[
  {
    "question": "Single focused technical question here",
    "questionType": "technical",
    "focusArea": "1-3 word category",
    "idealAnswerConcepts": ["Concept 1", "Concept 2", "Concept 3"]
  }
]`;

    // ── HR ROUND PROMPT ────────────────────────────────────────────────────
    const hrPrompt = `You are a seasoned HR interviewer.

Target Job Role: ${jobRole}
Experience Level: ${level} — ${difficultyHint}
${hasResume ? `Candidate has submitted a resume for a ${jobRole} role.` : ''}

Generate exactly 5 HR / behavioral interview questions.
Rules:
1. ONE focused behavioral question per item — do NOT combine questions.
2. Use STAR-method style questions relevant to ${level} candidates.
   Internship/Junior: teamwork, learning attitude, handling feedback  
   Mid/Senior: ownership, conflict resolution, leading without authority  
   Lead/Manager: people management, vision, organizational impact
3. Keep language conversational and simple.
4. Return ONLY a JSON array, no markdown wrappers.

JSON structure (array of exactly 5):
[
  {
    "question": "Single HR / behavioral question",
    "questionType": "hr",
    "focusArea": "1-3 word category (e.g. Teamwork, Conflict, Leadership)",
    "idealAnswerConcepts": ["Key element 1", "Key element 2", "Key element 3"]
  }
]`;

    // Fault-tolerant internal function to generate content using dynamic key load balancing
    const generateWithRetry = async (promptText) => {
      let lastError;
      let failedKeys = [];
      const maxAttempts = 5; // Up to 5 attempts across different keys
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let currentKey = null;
        try {
          const { model: geminiModel, keyUsed } = getGeminiModel(failedKeys);
          currentKey = keyUsed;
          
          if (!geminiModel) throw new Error('Mockly AI is not configured.');
          return await geminiModel.generateContent(promptText);
        } catch (error) {
          lastError = error;
          if (currentKey) failedKeys.push(currentKey);
          
          console.warn(`Generate attempt ${attempt + 1} failed:`, error.message);
          // Fast retry with a new key instead of waiting
          if (attempt < maxAttempts - 1) await new Promise(res => setTimeout(res, 800));
        }
      }
      throw lastError; // If all attempts fail across keys
    };

    // Run both prompts in parallel for speed, fully fault-tolerant
    const [techResult, hrResult] = await Promise.all([
      generateWithRetry(technicalPrompt),
      generateWithRetry(hrPrompt),
    ]);

    const clean = (text) => text.replace(/```json/gi, '').replace(/```/g, '').trim();

    let technicalQuestions, hrQuestions;
    try {
      technicalQuestions = JSON.parse(clean(techResult.response.text()));
    } catch {
      throw new Error('Mockly AI returned malformed technical questions data. Please try again.');
    }
    try {
      hrQuestions = JSON.parse(clean(hrResult.response.text()));
    } catch {
      throw new Error('Mockly AI returned malformed HR questions data. Please try again.');
    }

    // Validate and tag both arrays
    if (!Array.isArray(technicalQuestions) || !Array.isArray(hrQuestions)) {
      throw new Error('Mockly AI returned unexpected data format.');
    }

    // Merge: technical first, then HR
    const questions = [
      ...technicalQuestions.map(q => ({ ...q, questionType: 'technical' })),
      ...hrQuestions.map(q =>       ({ ...q, questionType: 'hr'        })),
    ];

    return NextResponse.json({ questions });

  } catch (error) {
    console.error('Mockly AI Question Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate interview questions. Please try again.' },
      { status: 500 }
    );
  }
}
