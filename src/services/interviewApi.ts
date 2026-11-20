import type {
  AnswerEvaluation,
  DomainAllocation,
  FollowUpExchange,
  InterviewQuestion,
  JDAnalysis,
  SkillLevel,
  StudyPlan,
} from '../types/interview';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Unable to reach the interview service. Please try again.'
    );
  }
  return data as T;
}

export async function generateInterview(payload: {
  jobDescription: string;
  roleTitle: string;
  skillLevel: SkillLevel;
  domainAllocation: DomainAllocation;
}): Promise<{ jdAnalysis: JDAnalysis; questions: InterviewQuestion[] }> {
  return postJson('/api/interview/generate', payload);
}

export async function evaluateAnswer(payload: {
  question: InterviewQuestion;
  answer: string;
  skillLevel: SkillLevel;
  roleTitle: string;
}): Promise<{ evaluation: AnswerEvaluation }> {
  return postJson('/api/interview/evaluate', payload);
}

export async function evaluateFollowUp(payload: {
  question: InterviewQuestion;
  originalAnswer: string;
  followUpQuestion: string;
  followUpAnswer: string;
  skillLevel: SkillLevel;
}): Promise<{ followUp: FollowUpExchange }> {
  return postJson('/api/interview/followup', payload);
}

export async function generateStudyPlan(payload: {
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
}): Promise<{ studyPlan: StudyPlan }> {
  return postJson('/api/interview/study-plan', payload);
}
