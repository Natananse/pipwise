import { accountDeletionApi } from '../../server/accountDeletionApi';

export function POST(request: Request) {
  return accountDeletionApi(request);
}

export function OPTIONS(request: Request) {
  return accountDeletionApi(request);
}
