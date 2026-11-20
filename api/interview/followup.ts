import type { IncomingMessage, ServerResponse } from 'http';
import { handleEvaluateFollowUp } from '../_handlers.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleEvaluateFollowUp(req, res);
}
