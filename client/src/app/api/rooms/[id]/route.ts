import { api } from '@/server/api';
import { store } from '@/server/instance';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api.view(store, req, (await ctx.params).id);
}
