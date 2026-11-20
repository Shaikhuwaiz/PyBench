import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { InterviewSession } from '../types/interview';
import {
  computeSessionMetrics,
  formatDuration,
  getVerdictStyle,
} from '../utils/sessionMetrics';

interface EvaluationViewProps {
  session: InterviewSession;
  isGeneratingPlan: boolean;
  errorMessage: string | null;
  onGenerateStudyPlan: () => Promise<void>;
  onOpenStudyPlan: () => void;
  onJumpToQuestion: (questionId: string) => void;
}

export const EvaluationView: React.FC<EvaluationViewProps> = ({
  session,
  isGeneratingPlan,
  errorMessage,
  onGenerateStudyPlan,
  onOpenStudyPlan,
  onJumpToQuestion,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const metrics = computeSessionMetrics(session);
  const activeDomains = metrics.domainBreakdown.filter(
    (d) => d.questionCount > 0
  );

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-10">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500">
            {session.skillLevel} Bar · {formatDuration(session.elapsedSeconds)} elapsed
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Session Evaluation
          </h1>
          <p className="text-sm text-slate-600">{session.roleTitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {session.studyPlan ? (
            <>
              <button
                type="button"
                disabled={isGeneratingPlan}
                onClick={onGenerateStudyPlan}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-950 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {isGeneratingPlan ? 'Refreshing...' : 'Regenerate Study Plan'}
              </button>
              <button
                type="button"
                onClick={onOpenStudyPlan}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Open Study Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={
                isGeneratingPlan ||
                metrics.evaluatedCount + metrics.skippedCount === 0
              }
              onClick={onGenerateStudyPlan}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
            >
              <span>
                {isGeneratingPlan
                  ? 'Synthesizing Weak-Area Study Plan...'
                  : 'Generate Weak-Area Study Plan'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
        >
          {errorMessage}
        </div>
      )}

      {/* 4-Column KPI Summary Strip (Flat hairline dividers, no nested card clutter) */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Overall Score</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-950">
            {metrics.overallScore !== null ? `${metrics.overallScore}/100` : '—'}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Target {session.skillLevel} bar: {metrics.targetBenchmark}/100
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Questions Completed
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-950">
            {metrics.evaluatedCount + metrics.skippedCount}/
            {metrics.totalQuestions}
          </div>
          <div className="text-xs text-slate-500">
            {metrics.evaluatedCount} evaluated · {metrics.skippedCount} skipped
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Strongest Track
          </div>
          <div className="text-lg font-semibold text-slate-950 truncate">
            {metrics.strongestDomain?.domain ?? 'Pending'}
          </div>
          <div className="text-xs font-mono tabular-nums text-emerald-700">
            {metrics.strongestDomain
              ? `${metrics.strongestDomain.averageScore}/100 average`
              : 'Submit answers to measure'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Priority Weak Track
          </div>
          <div className="text-lg font-semibold text-slate-950 truncate">
            {metrics.weakestDomain?.domain ?? 'Pending'}
          </div>
          <div className="text-xs font-mono tabular-nums text-red-700">
            {metrics.weakestDomain
              ? `${metrics.weakestDomain.averageScore}/100 average`
              : 'Submit answers to measure'}
          </div>
        </div>
      </section>

      {/* 5-Track Benchmark Chart & JD Signal Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              Track Performance vs. {session.skillLevel} Benchmark
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Target benchmark = {metrics.targetBenchmark}
            </span>
          </div>

          <div className="space-y-4">
            {activeDomains.map((d) => {
              const score = d.averageScore ?? 0;
              const meetsBar = d.averageScore !== null && score >= d.targetBenchmark;
              const barColor =
                d.averageScore === null
                  ? 'bg-slate-200'
                  : meetsBar
                  ? 'bg-emerald-600'
                  : score >= d.targetBenchmark - 12
                  ? 'bg-amber-500'
                  : 'bg-red-600';

              return (
                <div key={d.domain} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">
                      {d.domain}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-slate-700">
                      {d.averageScore !== null
                        ? `${d.averageScore}/100`
                        : 'Not evaluated'}{' '}
                      · {d.questionCount}Q
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70"
                      style={{ left: `${d.targetBenchmark}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Extracted JD Bar & Emphasis
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {session.jdAnalysis.interviewEmphasis}
          </p>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500">
              Seniority Signals Detected
            </h3>
            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
              {session.jdAnalysis.senioritySignals.map((sig, i) => (
                <li key={i}>{sig}</li>
              ))}
            </ul>
          </div>
          <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Core Stack: </span>
            {session.jdAnalysis.coreTechnologies.join(' · ')}
          </div>
        </section>
      </div>

      {/* Question-by-Question Audit Table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-950">
          Question-by-Question Rubric Audit
        </h2>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Question</th>
                <th className="py-3 px-4">Track</th>
                <th className="py-3 px-4 text-right">Score</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4 text-right">Acc / Depth / Prod / Clarity</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {session.questions.map((q) => {
                const attempt = session.attempts[q.id];
                const ev = attempt?.evaluation;
                const isExpanded = expandedId === q.id;
                const effectiveScore = ev
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        ev.overallScore + (attempt?.followUp?.scoreDelta ?? 0)
                      )
                    )
                  : null;

                return (
                  <React.Fragment key={q.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : q.id)
                          }
                          className="inline-flex items-center gap-2 text-left font-medium text-slate-950 hover:text-blue-700"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                          )}
                          <span>
                            {String(q.index).padStart(2, '0')}. {q.title}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {q.domain}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-950 whitespace-nowrap">
                        {effectiveScore !== null
                          ? `${effectiveScore}/100`
                          : attempt?.skipped
                          ? '0/100'
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ev ? (
                          <span
                            className={`text-xs font-semibold ${
                              getVerdictStyle(ev.verdict).textClass
                            }`}
                          >
                            {getVerdictStyle(ev.verdict).symbol} {ev.verdict}
                          </span>
                        ) : attempt?.skipped ? (
                          <span className="text-xs text-slate-400">Skipped</span>
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {ev
                          ? `${ev.rubric.technicalAccuracy} / ${ev.rubric.depthAndInternals} / ${ev.rubric.productionTradeoffs} / ${ev.rubric.clarityAndStructure}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onJumpToQuestion(q.id)}
                          className="text-sm font-medium text-blue-700 hover:text-blue-900"
                        >
                          {ev ? 'Review' : 'Answer'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-6 py-4 space-y-3 text-sm">
                          {ev ? (
                            <>
                              <p className="text-slate-800">
                                <span className="font-semibold">Feedback: </span>
                                {ev.summaryFeedback}
                              </p>
                              {ev.missedConcepts.length > 0 && (
                                <p className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    Missed concepts:{' '}
                                  </span>
                                  {ev.missedConcepts.join(' · ')}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-slate-500">
                              No rubric evaluation yet. Click Answer to complete this question.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
