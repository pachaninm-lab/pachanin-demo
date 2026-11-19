import { GektaAboutPage, getGektaAboutMetadata } from '@/components/gekta/GektaAboutPage';

export const metadata = getGektaAboutMetadata('zh');

export default function Page() {
  return <GektaAboutPage locale='zh' />;
}
