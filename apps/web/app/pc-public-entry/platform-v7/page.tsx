import './home-approved-contact-dock.css';
import PlatformV7RootPage, { metadata } from '@/app/platform-v7/page';

export { metadata };

export default function PublicEntryPlatformV7Page() {
  return (
    <div data-contact-dock-visual='approved'>
      <PlatformV7RootPage />
    </div>
  );
}
