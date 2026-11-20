import type { IncomingMessage, ServerResponse } from 'http';
import { handleGenerateInterview } from '../_handlers.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleGenerateInterview(req, res);
}
