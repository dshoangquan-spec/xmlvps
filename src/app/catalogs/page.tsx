
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User as CustomUser } from '@/types/firebase';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MasterCatalogManager from '@/components/master-catalog-manager';
import CommunityCatalogManager from '@/components/community-catalog-manager';

export default function CatalogsPage() {
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
        <p className="mt-4 text-muted-foreground">Đang tải trang danh mục...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 pt-12 sm:p-8 md:pt-12">
      <div className="w-full max-w-screen-2xl">
         <Tabs defaultValue="master" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="master">Danh mục sản phẩm dùng chung</TabsTrigger>
            <TabsTrigger value="community">Danh mục ánh xạ cộng đồng</TabsTrigger>
          </TabsList>
          <TabsContent value="master">
            <MasterCatalogManager />
          </TabsContent>
          <TabsContent value="community">
            {currentUser && <CommunityCatalogManager currentUser={currentUser} />}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
