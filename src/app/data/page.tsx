
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { query, collection, orderBy } from 'firebase/firestore';
import type { User as CustomUser } from '@/types/firebase';
import { Loader2, User, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImportHistory from '@/components/import-history';
import AllItemsViewer from '@/components/all-items-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DataPage() {
  const firestore = useFirestore();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [viewingUser, setViewingUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const isAdmin = currentUser?.role === 'ADMIN';

  const usersRef = useMemoFirebase(() => 
    isAdmin ? query(collection(firestore, 'users'), orderBy('fullName', 'asc')) : null, 
    [isAdmin, firestore]
  );
  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<CustomUser>(usersRef);


  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const user = JSON.parse(storedUser) as CustomUser;
        setCurrentUser(user);
        setViewingUser(user);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error("Error processing user from localStorage", error);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleUserChange = (userId: string) => {
    if (!allUsers) return;
    const selected = allUsers.find(u => u.id === userId);
    if (selected) {
      setViewingUser(selected);
    }
  };
  
  const showLoadingScreen = isLoading || (isAdmin && isLoadingUsers) || !viewingUser;

  if (showLoadingScreen) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang tải trang dữ liệu...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 pt-12 sm:p-8 md:pt-12">
      <div className="w-full max-w-screen-2xl">
        {isAdmin && allUsers && (
          <Card className="mb-6 bg-muted/40">
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Users className="h-6 w-6" />
                            Chế độ xem của Quản trị viên
                        </CardTitle>
                        <CardDescription>
                            Bạn có thể chọn một người dùng để xem lịch sử nhập hàng của họ.
                        </CardDescription>
                    </div>
                    <div className="w-full sm:w-72">
                         <Select onValueChange={handleUserChange} defaultValue={viewingUser.id}>
                            <SelectTrigger>
                                <SelectValue placeholder="Chọn người dùng để xem..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allUsers.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span>{user.fullName} ({user.username})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
          </Card>
        )}
         <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="history">Lịch sử nhập hàng</TabsTrigger>
            <TabsTrigger value="items">Tất cả mặt hàng</TabsTrigger>
          </TabsList>
          <TabsContent value="history">
            <ImportHistory currentUser={viewingUser} />
          </TabsContent>
          <TabsContent value="items">
            <AllItemsViewer currentUser={viewingUser} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
