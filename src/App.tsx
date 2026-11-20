import React, { useCallback, useEffect, useState } from 'react';
import { TopNav } from './components/TopNav';
import { SetupView } from './components/SetupView';
import { InterviewView } from './components/InterviewView';
import { EvaluationView } from './components/EvaluationView';
import { StudyPlanView } from './components/StudyPlanView';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  evaluateAnswer,
  evaluateFollowUp,
  generateInterview,
  generateStudyPlan,
} from './services/interviewApi';
import {
  SKILL_LEVELS,
  type DomainAllocation,
  type InterviewQuestion,
  type InterviewSession,
  type SkillLevel,
  type WorkspaceTab,
} from './types/interview';

const STORAGE_KEY = 'pybench_sessions_v1';
const WELCOME_STORAGE_KEY = 'pybench_welcome_dismissed_v1';

function sanitizeSession(raw: unknown): InterviewSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (s.isSample || s.id === 'sample-senior-aiml-session') return null;
  if (typeof s.id !== 'string' || !s.id.trim()) return null;

  const questions = Array.isArray(s.questions)
    ? (s.questions.filter(
        (q) => q && typeof q === 'object' && typeof (q as { id?: unknown }).id === 'string'
      ) as InterviewQuestion[])
    : [];

  const attempts =
    s.attempts && typeof s.attempts === 'object' && !Array.isArray(s.attempts)
      ? (s.attempts as InterviewSession['attempts'])
      : {};

  const completedDrillIds = Array.isArray(s.completedDrillIds)
    ? s.completedDrillIds.filter((id): id is string => typeof id === 'string')
    : [];

  const skillLevel =
    typeof s.skillLevel === 'string' &&
    SKILL_LEVELS.includes(s.skillLevel as SkillLevel)
      ? (s.skillLevel as SkillLevel)
      : 'Mid-Level';

  const nowIso = new Date().toISOString();
  const rawJd =
    s.jdAnalysis && typeof s.jdAnalysis === 'object' && !Array.isArray(s.jdAnalysis)
      ? (s.jdAnalysis as Record<string, unknown>)
      : {};

  return {
    id: s.id,
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : nowIso,
    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : nowIso,
    roleTitle:
      typeof s.roleTitle === 'string' && s.roleTitle.trim()
        ? s.roleTitle
        : 'Python / AI-ML Engineer',
    skillLevel,
    jobDescription: typeof s.jobDescription === 'string' ? s.jobDescription : '',
    jdAnalysis: {
      extractedRole:
        typeof rawJd.extractedRole === 'string'
          ? rawJd.extractedRole
          : 'Python / AI-ML Engineer',
      senioritySignals: Array.isArray(rawJd.senioritySignals)
        ? rawJd.senioritySignals.filter((x): x is string => typeof x === 'string')
        : [],
      coreTechnologies: Array.isArray(rawJd.coreTechnologies)
        ? rawJd.coreTechnologies.filter((x): x is string => typeof x === 'string')
        : [],
      interviewEmphasis:
        typeof rawJd.interviewEmphasis === 'string' ? rawJd.interviewEmphasis : '',
    },
    questions,
    attempts,
    elapsedSeconds:
      typeof s.elapsedSeconds === 'number' && Number.isFinite(s.elapsedSeconds)
        ? Math.max(0, s.elapsedSeconds)
        : 0,
    studyPlan:
      s.studyPlan && typeof s.studyPlan === 'object' && !Array.isArray(s.studyPlan)
        ? (s.studyPlan as InterviewSession['studyPlan'])
        : undefined,
    completedDrillIds,
  };
}

function loadSavedSessions(): InterviewSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeSession)
      .filter((s): s is InterviewSession => s !== null);
  } catch {
    return [];
  }
}

function loadWelcomeState(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function App() {
  const [sessions, setSessions] = useState<InterviewSession[]>(() =>
    loadSavedSessions()
  );
  const [showWelcome, setShowWelcome] = useState<boolean>(() =>
    loadWelcomeState()
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('setup');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isEvaluatingFollowUp, setIsEvaluatingFollowUp] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessions]);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleReopenWelcome = () => {
    setShowWelcome(true);
    try {
      window.localStorage.removeItem(WELCOME_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const updateActiveSession = useCallback(
    (updater: (session: InterviewSession) => InterviewSession) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...updater(s), updatedAt: new Date().toISOString() }
            : s
        )
      );
    },
    [activeSessionId]
  );

  const handleGenerateSession = async (config: {
    roleTitle: string;
    jobDescription: string;
    skillLevel: SkillLevel;
    domainAllocation: DomainAllocation;
  }) => {
    setErrorMessage(null);
    setIsGenerating(true);
    try {
      const { jdAnalysis, questions } = await generateInterview(config);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error(
          'Unable to generate tailored questions right now. Please try again.'
        );
      }
      const now = new Date().toISOString();
      const newSession: InterviewSession = {
        id: `session-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        roleTitle: config.roleTitle || jdAnalysis?.extractedRole || 'Python / AI-ML Engineer',
        skillLevel: config.skillLevel,
        jobDescription: config.jobDescription,
        jdAnalysis: jdAnalysis ?? {
          extractedRole: config.roleTitle || 'Python / AI-ML Engineer',
          senioritySignals: [],
          coreTechnologies: [],
          interviewEmphasis: '',
        },
        questions,
        attempts: {},
        elapsedSeconds: 0,
        completedDrillIds: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setSelectedQuestionId(questions[0]?.id ?? '');
      setActiveTab('interview');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to generate your interview right now. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenSession = (sessionId: string) => {
    const found = sessions.find((s) => s.id === sessionId);
    if (!found) return;
    setErrorMessage(null);
    setActiveSessionId(found.id);
    setSelectedQuestionId(found.questions[0]?.id ?? '');
    setActiveTab('interview');
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setSelectedQuestionId('');
      setActiveTab('setup');
    }
  };

  const handleDraftChange = (questionId: string, text: string) => {
    updateActiveSession((session) => {
      const existing = session.attempts[questionId];
      return {
        ...session,
        attempts: {
          ...session.attempts,
          [questionId]: {
            questionId,
            answer: text,
            timeSpentSeconds: existing?.timeSpentSeconds ?? 0,
            skipped: false,
            evaluation: existing?.evaluation,
            followUp: existing?.followUp,
          },
        },
      };
    });
  };

  const handleSubmitAnswer = async (
    question: InterviewQuestion,
    answer: string
  ) => {
    if (!activeSession) return;
    setErrorMessage(null);
    setIsEvaluating(true);
    try {
      const { evaluation } = await evaluateAnswer({
        question,
        answer,
        skillLevel: activeSession.skillLevel,
        roleTitle: activeSession.roleTitle,
      });
      updateActiveSession((session) => {
        const existing = session.attempts[question.id];
        return {
          ...session,
          attempts: {
            ...session.attempts,
            [question.id]: {
              questionId: question.id,
              answer,
              timeSpentSeconds: existing?.timeSpentSeconds ?? 0,
              skipped: false,
              evaluation,
              followUp: undefined,
            },
          },
        };
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to evaluate your answer right now. Please try again.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSkipQuestion = (questionId: string) => {
    if (!activeSession) return;
    updateActiveSession((session) => ({
      ...session,
      attempts: {
        ...session.attempts,
        [questionId]: {
          questionId,
          answer: session.attempts[questionId]?.answer ?? '',
          timeSpentSeconds: session.attempts[questionId]?.timeSpentSeconds ?? 0,
          skipped: true,
        },
      },
    }));
    const idx = activeSession.questions.findIndex((q) => q.id === questionId);
    const next = activeSession.questions[idx + 1];
    if (next) {
      setSelectedQuestionId(next.id);
    }
  };

  const handleSubmitFollowUp = async (
    question: InterviewQuestion,
    followUpAnswer: string
  ) => {
    if (!activeSession) return;
    const attempt = activeSession.attempts[question.id];
    if (!attempt?.evaluation) return;
    setErrorMessage(null);
    setIsEvaluatingFollowUp(true);
    try {
      const { followUp } = await evaluateFollowUp({
        question,
        originalAnswer: attempt.answer,
        followUpQuestion: attempt.evaluation.followUpQuestion,
        followUpAnswer,
        skillLevel: activeSession.skillLevel,
      });
      updateActiveSession((session) => ({
        ...session,
        attempts: {
          ...session.attempts,
          [question.id]: {
            ...session.attempts[question.id],
            followUp,
          },
        },
      }));
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to evaluate your follow-up right now. Please try again.'
      );
    } finally {
      setIsEvaluatingFollowUp(false);
    }
  };

  const handleTickTimer = useCallback(() => {
    updateActiveSession((session) => ({
      ...session,
      elapsedSeconds: session.elapsedSeconds + 1,
    }));
  }, [updateActiveSession]);

  const handleGenerateStudyPlan = async () => {
    if (!activeSession) return;
    setErrorMessage(null);
    setIsGeneratingPlan(true);
    try {
      const performanceDigest = activeSession.questions
        .map((q) => {
          const attempt = activeSession.attempts[q.id];
          if (!attempt || (!attempt.evaluation && !attempt.skipped)) {
            return null;
          }
          const ev = attempt.evaluation;
          return {
            domain: q.domain,
            questionTitle: q.title,
            score: ev
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    ev.overallScore + (attempt.followUp?.scoreDelta ?? 0)
                  )
                )
              : 0,
            verdict: ev ? ev.verdict : 'Needs Work',
            gapsAndMistakes: ev?.gapsAndMistakes ?? ['Question skipped'],
            missedConcepts: ev?.missedConcepts ?? q.keyConceptsExpected,
            skipped: attempt.skipped,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const { studyPlan } = await generateStudyPlan({
        roleTitle: activeSession.roleTitle,
        skillLevel: activeSession.skillLevel,
        jobDescription: activeSession.jobDescription,
        performanceDigest,
        sessionTracks: activeSession.questions.map(
          (q) => `${q.domain}: ${q.title}`
        ),
      });

      updateActiveSession((session) => ({
        ...session,
        studyPlan,
      }));
      setActiveTab('study-plan');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to build your study plan right now. Please try again.'
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleToggleDrill = (drillId: string) => {
    updateActiveSession((session) => {
      const exists = session.completedDrillIds.includes(drillId);
      return {
        ...session,
        completedDrillIds: exists
          ? session.completedDrillIds.filter((id) => id !== drillId)
          : [...session.completedDrillIds, drillId],
      };
    });
  };

  const handlePrimaryHeaderAction = () => {
    setErrorMessage(null);
    if (activeTab === 'setup') {
      if (activeSession) {
        setActiveTab('interview');
      } else {
        const el = document.getElementById('role-title-input');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      }
    } else {
      setActiveTab('setup');
    }
  };

  const primaryActionLabel =
    activeTab === 'setup'
      ? activeSession
        ? 'Resume Interview'
        : 'Start Setup'
      : 'New Session';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <TopNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setErrorMessage(null);
          setActiveTab(tab);
        }}
        hasActiveSession={Boolean(activeSession)}
        hasStudyPlan={Boolean(activeSession?.studyPlan)}
        onPrimaryAction={handlePrimaryHeaderAction}
        primaryActionLabel={primaryActionLabel}
      />

      <main className="flex-1">
        {activeTab === 'setup' && (
          <ErrorBoundary
            sectionLabel="Setup Workbench"
            onResetStorage={() => {
              try {
                window.localStorage.removeItem(STORAGE_KEY);
              } catch {
                // Ignore storage errors
              }
              setSessions([]);
              setActiveSessionId(null);
            }}
          >
            <SetupView
              sessions={sessions}
              activeSessionId={activeSessionId}
              showWelcome={showWelcome}
              onDismissWelcome={handleDismissWelcome}
              onReopenWelcome={handleReopenWelcome}
              isGenerating={isGenerating}
              errorMessage={errorMessage}
              onGenerateSession={handleGenerateSession}
              onOpenSession={handleOpenSession}
              onDeleteSession={handleDeleteSession}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'interview' && activeSession && (
          <ErrorBoundary
            sectionLabel="Mock Interview"
            onResetStorage={() => setActiveTab('setup')}
          >
            <InterviewView
              session={activeSession}
              selectedQuestionId={
                selectedQuestionId || activeSession.questions[0]?.id || ''
              }
              onSelectQuestion={(id) => {
                setErrorMessage(null);
                setSelectedQuestionId(id);
              }}
              onDraftChange={handleDraftChange}
              onSubmitAnswer={handleSubmitAnswer}
              onSkipQuestion={handleSkipQuestion}
              onSubmitFollowUp={handleSubmitFollowUp}
              onTickTimer={handleTickTimer}
              onFinishSession={() => {
                setErrorMessage(null);
                setActiveTab('evaluation');
              }}
              isEvaluating={isEvaluating}
              isEvaluatingFollowUp={isEvaluatingFollowUp}
              errorMessage={errorMessage}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'evaluation' && activeSession && (
          <ErrorBoundary
            sectionLabel="Evaluation"
            onResetStorage={() => setActiveTab('setup')}
          >
            <EvaluationView
              session={activeSession}
              isGeneratingPlan={isGeneratingPlan}
              errorMessage={errorMessage}
              onGenerateStudyPlan={handleGenerateStudyPlan}
              onOpenStudyPlan={() => {
                setErrorMessage(null);
                setActiveTab('study-plan');
              }}
              onJumpToQuestion={(qId) => {
                setErrorMessage(null);
                setSelectedQuestionId(qId);
                setActiveTab('interview');
              }}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'study-plan' && activeSession && (
          <ErrorBoundary
            sectionLabel="Study Plan"
            onResetStorage={() => setActiveTab('setup')}
          >
            <StudyPlanView
              session={activeSession}
              isGeneratingPlan={isGeneratingPlan}
              errorMessage={errorMessage}
              onGenerateStudyPlan={handleGenerateStudyPlan}
              onToggleDrill={handleToggleDrill}
              onGoToInterview={() => {
                setErrorMessage(null);
                setActiveTab('interview');
              }}
              onStartNewSession={() => {
                setErrorMessage(null);
                setActiveTab('setup');
              }}
            />
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            PyBench · Structured technical mock interviews for Python & AI/ML engineers
          </span>
          <span>Sessions are stored locally in your browser</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
