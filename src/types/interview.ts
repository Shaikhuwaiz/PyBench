export type DomainTrack =
  | 'Python Internals'
  | 'FastAPI & Backend'
  | 'RAG & LLM Evaluation'
  | 'SQL & Data Modeling'
  | 'DSA & Problem Solving';

export type SkillLevel = 'Junior' | 'Mid-Level' | 'Senior' | 'Staff';

export type QuestionDifficulty = 'Foundational' | 'Applied' | 'Staff-Level';

export type EvaluationVerdict = 'Strong Hire' | 'Hire' | 'Borderline' | 'Needs Work';

export type WeakAreaSeverity = 'Critical' | 'Moderate' | 'Polish';

export const ALL_DOMAINS: DomainTrack[] = [
  'Python Internals',
  'FastAPI & Backend',
  'RAG & LLM Evaluation',
  'SQL & Data Modeling',
  'DSA & Problem Solving',
];

export const SKILL_LEVELS: SkillLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Staff'];

export const TARGET_BENCHMARK_BY_LEVEL: Record<SkillLevel, number> = {
  Junior: 65,
  'Mid-Level': 74,
  Senior: 82,
  Staff: 88,
};

export interface DomainAllocation {
  'Python Internals': number;
  'FastAPI & Backend': number;
  'RAG & LLM Evaluation': number;
  'SQL & Data Modeling': number;
  'DSA & Problem Solving': number;
}

export interface JDAnalysis {
  extractedRole: string;
  senioritySignals: string[];
  coreTechnologies: string[];
  interviewEmphasis: string;
}

export interface InterviewQuestion {
  id: string;
  index: number;
  domain: DomainTrack;
  difficulty: QuestionDifficulty;
  estimatedMinutes: number;
  title: string;
  prompt: string;
  scenarioContext: string;
  hint: string;
  keyConceptsExpected: string[];
  commonPitfalls: string[];
}

export interface RubricScores {
  technicalAccuracy: number; // 0-5
  depthAndInternals: number; // 0-5
  productionTradeoffs: number; // 0-5
  clarityAndStructure: number; // 0-5
}

export interface AnswerEvaluation {
  questionId: string;
  overallScore: number; // 0-100
  verdict: EvaluationVerdict;
  rubric: RubricScores;
  summaryFeedback: string;
  strengths: string[];
  gapsAndMistakes: string[];
  missedConcepts: string[];
  followUpQuestion: string;
  modelAnswerOutline: string;
  evaluatedAt: string;
}

export interface FollowUpExchange {
  answer: string;
  feedback: string;
  scoreDelta: number; // -5 to +10 contextual bonus indicator
  answeredAt: string;
}

export interface QuestionAttempt {
  questionId: string;
  answer: string;
  timeSpentSeconds: number;
  skipped: boolean;
  evaluation?: AnswerEvaluation;
  followUp?: FollowUpExchange;
}

export interface StudyDrill {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  estimatedHours: number;
  completed?: boolean;
}

export interface WeakAreaItem {
  id: string;
  domain: DomainTrack;
  topic: string;
  severity: WeakAreaSeverity;
  diagnosis: string;
  targetOutcome: string;
  drills: StudyDrill[];
}

export interface StudyScheduleDay {
  dayLabel: string;
  focusDomain: DomainTrack;
  objective: string;
  practiceTask: string;
  verificationCheckpoint: string;
  durationMinutes: number;
}

export interface StudyPlan {
  generatedAt: string;
  readinessSummary: string;
  estimatedPrepHours: number;
  priorityWeakAreas: WeakAreaItem[];
  weeklySchedule: StudyScheduleDay[];
  commonMistakesToEliminate: string[];
}

export interface InterviewSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  roleTitle: string;
  skillLevel: SkillLevel;
  jobDescription: string;
  jdAnalysis: JDAnalysis;
  questions: InterviewQuestion[];
  attempts: Record<string, QuestionAttempt>;
  elapsedSeconds: number;
  studyPlan?: StudyPlan;
  completedDrillIds: string[];
}

export type WorkspaceTab = 'setup' | 'interview' | 'evaluation' | 'study-plan';
