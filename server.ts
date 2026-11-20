import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  DomainAllocation,
  InterviewQuestion,
  SkillLevel,
} from './src/types/interview.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('MISSING_API_KEY'),
      { status: 400 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const statusFromErr =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined;

  if (
    raw === 'MISSING_API_KEY' ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('PERMISSION_DENIED') ||
    statusFromErr === 403 ||
    statusFromErr === 401
  ) {
    return {
      status: statusFromErr === 401 || statusFromErr === 403 ? statusFromErr : 400,
      message:
        'Your Gemini API key is missing or needs verification. Please check your key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || statusFromErr === 429) {
    return {
      status: 429,
      message:
        'The AI service is temporarily busy. Please wait a moment and try again.',
    };
  }
  return {
    status: statusFromErr && statusFromErr >= 400 && statusFromErr < 600 ? statusFromErr : 500,
    message:
      'We could not complete this request right now. Please try again in a moment.',
  };
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('ECONNRESET') ||
        msg.includes('fetch failed');
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 1. Generate Role-Specific Mock Interview Session
app.post('/api/interview/generate', async (req: Request, res: Response) => {
  try {
    const {
      jobDescription,
      roleTitle,
      skillLevel,
      domainAllocation,
    }: {
      jobDescription: string;
      roleTitle: string;
      skillLevel: SkillLevel;
      domainAllocation: DomainAllocation;
    } = req.body;

    if (!jobDescription || jobDescription.trim().length < 30) {
      return res.status(400).json({
        error: 'Please provide a job description with at least 30 characters.',
      });
    }

    const totalQuestions = Object.values(domainAllocation || {}).reduce(
      (sum, count) => sum + Number(count || 0),
      0
    );

    if (totalQuestions < 1 || totalQuestions > 12) {
      return res.status(400).json({
        error: 'Total question count must be between 1 and 12.',
      });
    }

    const ai = getGeminiClient();

    const allocationSummary = Object.entries(domainAllocation)
      .filter(([, count]) => count > 0)
      .map(([domain, count]) => `- ${domain}: ${count} question(s)`)
      .join('\n');

    const prompt = `Target Role: ${roleTitle || 'Python / AI-ML Engineer'}
Candidate Skill Level: ${skillLevel}

Job Description:
"""
${jobDescription.slice(0, 6000)}
"""

Exact Domain Allocation Required (total ${totalQuestions} questions):
${allocationSummary}

Generate a realistic, deeply technical mock interview tailored specifically to this job description and ${skillLevel} bar.
Rules:
1. Respect the exact domain counts requested above. Every domain string MUST be one of: "Python Internals", "FastAPI & Backend", "RAG & LLM Evaluation", "SQL & Data Modeling", "DSA & Problem Solving".
2. Ground every question in concrete production scenarios implied by the job description (no generic trivia).
3. Calibrate difficulty to ${skillLevel}:
   - Junior: core mechanics, clean implementation, basic debugging.
   - Mid-Level: applied production tradeoffs, concurrency/query behavior, testing & eval design.
   - Senior: internals, failure modes at scale, latency/cost/accuracy tradeoffs, architectural rigor.
   - Staff: cross-system bottlenecks, subtle runtime invariants, multi-metric evaluation governance, high-scale optimization.
4. For each question, include 3-5 specific keyConceptsExpected (rubric anchors) and 2-3 commonPitfalls (likely mistakes candidates make).
5. Keep prompts crisp, unambiguous, and answerable in writing within 5-10 minutes.`;

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a Principal Python and AI/ML Staff Interviewer designing high-signal technical written mock interviews. Be rigorous, practical, and specific to production engineering.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              jdAnalysis: {
                type: Type.OBJECT,
                properties: {
                  extractedRole: { type: Type.STRING },
                  senioritySignals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  coreTechnologies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  interviewEmphasis: { type: Type.STRING },
                },
                required: [
                  'extractedRole',
                  'senioritySignals',
                  'coreTechnologies',
                  'interviewEmphasis',
                ],
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    domain: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    scenarioContext: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    keyConceptsExpected: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    commonPitfalls: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    'domain',
                    'difficulty',
                    'estimatedMinutes',
                    'title',
                    'prompt',
                    'scenarioContext',
                    'hint',
                    'keyConceptsExpected',
                    'commonPitfalls',
                  ],
                },
              },
            },
            required: ['jdAnalysis', 'questions'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const questions: InterviewQuestion[] = (parsed.questions || []).map(
      (q: Omit<InterviewQuestion, 'id' | 'index'>, idx: number) => ({
        ...q,
        id: `q-${idx + 1}-${Date.now()}`,
        index: idx + 1,
      })
    );

    return res.json({
      jdAnalysis: parsed.jdAnalysis,
      questions,
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 2. Evaluate Written Answer Against 4-Axis Technical Rubric
app.post('/api/interview/evaluate', async (req: Request, res: Response) => {
  try {
    const {
      question,
      answer,
      skillLevel,
      roleTitle,
    }: {
      question: InterviewQuestion;
      answer: string;
      skillLevel: SkillLevel;
      roleTitle: string;
    } = req.body;

    if (!answer || answer.trim().length < 15) {
      return res.status(400).json({
        error: 'Please write a more complete answer (at least 15 characters) before submitting.',
      });
    }

    const ai = getGeminiClient();

    const prompt = `Target Role: ${roleTitle}
Candidate Skill Level Bar: ${skillLevel}
Domain: ${question.domain} (${question.difficulty})

Question Title: ${question.title}
Scenario Context: ${question.scenarioContext}
Question Prompt: ${question.prompt}

Expected Key Concepts (Rubric Anchors):
${question.keyConceptsExpected.map((c) => `- ${c}`).join('\n')}

Common Candidate Pitfalls:
${question.commonPitfalls.map((p) => `- ${p}`).join('\n')}

Candidate Written Answer:
"""
${answer.slice(0, 8000)}
"""

Evaluate the candidate's written answer rigorously against the ${skillLevel} hiring bar.
Scoring rules:
- Each of the 4 rubric dimensions (technicalAccuracy, depthAndInternals, productionTradeoffs, clarityAndStructure) is an integer from 0 to 5.
- overallScore is an integer 0 to 100 aligned with the 4 rubric scores and ${skillLevel} expectations.
- verdict MUST be one of: "Strong Hire" (>= 85), "Hire" (72-84), "Borderline" (55-71), "Needs Work" (< 55).
- Be honest and specific: point out concrete technical inaccuracies, hand-waving, missing edge cases, or unstated complexity/latency tradeoffs.
- followUpQuestion: write ONE sharp, realistic follow-up probe an interviewer would ask next based directly on a gap or claim in the candidate's answer.
- modelAnswerOutline: provide a concise, structured senior-level reference answer (4-6 bullet lines or short paragraphs) showing what a strong written answer covers.`;

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a calibrated Principal Technical Interviewer evaluating written engineering responses for Python and AI/ML roles. Never inflate scores for vague buzzwords; reward concrete mechanisms, accurate complexity/SQL/runtime semantics, and explicit tradeoffs.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.INTEGER },
              verdict: { type: Type.STRING },
              rubric: {
                type: Type.OBJECT,
                properties: {
                  technicalAccuracy: { type: Type.INTEGER },
                  depthAndInternals: { type: Type.INTEGER },
                  productionTradeoffs: { type: Type.INTEGER },
                  clarityAndStructure: { type: Type.INTEGER },
                },
                required: [
                  'technicalAccuracy',
                  'depthAndInternals',
                  'productionTradeoffs',
                  'clarityAndStructure',
                ],
              },
              summaryFeedback: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gapsAndMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
              missedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
              followUpQuestion: { type: Type.STRING },
              modelAnswerOutline: { type: Type.STRING },
            },
            required: [
              'overallScore',
              'verdict',
              'rubric',
              'summaryFeedback',
              'strengths',
              'gapsAndMistakes',
              'missedConcepts',
              'followUpQuestion',
              'modelAnswerOutline',
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json({
      evaluation: {
        ...parsed,
        questionId: question.id,
        evaluatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 3. Evaluate Follow-Up Probe Response
app.post('/api/interview/followup', async (req: Request, res: Response) => {
  try {
    const {
      question,
      originalAnswer,
      followUpQuestion,
      followUpAnswer,
      skillLevel,
    }: {
      question: InterviewQuestion;
      originalAnswer: string;
      followUpQuestion: string;
      followUpAnswer: string;
      skillLevel: SkillLevel;
    } = req.body;

    if (!followUpAnswer || followUpAnswer.trim().length < 10) {
      return res.status(400).json({
        error: 'Please enter a follow-up response before submitting.',
      });
    }

    const ai = getGeminiClient();

    const prompt = `Domain: ${question.domain} | Target Level: ${skillLevel}
Original Question: ${question.prompt}
Candidate Original Answer: ${originalAnswer.slice(0, 2500)}
Interviewer Follow-Up Probe: ${followUpQuestion}
Candidate Follow-Up Response: ${followUpAnswer.slice(0, 2500)}

Provide concise, direct feedback (2-3 sentences) on whether the candidate closed the gap in their follow-up, and an integer scoreDelta from -5 to +10 reflecting how much this follow-up improves or hurts confidence in their mastery.`;

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a Principal Technical Interviewer giving crisp, calibrated feedback on a candidate follow-up answer.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              scoreDelta: { type: Type.INTEGER },
            },
            required: ['feedback', 'scoreDelta'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json({
      followUp: {
        answer: followUpAnswer,
        feedback: parsed.feedback,
        scoreDelta: Math.max(-5, Math.min(10, Number(parsed.scoreDelta) || 0)),
        answeredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 4. Generate Prioritized Weak-Area Study Plan
app.post('/api/interview/study-plan', async (req: Request, res: Response) => {
  try {
    const {
      roleTitle,
      skillLevel,
      jobDescription,
      performanceDigest,
    }: {
      roleTitle: string;
      skillLevel: SkillLevel;
      jobDescription: string;
      performanceDigest: Array<{
        domain: string;
        questionTitle: string;
        score: number;
        verdict: string;
        gapsAndMistakes: string[];
        missedConcepts: string[];
        skipped: boolean;
      }>;
    } = req.body;

    if (!Array.isArray(performanceDigest) || performanceDigest.length === 0) {
      return res.status(400).json({
        error: 'At least one evaluated or attempted question is required to build a study plan.',
      });
    }

    const ai = getGeminiClient();

    const digestText = performanceDigest
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.domain}] ${item.questionTitle} — ${
            item.skipped ? 'SKIPPED (0/100)' : `${item.score}/100 (${item.verdict})`
          }\n   Missed concepts: ${item.missedConcepts.join(', ') || 'None'}\n   Gaps: ${
            item.gapsAndMistakes.join('; ') || 'None'
          }`
      )
      .join('\n\n');

    const prompt = `Target Role: ${roleTitle}
Candidate Skill Level: ${skillLevel}

Job Description Context:
${jobDescription.slice(0, 2000)}

Mock Interview Performance Digest:
${digestText}

Synthesize a systematic, prioritized Weak-Area Study Plan to close the candidate's exact gaps for this role.
Requirements:
1. priorityWeakAreas: 3 to 5 ranked weak areas ordered from most critical to polish. Each must include:
   - domain (one of the 5 standard tracks)
   - topic (specific subtopic, e.g. "AsyncIO Event Loop & Blocking I/O in FastAPI")
   - severity: "Critical", "Moderate", or "Polish"
   - diagnosis: 1-2 sentences grounded in their actual interview performance
   - targetOutcome: concrete mastery bar to hit
   - drills: 2-3 hands-on exercises (coding, query profiling, eval harness build, or architecture writeup) with title, description, deliverable, and estimatedHours (0.5 to 3).
2. weeklySchedule: a 7-day structured preparation schedule (Day 1 through Day 7) targeting the weakest areas first, ending with a verification re-test day. Each day has dayLabel, focusDomain, objective, practiceTask, verificationCheckpoint, and durationMinutes (45-120).
3. commonMistakesToEliminate: 3-5 concrete habits or interview pitfalls observed across their answers.`;

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a Technical Interview Coach for Python and AI/ML engineers. Produce concrete, hands-on engineering drills—never generic advice like "read the docs" or "practice more LeetCode".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              readinessSummary: { type: Type.STRING },
              estimatedPrepHours: { type: Type.INTEGER },
              priorityWeakAreas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    domain: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    diagnosis: { type: Type.STRING },
                    targetOutcome: { type: Type.STRING },
                    drills: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          deliverable: { type: Type.STRING },
                          estimatedHours: { type: Type.NUMBER },
                        },
                        required: [
                          'title',
                          'description',
                          'deliverable',
                          'estimatedHours',
                        ],
                      },
                    },
                  },
                  required: [
                    'domain',
                    'topic',
                    'severity',
                    'diagnosis',
                    'targetOutcome',
                    'drills',
                  ],
                },
              },
              weeklySchedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayLabel: { type: Type.STRING },
                    focusDomain: { type: Type.STRING },
                    objective: { type: Type.STRING },
                    practiceTask: { type: Type.STRING },
                    verificationCheckpoint: { type: Type.STRING },
                    durationMinutes: { type: Type.INTEGER },
                  },
                  required: [
                    'dayLabel',
                    'focusDomain',
                    'objective',
                    'practiceTask',
                    'verificationCheckpoint',
                    'durationMinutes',
                  ],
                },
              },
              commonMistakesToEliminate: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'readinessSummary',
              'estimatedPrepHours',
              'priorityWeakAreas',
              'weeklySchedule',
              'commonMistakesToEliminate',
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const studyPlan = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      priorityWeakAreas: (parsed.priorityWeakAreas || []).map(
        (area: { drills?: Array<Record<string, unknown>> }, aIdx: number) => ({
          ...area,
          id: `wa-${aIdx + 1}-${Date.now()}`,
          drills: (area.drills || []).map((drill, dIdx) => ({
            ...drill,
            id: `drill-${aIdx + 1}-${dIdx + 1}-${Date.now()}`,
          })),
        })
      ),
    };

    return res.json({ studyPlan });
  } catch (err) {
    const formatted = formatGeminiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PyBench server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
