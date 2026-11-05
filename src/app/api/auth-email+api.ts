import { createAuthEmailProxy } from '../../server/authEmailProxy';

export function POST(request: Request) {
  return createAuthEmailProxy()(request);
}
