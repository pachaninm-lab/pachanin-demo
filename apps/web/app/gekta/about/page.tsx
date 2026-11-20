import { GektaAboutPage, getGektaAboutMetadata } from '@/components/gekta/GektaAboutPage';

export const metadata = getGektaAboutMetadata('ru');

export default function Page() {
  return <GektaAboutPage locale='ru' />;
}
