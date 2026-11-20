import React from 'react';
import { Check, Download, RefreshCw } from 'lucide-react';
import type { InterviewSession } from '../types/interview';
import {
  buildStudyPlanMarkdown,
  computeSessionMetrics,
  getSeverityStyle,
} from '../utils/sessionMetrics';

interface StudyPlanViewProps {
  session: InterviewSession;
  isGeneratingPlan: boolean;
  errorMessage: string | null;
  onGenerateStudyPlan: () => Promise<void>;
  onToggleDrill: (drillId: string) => void;
  onStartNewSession: () => void;
}

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  session,
  isGeneratingPlan,
  errorMessage,
  onGenerateStudyPlan,
  onToggleDrill,
  onStartNewSession,
}) => {
  const plan = session.studyPlan;
  const metrics = computeSessionMetrics(session);

  const handleExportMarkdown = () => {
    const md = buildStudyPlanMarkdown(session);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = session.roleTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.download = `pybench-study-plan-${slug || 'session'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!plan) {
    return (
      <div className="max-w-[1360px] mx-auto px-6 py-16">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center space-y-5">
          <h1 className="text-2xl font-bold text-slate-950">
            No Weak-Area Study Plan Generated Yet
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Evaluate at least one mock interview question, then generate a prioritized study plan with hands-on drills and a 7-day preparation schedule tailored to your gaps.
          </p>
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg text-left"
            >
              {errorMessage}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={
                isGeneratingPlan ||
                metrics.evaluatedCount + metrics.skippedCount === 0
              }
              onClick={onGenerateStudyPlan}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
            >
              {isGeneratingPlan
                ? 'Synthesizing Study Plan...'
                : 'Generate Weak-Area Study Plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allDrills = plan.priorityWeakAreas.flatMap((wa) => wa.drills);
  const completedCount = allDrills.filter((d) =>
    session.completedDrillIds.includes(d.id)
  ).length;
  const completionPct =
    allDrills.length > 0
      ? Math.round((completedCount / allDrills.length) * 100)
      : 0;

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-10">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs text-slate-500">
            {session.skillLevel} Bar · Est.{' '}
            <span className="font-mono tabular-nums">
              {plan.estimatedPrepHours}h
            </span>{' '}
            focused prep
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Weak-Area Study Plan
          </h1>
          <p className="text-sm text-slate-600">{session.roleTitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isGeneratingPlan}
            onClick={onGenerateStudyPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-950 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isGeneratingPlan ? 'Updating...' : 'Refresh Plan'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export Markdown</span>
          </button>
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

      {/* Readiness Summary & Drill Progress */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-2">
          <h2 className="text-base font-semibold text-slate-950">
            Readiness Diagnosis
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            {plan.readinessSummary}
          </p>
        </div>

        <div className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-6 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">
              Hands-On Drills Completed
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-950">
              {completedCount}/{allDrills.length} ({completionPct}%)
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Check off each drill below as you complete its deliverable.
          </p>
        </div>
      </section>

      {/* Priority Weak Areas & Interactive Drills */}
      <section className="space-y-5">
        <h2 className="text-lg font-semibold text-slate-950">
          01. Priority Weak Areas & Hands-On Drills
        </h2>

        <div className="space-y-6">
          {plan.priorityWeakAreas.map((area, idx) => {
            const sev = getSeverityStyle(area.severity);
            return (
              <article
                key={area.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums text-slate-800 font-medium">
                        Priority 0{idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-blue-700">
                        {area.domain}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${sev.textClass}`}>
                        {sev.label}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      {area.topic}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500">
                      Observed Gap
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {area.diagnosis}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500">
                      Target Mastery Bar
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {area.targetOutcome}
                    </p>
                  </div>
                </div>

                <hr className="border-slate-200" />

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500">
                    Required Drills
                  </div>
                  <div className="divide-y divide-slate-100">
                    {area.drills.map((drill) => {
                      const checked = session.completedDrillIds.includes(
                        drill.id
                      );
                      return (
                        <label
                          key={drill.id}
                          className="py-3 flex items-start gap-3.5 cursor-pointer group"
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => onToggleDrill(drill.id)}
                            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked
                                ? 'bg-blue-700 border-blue-700 text-white'
                                : 'bg-white border-slate-300 group-hover:border-blue-600'
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span
                                className={`text-sm font-semibold ${
                                  checked
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-950'
                                }`}
                              >
                                {drill.title}
                              </span>
                              <span className="text-xs font-mono tabular-nums text-slate-500">
                                {drill.estimatedHours}h
                              </span>
                            </div>
                            <p
                              className={`text-sm leading-relaxed ${
                                checked ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {drill.description}
                            </p>
                            <p className="text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                Deliverable:{' '}
                              </span>
                              {drill.deliverable}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 7-Day Preparation Roadmap */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-950">
          02. 7-Day Structured Preparation Schedule
        </h2>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Day</th>
                <th className="py-3 px-4">Focus Track</th>
                <th className="py-3 px-4">Objective & Practice Task</th>
                <th className="py-3 px-4">Verification Checkpoint</th>
                <th className="py-3 px-5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {plan.weeklySchedule.map((day, idx) => (
                <tr key={idx} className="align-top hover:bg-slate-50/70">
                  <td className="py-4 px-5 font-mono tabular-nums font-semibold text-slate-950 whitespace-nowrap">
                    {day.dayLabel}
                  </td>
                  <td className="py-4 px-4 text-blue-700 font-medium whitespace-nowrap">
                    {day.focusDomain}
                  </td>
                  <td className="py-4 px-4 space-y-1 max-w-md">
                    <div className="font-medium text-slate-950">
                      {day.objective}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {day.practiceTask}
                    </p>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-700 leading-relaxed max-w-sm">
                    {day.verificationCheckpoint}
                  </td>
                  <td className="py-4 px-5 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                    {day.durationMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Common Mistakes to Eliminate + Retest CTA */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
        <div className="space-y-3 max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-950">
            03. Recurring Mistakes to Eliminate
          </h2>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-4">
            {plan.commonMistakesToEliminate.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 lg:pt-8">
          <button
            type="button"
            onClick={onStartNewSession}
            className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Start Targeted Re-Test
          </button>
        </div>
      </section>
    </div>
  );
};
