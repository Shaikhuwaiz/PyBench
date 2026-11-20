import {
  ALL_DOMAINS,
  TARGET_BENCHMARK_BY_LEVEL,
  type DomainTrack,
  type EvaluationVerdict,
  type InterviewSession,
  type WeakAreaSeverity,
} from '../types/interview';

export interface DomainPerformance {
  domain: DomainTrack;
  questionCount: number;
  evaluatedCount: number;
  averageScore: number | null;
  targetBenchmark: number;
}

export interface SessionSummaryMetrics {
  overallScore: number | null;
  evaluatedCount: number;
  skippedCount: number;
  totalQuestions: number;
  domainBreakdown: DomainPerformance[];
  strongestDomain: DomainPerformance | null;
  weakestDomain: DomainPerformance | null;
  targetBenchmark: number;
}

export function computeSessionMetrics(session: InterviewSession): SessionSummaryMetrics {
  const targetBenchmark = TARGET_BENCHMARK_BY_LEVEL[session.skillLevel];
  let scoreSum = 0;
  let evaluatedCount = 0;
  let skippedCount = 0;

  const domainMap = new Map<
    DomainTrack,
    { questionCount: number; scores: number[] }
  >();
  for (const d of ALL_DOMAINS) {
    domainMap.set(d, { questionCount: 0, scores: [] });
  }

  for (const q of session.questions) {
    const entry = domainMap.get(q.domain) || { questionCount: 0, scores: [] };
    entry.questionCount += 1;
    const attempt = session.attempts[q.id];
    if (attempt?.evaluation) {
      const bonus = attempt.followUp?.scoreDelta ?? 0;
      const effectiveScore = Math.max(
        0,
        Math.min(100, attempt.evaluation.overallScore + bonus)
      );
      entry.scores.push(effectiveScore);
      scoreSum += effectiveScore;
      evaluatedCount += 1;
    } else if (attempt?.skipped) {
      skippedCount += 1;
      entry.scores.push(0);
    }
    domainMap.set(q.domain, entry);
  }

  const domainBreakdown: DomainPerformance[] = ALL_DOMAINS.map((domain) => {
    const entry = domainMap.get(domain)!;
    const avg =
      entry.scores.length > 0
        ? Math.round(
            entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length
          )
        : null;
    return {
      domain,
      questionCount: entry.questionCount,
      evaluatedCount: entry.scores.length,
      averageScore: avg,
      targetBenchmark,
    };
  });

  const scoredDomains = domainBreakdown.filter(
    (d) => d.averageScore !== null
  );
  const sortedAsc = [...scoredDomains].sort(
    (a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0)
  );

  const denominator = evaluatedCount + skippedCount;
  const overallScore =
    denominator > 0 ? Math.round(scoreSum / denominator) : null;

  return {
    overallScore,
    evaluatedCount,
    skippedCount,
    totalQuestions: session.questions.length,
    domainBreakdown,
    strongestDomain:
      sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1] : null,
    weakestDomain: sortedAsc.length > 0 ? sortedAsc[0] : null,
    targetBenchmark,
  };
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getVerdictStyle(verdict: EvaluationVerdict): {
  textClass: string;
  symbol: string;
} {
  switch (verdict) {
    case 'Strong Hire':
      return { textClass: 'text-emerald-700', symbol: '▲' };
    case 'Hire':
      return { textClass: 'text-blue-700', symbol: '●' };
    case 'Borderline':
      return { textClass: 'text-amber-700', symbol: '◆' };
    case 'Needs Work':
      return { textClass: 'text-red-700', symbol: '▼' };
  }
}

export function getSeverityStyle(severity: WeakAreaSeverity): {
  textClass: string;
  label: string;
} {
  switch (severity) {
    case 'Critical':
      return { textClass: 'text-red-700', label: 'Critical Priority' };
    case 'Moderate':
      return { textClass: 'text-amber-700', label: 'Moderate Priority' };
    case 'Polish':
      return { textClass: 'text-slate-600', label: 'Polish' };
  }
}

export function buildStudyPlanMarkdown(session: InterviewSession): string {
  const metrics = computeSessionMetrics(session);
  const lines: string[] = [
    `# PyBench Interview Report & Study Plan`,
    ``,
    `- **Target Role:** ${session.roleTitle}`,
    `- **Skill Level:** ${session.skillLevel}`,
    `- **Overall Score:** ${metrics.overallScore !== null ? `${metrics.overallScore}/100` : 'Incomplete'} (Target bar: ${metrics.targetBenchmark}/100)`,
    `- **Generated:** ${new Date().toLocaleDateString()}`,
    ``,
    `## 1. Domain Breakdown`,
    ``,
    `| Domain Track | Score | Target Bar | Questions |`,
    `| :--- | ---: | ---: | ---: |`,
  ];

  for (const d of metrics.domainBreakdown) {
    if (d.questionCount > 0) {
      lines.push(
        `| ${d.domain} | ${d.averageScore !== null ? `${d.averageScore}/100` : '—'} | ${d.targetBenchmark}/100 | ${d.questionCount} |`
      );
    }
  }

  if (session.studyPlan) {
    const plan = session.studyPlan;
    lines.push(
      ``,
      `## 2. Readiness Assessment`,
      ``,
      plan.readinessSummary,
      ``,
      `Estimated focused prep time: **${plan.estimatedPrepHours} hours**`,
      ``,
      `## 3. Priority Weak Areas & Drills`,
      ``
    );

    for (const area of plan.priorityWeakAreas) {
      lines.push(
        `### ${area.topic} (${area.domain} — ${area.severity})`,
        ``,
        `- **Diagnosis:** ${area.diagnosis}`,
        `- **Target Outcome:** ${area.targetOutcome}`,
        ``
      );
      for (const drill of area.drills) {
        const checked = session.completedDrillIds.includes(drill.id) ? 'x' : ' ';
        lines.push(
          `- [${checked}] **${drill.title}** (${drill.estimatedHours}h): ${drill.description} *Deliverable: ${drill.deliverable}*`
        );
      }
      lines.push(``);
    }

    lines.push(`## 4. 7-Day Study Schedule`, ``);
    for (const day of plan.weeklySchedule) {
      lines.push(
        `- **${day.dayLabel} (${day.focusDomain} · ${day.durationMinutes} min):** ${day.objective}`,
        `  - Practice: ${day.practiceTask}`,
        `  - Checkpoint: ${day.verificationCheckpoint}`
      );
    }

    lines.push(``, `## 5. Recurring Mistakes to Eliminate`, ``);
    for (const mistake of plan.commonMistakesToEliminate) {
      lines.push(`- ${mistake}`);
    }
  }

  return lines.join('\n');
}
