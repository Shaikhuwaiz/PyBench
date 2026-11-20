import type { IncomingMessage, ServerResponse } from 'http';
import { handleGenerateStudyPlan } from '../_handlers.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleGenerateStudyPlan(req, res);
}
