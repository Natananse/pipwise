import { feedbackApi } from '../../server/feedbackApi';

export function POST(request: Request) {
  return feedbackApi(request);
}
