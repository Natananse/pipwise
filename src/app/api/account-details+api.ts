import { accountDetailsApi } from '../../server/accountDetailsApi';

export function GET(request: Request) {
  return accountDetailsApi(request);
}

export function PUT(request: Request) {
  return accountDetailsApi(request);
}
