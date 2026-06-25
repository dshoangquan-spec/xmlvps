
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminPanel from '@/components/admin-panel';
import { Loader2 } from 'lucide-react';
import type { User as CustomUser } from '@/types/firebase';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'authorized'>('loading');

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const user = JSON.parse(storedUser) as CustomUser;
        setCurrentUser(user);
        if (user.role === 'ADMIN') {
          setStatus('authorized');
        } else {
          setStatus('unauthorized');
          router.push('/');
        }
      } else {
        setStatus('unauthorized');
        router.push('/');
      }
    } catch (error) {
      console.error("Error processing user from localStorage", error);
      setStatus('unauthorized');
      router.push('/');
    }
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  if (status === 'authorized' && currentUser) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 pt-12 sm:p-8 md:pt-12">
        <div className="w-full max-w-7xl">
          <AdminPanel currentUser={currentUser} />
        </div>
      </main>
    );
  }

  // For 'unauthorized', redirect is handled in useEffect.
  // Render nothing to avoid content flashing.
  return null;
}
