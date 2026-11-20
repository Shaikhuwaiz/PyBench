import React, { useState } from 'react';
import { ArrowRight, Minus, Plus, Trash2, X } from 'lucide-react';
import { JD_PRESETS } from '../data/presets';
import { InteractivePythonHero } from './InteractivePythonHero';
import {
  ALL_DOMAINS,
  SKILL_LEVELS,
  type DomainAllocation,
  type DomainTrack,
  type InterviewSession,
  type SkillLevel,
} from '../types/interview';
import { computeSessionMetrics } from '../utils/sessionMetrics';

interface SetupViewProps {
  sessions: InterviewSession[];
  activeSessionId: string | null;
  showWelcome: boolean;
  onDismissWelcome: () => void;
  onReopenWelcome: () => void;
  isGenerating: boolean;
  errorMessage: string | null;
  onGenerateSession: (config: {
    roleTitle: string;
    jobDescription: string;
    skillLevel: SkillLevel;
    domainAllocation: DomainAllocation;
  }) => Promise<void>;
  onOpenSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const DEFAULT_ALLOCATION: DomainAllocation = {
  'Python Internals': 1,
  'FastAPI & Backend': 1,
  'RAG & LLM Evaluation': 1,
  'SQL & Data Modeling': 1,
  'DSA & Problem Solving': 1,
};

export const SetupView: React.FC<SetupViewProps> = ({
  sessions,
  activeSessionId,
  showWelcome,
  onDismissWelcome,
  onReopenWelcome,
  isGenerating,
  errorMessage,
  onGenerateSession,
  onOpenSession,
  onDeleteSession,
}) => {
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('Mid-Level');
  const [allocation, setAllocation] = useState<DomainAllocation>({
    ...DEFAULT_ALLOCATION,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const totalQuestions = Object.values(allocation).reduce((a, b) => a + b, 0);
  const estimatedMinutes = totalQuestions * 7;

  const handleApplyPreset = (presetId: string) => {
    const preset = JD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setRoleTitle(preset.roleTitle);
    setJobDescription(preset.jobDescription);
    setSkillLevel(preset.suggestedLevel);
    setAllocation({ ...preset.defaultAllocation });
  };

  const handleAdjustDomain = (domain: DomainTrack, delta: number) => {
    setAllocation((prev) => {
      const nextVal = Math.max(0, Math.min(4, prev[domain] + delta));
      const nextTotal = totalQuestions - prev[domain] + nextVal;
      if (nextTotal > 10) return prev;
      return { ...prev, [domain]: nextVal };
    });
  };

  const handleResetBalanced = () => {
    setAllocation({ ...DEFAULT_ALLOCATION });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQuestions < 1 || jobDescription.trim().length < 30 || isGenerating) {
      return;
    }
    await onGenerateSession({
      roleTitle: roleTitle.trim() || 'Python / AI-ML Engineer',
      jobDescription: jobDescription.trim(),
      skillLevel,
      domainAllocation: allocation,
    });
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-10 space-y-10">
      {/* Opening Split Hero: Editorial Headline + Genuine Interactive Python Specimen */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <p className="text-sm font-medium text-blue-700">
            Python & AI/ML Technical Interview Calibration
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 leading-tight">
            Turn any target job description into a calibrated mock interview and study plan.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Configure your role requirements, target seniority bar, and five-track question allocation below to launch a timed written session graded against a senior engineering rubric.
          </p>
          {!showWelcome && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onReopenWelcome}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
              >
                Show quick-start guide
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <InteractivePythonHero />
        </div>
      </section>

      {/* First-Time Welcome Guide */}
      {showWelcome && (
        <section
          aria-label="Welcome guide"
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <p className="text-xs font-semibold text-blue-700">
                Welcome to PyBench
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Systematic technical interview prep tailored to your target role
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                PyBench turns any Python or AI/ML job description into a structured written mock interview, grades your answers like a hiring bar-raiser, and converts your missed concepts into a focused 7-day study plan.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissWelcome}
              aria-label="Dismiss welcome guide"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-950">
                01. Role-Specific Questions
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generates production-grounded prompts across Python Internals, FastAPI, RAG & LLM Evaluation, SQL, and DSA calibrated to your skill level.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-950">
                02. Four-Axis Rubric Feedback
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Grades written answers on accuracy, internals depth, production tradeoffs, and clarity—with a senior reference outline and live follow-up probe.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-950">
                03. Weak-Area Study Plan
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ranks your highest-risk gaps into concrete engineering drills and a 7-day schedule you can check off and export to Markdown.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-950">Where to start: </span>
              Paste your target job description below (or click a role template), choose your seniority bar, and click{' '}
              <span className="font-semibold text-slate-950">
                Generate Mock Interview
              </span>
              .
            </p>
            <button
              type="button"
              onClick={onDismissWelcome}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Got it
            </button>
          </div>
        </section>
      )}

      {/* Main 2-Column Configuration Workbench */}
      <form
        id="setup-workbench"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
      >
        {/* Left Column: Job Description Input & Role Templates */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">
                01. Target Role & Job Description
              </h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {jobDescription.trim().length} chars
              </span>
            </div>

            {/* Role Templates */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500">
                Optional role templates (or paste your own job posting below)
              </span>
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                {JD_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="role-title-input"
                className="block text-sm font-medium text-slate-800"
              >
                Target Role Title
              </label>
              <input
                id="role-title-input"
                type="text"
                value={roleTitle}
                onChange={(e) => {
                  setRoleTitle(e.target.value);
                  setSelectedPresetId('');
                }}
                placeholder="Enter the role title you are preparing for"
                className="w-full px-3.5 py-2.5 text-sm text-slate-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Job Description Textarea */}
            <div className="space-y-1.5">
              <label
                htmlFor="jd-textarea"
                className="block text-sm font-medium text-slate-800"
              >
                Job Description
              </label>
              <textarea
                id="jd-textarea"
                rows={13}
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setSelectedPresetId('');
                }}
                placeholder="Paste the responsibilities, technical stack, and qualifications from the target job posting (minimum 30 characters)"
                className="w-full px-3.5 py-3 text-sm text-slate-900 leading-relaxed bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-y"
              />
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
        </div>

        {/* Right Column: Calibration Controls */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-950">
              02. Interview Calibration
            </h2>

            {/* Skill Level Segmented Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">
                  Target Skill Level
                </span>
                <span className="text-xs text-slate-500">
                  Sets rubric bar & question depth
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                {SKILL_LEVELS.map((level) => {
                  const active = skillLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSkillLevel(level)}
                      className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* 5-Track Question Mix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">
                  5-Track Question Allocation
                </span>
                <button
                  type="button"
                  onClick={handleResetBalanced}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  Reset 1 per track
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {ALL_DOMAINS.map((domain) => {
                  const count = allocation[domain];
                  return (
                    <div
                      key={domain}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <span className="text-sm text-slate-700">{domain}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          aria-label={`Decrease ${domain} questions`}
                          disabled={count === 0}
                          onClick={() => handleAdjustDomain(domain, -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-mono font-medium tabular-nums text-slate-950">
                          {count}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${domain} questions`}
                          disabled={count >= 4 || totalQuestions >= 10}
                          onClick={() => handleAdjustDomain(domain, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
                <span>Session length (max 10 questions)</span>
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {totalQuestions} questions · ~{estimatedMinutes} min
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="submit"
              disabled={
                isGenerating ||
                totalQuestions < 1 ||
                jobDescription.trim().length < 30
              }
              className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isGenerating ? (
                <span>Generating tailored questions...</span>
              ) : (
                <>
                  <span>Generate Mock Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {jobDescription.trim().length < 30 && (
              <p className="text-xs text-slate-500 text-center">
                Paste a job description or pick a role template to enable session generation.
              </p>
            )}
          </div>
        </div>
      </form>

      {/* Saved Sessions History Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">
            Session History
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {sessions.length} saved {sessions.length === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No mock interview sessions yet.
            </p>
            <p className="text-sm text-slate-500">
              Your completed mock interviews, rubric scores, and study plans will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Target Role</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4 text-right">Progress</th>
                  <th className="py-3 px-4 text-right">Avg Score</th>
                  <th className="py-3 px-4">Weakest Track</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sessions.map((session, idx) => {
                  if (!session || typeof session !== 'object') return null;
                  const metrics = computeSessionMetrics(session);
                  const isCurrent = session.id === activeSessionId;
                  const parsedDate = session.createdAt
                    ? new Date(session.createdAt)
                    : null;
                  const dateLabel =
                    parsedDate && !Number.isNaN(parsedDate.getTime())
                      ? parsedDate.toLocaleDateString()
                      : 'Saved session';
                  return (
                    <tr
                      key={session.id || `session-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-950">
                          {session.roleTitle || 'Python / AI-ML Engineer'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {dateLabel}
                          {isCurrent ? ' · Active' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {session.skillLevel || 'Mid-Level'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {metrics.evaluatedCount + metrics.skippedCount}/
                        {metrics.totalQuestions}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-950 whitespace-nowrap">
                        {metrics.overallScore !== null
                          ? `${metrics.overallScore}/100`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {metrics.weakestDomain
                          ? `${metrics.weakestDomain.domain} (${metrics.weakestDomain.averageScore})`
                          : 'Pending'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenSession(session.id)}
                            className="text-sm font-medium text-blue-700 hover:text-blue-900"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete session ${session.roleTitle}`}
                            onClick={() => onDeleteSession(session.id)}
                            className="p-1.5 text-slate-400 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
