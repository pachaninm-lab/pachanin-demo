import { gektaAppIcon } from '@/lib/gekta/app-icon';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return gektaAppIcon(size.width);
}
