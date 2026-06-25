
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { User as CustomUser } from '@/types/firebase';
import { query, collection, orderBy } from 'firebase/firestore';
import { Loader2, User, Users, Globe } from 'lucide-react';
import Dashboard from '@/components/dashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const ALL_USERS_ID = 'all_users_view';
const allUsersViewObject: CustomUser = {
  id: ALL_USERS_ID,
  fullName: 'Tất cả người dùng',
  username: 'all_users',
  role: 'ADMIN', 
};


export default function DashboardPage() {
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
        // Admin defaults to "All Users" view, regular user to their own view.
        setViewingUser(user.role === 'ADMIN' ? allUsersViewObject : user);
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
    if (userId === ALL_USERS_ID) {
      setViewingUser(allUsersViewObject);
      return;
    }
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
        <p className="mt-4 text-muted-foreground">Đang tải dashboard...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 pt-12 sm:p-6 md:p-8">
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
                            Bạn có thể chọn xem tổng hợp hoặc xem chi tiết cho từng người dùng.
                        </CardDescription>
                    </div>
                    <div className="w-full sm:w-72">
                         <Select onValueChange={handleUserChange} defaultValue={viewingUser.id}>
                            <SelectTrigger>
                                <SelectValue placeholder="Chọn chế độ xem..." />
                            </SelectTrigger>
                            <SelectContent>
                                 <SelectItem value={ALL_USERS_ID}>
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                        <span>Xem tổng hợp (Tất cả)</span>
                                    </div>
                                </SelectItem>
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
        <Dashboard currentUser={viewingUser} />
      </div>
    </main>
  );
}
