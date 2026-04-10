import MainLayout from '@/components/MainLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  return <MainLayout>{children}</MainLayout>
}
