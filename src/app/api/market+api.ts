import { marketApi } from '../../server/marketApi';

export function GET(request: Request) {
  return marketApi(request);
}
