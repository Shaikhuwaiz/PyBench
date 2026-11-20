import type { IncomingMessage, ServerResponse } from 'http';
import { handleEvaluateAnswer } from '../_handlers.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleEvaluateAnswer(req, res);
}
