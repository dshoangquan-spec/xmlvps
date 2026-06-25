
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TaxReportManager from '@/components/tax-report-manager';
import { Loader2 } from 'lucide-react';
import type { User as CustomUser } from '@/types/firebase';

export default function TaxReportPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
     try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error("Could not parse user from localStorage", error);
      router.push('/');
    }
    setIsLoading(false);
  }, [router]);


  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang tải trang Báo cáo thuế...</p>
      </div>
    );
  }
  
  return (
    <main className="flex min-h-screen w-full flex-col bg-background p-4 pt-12 sm:p-8 md:pt-12">
      <div className="w-full">
        <TaxReportManager currentUser={currentUser} />
      </div>
    </main>
  );
}
