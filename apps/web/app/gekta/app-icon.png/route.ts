import { gektaAppIcon } from '@/lib/gekta/app-icon';

export const dynamic = 'force-static';

export function GET() {
  return gektaAppIcon(512);
}
