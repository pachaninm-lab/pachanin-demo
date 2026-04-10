import PlatformShell from './PlatformShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
