import { api } from '@/server/api';
import { store } from '@/server/instance';

export const POST = (req: Request) => api.create(store, req);
