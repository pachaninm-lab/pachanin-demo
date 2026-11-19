import { GektaAboutPage, getGektaAboutMetadata } from '@/components/gekta/GektaAboutPage';

export const metadata = getGektaAboutMetadata('en');

export default function Page() {
  return <GektaAboutPage locale='en' />;
}
