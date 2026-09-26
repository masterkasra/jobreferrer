// Vercel serverless entry: the same upload page + search as `npm run web`.
// vercel.json rewrites every path here.
import { handler } from '../src/web/server.js';

export default handler;
