import type { DomainAllocation, SkillLevel } from '../types/interview';

export interface JDPreset {
  id: string;
  label: string;
  roleTitle: string;
  suggestedLevel: SkillLevel;
  defaultAllocation: DomainAllocation;
  jobDescription: string;
}

export const JD_PRESETS: JDPreset[] = [
  {
    id: 'senior-ai-ml-rag',
    label: 'Senior AI/ML Engineer (RAG & Eval)',
    roleTitle: 'Senior AI/ML Engineer — Applied LLM & RAG Systems',
    suggestedLevel: 'Senior',
    defaultAllocation: {
      'Python Internals': 1,
      'FastAPI & Backend': 1,
      'RAG & LLM Evaluation': 2,
      'SQL & Data Modeling': 1,
      'DSA & Problem Solving': 1,
    },
    jobDescription: `We are hiring a Senior AI/ML Engineer to own our production retrieval-augmented generation (RAG) and LLM evaluation platform serving 40K+ daily enterprise analysts.

Core Responsibilities:
- Architect and optimize high-throughput Python services using FastAPI, Pydantic v2, and asyncio for streaming LLM inference and hybrid search orchestration.
- Design automated offline and online LLM evaluation harnesses measuring faithfulness, groundedness, citation precision, recall@k, and latency regressions before prompt or model rollouts.
- Optimize PostgreSQL + pgvector indexing, hybrid BM25 + dense vector retrieval, and cross-encoder reranking pipelines to keep p95 end-to-end latency under 1.8 seconds.
- Debug subtle Python concurrency, memory retention, and GIL/event-loop contention bottlenecks in long-running worker processes.
- Collaborate on ranking, deduplication, and graph/tree traversal algorithms for multi-hop document context assembly.

Requirements:
- 5+ years of production Python engineering with deep familiarity with CPython internals, asyncio, profiling, and typing.
- Hands-on experience shipping FastAPI microservices with structured observability, retries, and connection pooling.
- Proven track record building RAG evaluation pipelines (golden datasets, LLM-as-judge calibration, hallucination auditing).
- Strong SQL fluency (CTEs, window functions, query plan tuning, indexing strategies) and solid algorithmic problem-solving fundamentals.`,
  },
  {
    id: 'backend-python-fastapi',
    label: 'Staff Python & FastAPI Backend',
    roleTitle: 'Staff Python Backend Engineer — Core Platform',
    suggestedLevel: 'Staff',
    defaultAllocation: {
      'Python Internals': 2,
      'FastAPI & Backend': 2,
      'RAG & LLM Evaluation': 0,
      'SQL & Data Modeling': 1,
      'DSA & Problem Solving': 1,
    },
    jobDescription: `Join our Core Platform team as a Staff Python Engineer responsible for high-reliability financial data APIs and async ingestion pipelines.

What You Will Do:
- Lead architecture for multi-tenant FastAPI services processing 8,000+ requests/sec with strict tail latency SLOs (p99 < 120ms).
- Drive deep CPython performance engineering: memory layout, descriptor/metaclass ergonomics, multiprocessing vs asyncio tradeoffs, and zero-copy serialization.
- Design PostgreSQL schemas, partitioning strategies, and lock-safe migrations for ledger and audit tables exceeding 2B rows.
- Mentor engineers on idiomatic Python, clean concurrency boundaries, idempotent webhook processing, and algorithmic efficiency in data pipelines.

Qualifications:
- 7+ years building large-scale Python backends (FastAPI, Starlette, SQLAlchemy 2.0 async, uvicorn/gunicorn).
- Mastery of PostgreSQL internals (MVCC, B-Tree/GIN/BRIN indexes, isolation levels, EXPLAIN ANALYZE diagnostics).
- Strong grasp of data structures and algorithms for rate limiting, scheduling, and streaming aggregations.`,
  },
  {
    id: 'mid-ml-systems',
    label: 'Mid-Level ML Systems Engineer',
    roleTitle: 'ML Systems Engineer — Search & Inference',
    suggestedLevel: 'Mid-Level',
    defaultAllocation: {
      'Python Internals': 1,
      'FastAPI & Backend': 1,
      'RAG & LLM Evaluation': 1,
      'SQL & Data Modeling': 1,
      'DSA & Problem Solving': 1,
    },
    jobDescription: `We are looking for a Mid-Level ML Systems Engineer to bridge applied modeling and reliable production Python APIs for our semantic document search product.

Responsibilities:
- Build and maintain FastAPI endpoints for embedding generation, batch document ingestion, and real-time semantic search.
- Write clean, well-tested Python modules using dataclasses, generators, context managers, and async HTTP clients.
- Implement evaluation scripts comparing chunking strategies, embedding models, and retrieval metrics (MRR, NDCG, Recall@10).
- Author analytical SQL queries over user clickstream and feedback logs to identify retrieval failure slices and build training datasets.
- Solve practical algorithmic tasks around text chunking, sliding windows, top-k merging, and caching.`,
  },
];
