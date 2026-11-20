import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  DomainAllocation,
  InterviewQuestion,
  SkillLevel,
} from '../src/types/interview.js';

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('MISSING_API_KEY'), { status: 400 });
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

export function formatGeminiError(err: unknown): {
  status: number;
  message: string;
} {
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
      status:
        statusFromErr === 401 || statusFromErr === 403 ? statusFromErr : 400,
      message:
        'Your Gemini API key is missing or needs verification. Please check your key in environment settings.',
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
    status:
      statusFromErr && statusFromErr >= 400 && statusFromErr < 600
        ? statusFromErr
        : 500,
    message:
      'We could not complete this request right now. Please try again in a moment.',
  };
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
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

export async function readJsonBody<T = Record<string, unknown>>(
  req: IncomingMessage & { body?: unknown }
): Promise<T> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      return (req.body ? JSON.parse(req.body) : {}) as T;
    }
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export async function handleGenerateInterview(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const {
      jobDescription,
      roleTitle,
      skillLevel,
      domainAllocation,
    } = await readJsonBody<{
      jobDescription: string;
      roleTitle: string;
      skillLevel: SkillLevel;
      domainAllocation: DomainAllocation;
    }>(req);

    if (!jobDescription || jobDescription.trim().length < 30) {
      sendJson(res, 400, {
        error: 'Please provide a job description with at least 30 characters.',
      });
      return;
    }

    const totalQuestions = Object.values(domainAllocation || {}).reduce(
      (sum, count) => sum + Number(count || 0),
      0
    );

    if (totalQuestions < 1 || totalQuestions > 12) {
      sendJson(res, 400, {
        error: 'Total question count must be between 1 and 12.',
      });
      return;
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    sendJson(res, 200, {
      jdAnalysis: parsed.jdAnalysis,
      questions,
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    sendJson(res, formatted.status, { error: formatted.message });
  }
}

export async function handleEvaluateAnswer(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const { question, answer, skillLevel, roleTitle } = await readJsonBody<{
      question: InterviewQuestion;
      answer: string;
      skillLevel: SkillLevel;
      roleTitle: string;
    }>(req);

    if (!answer || answer.trim().length < 15) {
      sendJson(res, 400, {
        error:
          'Please write a more complete answer (at least 15 characters) before submitting.',
      });
      return;
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
              gapsAndMistakes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
    sendJson(res, 200, {
      evaluation: {
        ...parsed,
        questionId: question.id,
        evaluatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    sendJson(res, formatted.status, { error: formatted.message });
  }
}

export async function handleEvaluateFollowUp(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const {
      question,
      originalAnswer,
      followUpQuestion,
      followUpAnswer,
      skillLevel,
    } = await readJsonBody<{
      question: InterviewQuestion;
      originalAnswer: string;
      followUpQuestion: string;
      followUpAnswer: string;
      skillLevel: SkillLevel;
    }>(req);

    if (!followUpAnswer || followUpAnswer.trim().length < 10) {
      sendJson(res, 400, {
        error: 'Please enter a follow-up response before submitting.',
      });
      return;
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
    sendJson(res, 200, {
      followUp: {
        answer: followUpAnswer,
        feedback: parsed.feedback,
        scoreDelta: Math.max(-5, Math.min(10, Number(parsed.scoreDelta) || 0)),
        answeredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    sendJson(res, formatted.status, { error: formatted.message });
  }
}

export async function handleGenerateStudyPlan(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const {
      roleTitle,
      skillLevel,
      jobDescription,
      performanceDigest,
      sessionTracks,
    } = await readJsonBody<{
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
      sessionTracks?: string[];
    }>(req);

    const hasDigest =
      Array.isArray(performanceDigest) && performanceDigest.length > 0;
    const hasContext =
      Boolean(jobDescription && jobDescription.trim().length >= 20) ||
      Boolean(roleTitle && roleTitle.trim().length > 0);

    if (!hasDigest && !hasContext) {
      sendJson(res, 400, {
        error:
          'Please configure a target role or evaluate at least one question before generating a study plan.',
      });
      return;
    }

    const ai = getGeminiClient();

    const digestText = hasDigest
      ? performanceDigest
          .map(
            (item, idx) =>
              `${idx + 1}. [${item.domain}] ${item.questionTitle} — ${
                item.skipped
                  ? 'SKIPPED (0/100)'
                  : `${item.score}/100 (${item.verdict})`
              }\n   Missed concepts: ${
                item.missedConcepts.join(', ') || 'None'
              }\n   Gaps: ${item.gapsAndMistakes.join('; ') || 'None'}`
          )
          .join('\n\n')
      : `No answers evaluated yet. Target interview tracks:\n${
          Array.isArray(sessionTracks) && sessionTracks.length > 0
            ? sessionTracks.map((t) => `- ${t}`).join('\n')
            : '- Python Internals\n- FastAPI & Backend\n- RAG & LLM Evaluation\n- SQL & Data Modeling\n- DSA & Problem Solving'
        }`;

    const prompt = `Target Role: ${roleTitle || 'Python / AI-ML Engineer'}
Candidate Skill Level: ${skillLevel}

Job Description Context:
${(jobDescription || '').slice(0, 2000)}

${hasDigest ? 'Mock Interview Performance Digest:' : 'Baseline Preparation Context (Pre-Evaluation):'}
${digestText}

Synthesize a systematic, prioritized Study Plan ${
      hasDigest
        ? "to close the candidate's exact gaps for this role"
        : 'to prepare the candidate for this target role and interview tracks'
    }.
Requirements:
1. priorityWeakAreas: 3 to 5 ranked focus areas ordered from highest impact to polish. Each must include:
   - domain (one of the 5 standard tracks)
   - topic (specific subtopic, e.g. "AsyncIO Event Loop & Blocking I/O in FastAPI")
   - severity: "Critical", "Moderate", or "Polish"
   - diagnosis: 1-2 sentences grounded in ${
     hasDigest
       ? 'their actual interview performance'
       : 'the job description and seniority expectations'
   }
   - targetOutcome: concrete mastery bar to hit
   - drills: 2-3 hands-on exercises (coding, query profiling, eval harness build, or architecture writeup) with title, description, deliverable, and estimatedHours (0.5 to 3).
2. weeklySchedule: a 7-day structured preparation schedule (Day 1 through Day 7) targeting the highest-priority areas first, ending with a verification re-test day. Each day has dayLabel, focusDomain, objective, practiceTask, verificationCheckpoint, and durationMinutes (45-120).
3. commonMistakesToEliminate: 3-5 concrete habits or interview pitfalls to avoid at the ${skillLevel} bar.`;

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a Technical Interview Coach for Python and AI/ML engineers. Produce concrete, hands-on engineering drills—never generic advice like "read the docs" or "practice more LeetCode".',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
      readinessSummary:
        typeof parsed.readinessSummary === 'string'
          ? parsed.readinessSummary
          : '',
      estimatedPrepHours: Number(parsed.estimatedPrepHours) || 10,
      generatedAt: new Date().toISOString(),
      priorityWeakAreas: (Array.isArray(parsed.priorityWeakAreas)
        ? parsed.priorityWeakAreas
        : []
      ).map(
        (area: { drills?: Array<Record<string, unknown>> }, aIdx: number) => ({
          ...area,
          id: `wa-${aIdx + 1}-${Date.now()}`,
          drills: (Array.isArray(area.drills) ? area.drills : []).map(
            (drill, dIdx) => ({
              ...drill,
              id: `drill-${aIdx + 1}-${dIdx + 1}-${Date.now()}`,
            })
          ),
        })
      ),
      weeklySchedule: Array.isArray(parsed.weeklySchedule)
        ? parsed.weeklySchedule
        : [],
      commonMistakesToEliminate: Array.isArray(parsed.commonMistakesToEliminate)
        ? parsed.commonMistakesToEliminate
        : [],
    };

    sendJson(res, 200, { studyPlan });
  } catch (err) {
    const formatted = formatGeminiError(err);
    sendJson(res, formatted.status, { error: formatted.message });
  }
}
