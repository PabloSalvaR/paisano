import { api } from '@/server/api';
import { store } from '@/server/instance';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api.command(store, req, (await ctx.params).id);
}
