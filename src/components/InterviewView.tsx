import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Pause,
  Play,
  Send,
  SkipForward,
} from 'lucide-react';
import type {
  InterviewQuestion,
  InterviewSession,
} from '../types/interview';
import {
  computeSessionMetrics,
  formatDuration,
  getVerdictStyle,
} from '../utils/sessionMetrics';

interface InterviewViewProps {
  session: InterviewSession;
  selectedQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  onDraftChange: (questionId: string, text: string) => void;
  onSubmitAnswer: (question: InterviewQuestion, answer: string) => Promise<void>;
  onSkipQuestion: (questionId: string) => void;
  onSubmitFollowUp: (
    question: InterviewQuestion,
    followUpAnswer: string
  ) => Promise<void>;
  onTickTimer: () => void;
  onFinishSession: () => void;
  isEvaluating: boolean;
  isEvaluatingFollowUp: boolean;
  errorMessage: string | null;
}

const RUBRIC_LABELS: Array<{
  key: 'technicalAccuracy' | 'depthAndInternals' | 'productionTradeoffs' | 'clarityAndStructure';
  label: string;
}> = [
  { key: 'technicalAccuracy', label: 'Technical Accuracy' },
  { key: 'depthAndInternals', label: 'Depth & Internals' },
  { key: 'productionTradeoffs', label: 'Production Tradeoffs' },
  { key: 'clarityAndStructure', label: 'Clarity & Structure' },
];

export const InterviewView: React.FC<InterviewViewProps> = ({
  session,
  selectedQuestionId,
  onSelectQuestion,
  onDraftChange,
  onSubmitAnswer,
  onSkipQuestion,
  onSubmitFollowUp,
  onTickTimer,
  onFinishSession,
  isEvaluating,
  isEvaluatingFollowUp,
  errorMessage,
}) => {
  const [timerRunning, setTimerRunning] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [showModelOutline, setShowModelOutline] = useState(false);
  const [monoEditor, setMonoEditor] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');

  const currentQuestion =
    session.questions.find((q) => q.id === selectedQuestionId) ||
    session.questions[0];

  const attempt = session.attempts[currentQuestion.id];
  const answerText = attempt?.answer ?? '';
  const evaluation = attempt?.evaluation;
  const followUp = attempt?.followUp;
  const metrics = computeSessionMetrics(session);

  useEffect(() => {
    setShowHint(false);
    setShowModelOutline(false);
    setFollowUpDraft('');
  }, [currentQuestion.id]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      onTickTimer();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, onTickTimer]);

  const wordCount = answerText.trim()
    ? answerText.trim().split(/\s+/).length
    : 0;

  const currentIndex = session.questions.findIndex(
    (q) => q.id === currentQuestion.id
  );
  const nextQuestion = session.questions[currentIndex + 1];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isEvaluating && answerText.trim().length >= 15) {
        onSubmitAnswer(currentQuestion, answerText);
      }
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar: Question Queue & Timer */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-5 lg:sticky lg:top-24">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">
              {session.skillLevel} Bar
            </p>
            <h2 className="text-base font-semibold text-slate-950 leading-snug">
              {session.roleTitle}
            </h2>
          </div>

          {/* Session Timer */}
          <div className="py-3 border-y border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-mono font-medium tabular-nums text-slate-950">
                {formatDuration(session.elapsedSeconds)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTimerRunning((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors"
            >
              {timerRunning ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Resume</span>
                </>
              )}
            </button>
          </div>

          {/* Question List */}
          <nav aria-label="Interview questions" className="space-y-1">
            {session.questions.map((q) => {
              const qAttempt = session.attempts[q.id];
              const isSelected = q.id === currentQuestion.id;
              let statusLabel = 'Pending';
              let statusColor = 'text-slate-400';

              if (qAttempt?.evaluation) {
                const effective = Math.max(
                  0,
                  Math.min(
                    100,
                    qAttempt.evaluation.overallScore +
                      (qAttempt.followUp?.scoreDelta ?? 0)
                  )
                );
                statusLabel = `${effective}/100`;
                statusColor =
                  effective >= 80
                    ? 'text-emerald-700'
                    : effective >= 65
                    ? 'text-amber-700'
                    : 'text-red-700';
              } else if (qAttempt?.skipped) {
                statusLabel = 'Skipped';
                statusColor = 'text-slate-400';
              } else if (qAttempt?.answer && qAttempt.answer.trim().length > 0) {
                statusLabel = 'Draft';
                statusColor = 'text-blue-700';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectQuestion(q.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono tabular-nums text-slate-500">
                      {String(q.index).padStart(2, '0')}. {q.domain.split(' ')[0]}
                    </span>
                    <span className={`font-mono tabular-nums font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">
                    {q.title}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Progress & Finish */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Completed</span>
              <span className="font-mono tabular-nums font-medium text-slate-800">
                {metrics.evaluatedCount + metrics.skippedCount} of{' '}
                {metrics.totalQuestions}
              </span>
            </div>
            <button
              type="button"
              onClick={onFinishSession}
              disabled={metrics.evaluatedCount + metrics.skippedCount === 0}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
            >
              View Evaluation & Study Plan
            </button>
          </div>
        </aside>

        {/* Main Stage: Question Prompt, Written Answer, Rubric Feedback */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8">
          {/* Question Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                Question {String(currentQuestion.index).padStart(2, '0')} of{' '}
                {String(session.questions.length).padStart(2, '0')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-blue-700">
                {currentQuestion.domain}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentQuestion.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                ~{currentQuestion.estimatedMinutes} min
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              {currentQuestion.title}
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <span className="font-semibold text-slate-800">Scenario: </span>
              {currentQuestion.scenarioContext}
            </p>

            <p className="text-base text-slate-900 leading-relaxed font-medium">
              {currentQuestion.prompt}
            </p>

            {/* Hint Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowHint((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950"
              >
                {showHint ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>{showHint ? 'Hide interviewer hint' : 'Need a nudge? Show hint'}</span>
              </button>
              {showHint && (
                <p className="mt-2 text-sm text-slate-600 pl-5">
                  {currentQuestion.hint}
                </p>
              )}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Written Answer Area */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="written-answer-editor"
                className="text-sm font-semibold text-slate-900"
              >
                Your Written Response
              </label>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setMonoEditor((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                    monoEditor ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{monoEditor ? 'Monospace On' : 'Monospace Off'}</span>
                </button>
                <span className="font-mono tabular-nums">{wordCount} words</span>
              </div>
            </div>

            <textarea
              id="written-answer-editor"
              rows={9}
              value={answerText}
              onChange={(e) => onDraftChange(currentQuestion.id, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your technical answer with concrete mechanisms, code or SQL examples, complexity, and production tradeoffs. Press Cmd/Ctrl + Enter to submit."
              className={`w-full p-4 text-sm text-slate-900 leading-relaxed bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-y ${
                monoEditor ? 'font-mono text-[13px]' : ''
              }`}
            />

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
              >
                {errorMessage}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isEvaluating || answerText.trim().length < 15}
                  onClick={() => onSubmitAnswer(currentQuestion, answerText)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isEvaluating
                      ? 'Evaluating against rubric...'
                      : evaluation
                      ? 'Re-Evaluate Answer'
                      : 'Submit & Evaluate Answer'}
                  </span>
                </button>

                {!evaluation && (
                  <button
                    type="button"
                    disabled={isEvaluating}
                    onClick={() => onSkipQuestion(currentQuestion.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Skip</span>
                  </button>
                )}
              </div>

              {nextQuestion && (
                <button
                  type="button"
                  onClick={() => onSelectQuestion(nextQuestion.id)}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
                >
                  Next: Q{String(nextQuestion.index).padStart(2, '0')} →
                </button>
              )}
            </div>
          </div>

          {/* Rubric Evaluation Section */}
          {evaluation && (
            <>
              <hr className="border-slate-200" />

              <section className="space-y-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Rubric Evaluation
                    </h2>
                    <p className="text-sm text-slate-600">
                      Calibrated for {session.skillLevel} hiring bar
                    </p>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold font-mono tabular-nums text-slate-950">
                      {Math.max(
                        0,
                        Math.min(
                          100,
                          evaluation.overallScore + (followUp?.scoreDelta ?? 0)
                        )
                      )}
                      <span className="text-base font-normal text-slate-400">
                        /100
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        getVerdictStyle(evaluation.verdict).textClass
                      }`}
                    >
                      {getVerdictStyle(evaluation.verdict).symbol}{' '}
                      {evaluation.verdict}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-800 leading-relaxed">
                  {evaluation.summaryFeedback}
                </p>

                {/* 4-Axis Rubric Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  {RUBRIC_LABELS.map(({ key, label }) => {
                    const score = evaluation.rubric[key];
                    const pct = Math.round((score / 5) * 100);
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {label}
                          </span>
                          <span className="font-mono tabular-nums text-slate-900 font-medium">
                            {score}/5
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score >= 4
                                ? 'bg-emerald-600'
                                : score === 3
                                ? 'bg-amber-500'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-emerald-800">
                      What Worked
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-700 list-disc pl-4">
                      {evaluation.strengths.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-red-800">
                      Gaps & Likely Mistakes
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-700 list-disc pl-4">
                      {evaluation.gapsAndMistakes.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Missed Concepts (Unboxed inline metadata) */}
                {evaluation.missedConcepts.length > 0 && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="font-semibold text-slate-800">
                      Concepts to reinforce:{' '}
                    </span>
                    {evaluation.missedConcepts.join(' · ')}
                  </div>
                )}

                {/* Collapsible Senior Model Answer Outline */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowModelOutline((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    {showModelOutline ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span>
                      {showModelOutline
                        ? 'Hide Reference Senior Answer Outline'
                        : 'Show Reference Senior Answer Outline'}
                    </span>
                  </button>
                  {showModelOutline && (
                    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                      {evaluation.modelAnswerOutline}
                    </div>
                  )}
                </div>

                {/* Interactive Follow-Up Probe */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      Interviewer Follow-Up Probe
                    </h3>
                    <p className="text-sm text-slate-800 leading-relaxed">
                      {evaluation.followUpQuestion}
                    </p>
                  </div>

                  {followUp ? (
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                      <p className="text-slate-700">
                        <span className="font-medium text-slate-900">
                          Your follow-up:{' '}
                        </span>
                        {followUp.answer}
                      </p>
                      <p className="text-slate-800">
                        <span className="font-medium text-slate-900">
                          Interviewer note (
                          <span className="font-mono tabular-nums">
                            {followUp.scoreDelta >= 0
                              ? `+${followUp.scoreDelta}`
                              : followUp.scoreDelta}{' '}
                            pts
                          </span>
                          ):{' '}
                        </span>
                        {followUp.feedback}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={followUpDraft}
                        onChange={(e) => setFollowUpDraft(e.target.value)}
                        placeholder="Answer the follow-up probe to recover points or verify depth..."
                        className="flex-1 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        disabled={
                          isEvaluatingFollowUp || followUpDraft.trim().length < 10
                        }
                        onClick={() =>
                          onSubmitFollowUp(currentQuestion, followUpDraft.trim())
                        }
                        className="px-4 py-2 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        {isEvaluatingFollowUp
                          ? 'Checking...'
                          : 'Submit Follow-Up'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
