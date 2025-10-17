import SettingsLayout from '../settings/layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
