
'use client';

import { useState, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { User as CustomUser } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, RefreshCw, Trash2, Home, KeyRound } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VersionManager from './version-manager';


interface AdminPanelProps {
  currentUser: CustomUser;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // State for creating new user
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // State for changing admin's password
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Fetch users for the list
  const usersRef = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<CustomUser>(usersRef);

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword || !newFullName) {
      toast({
        variant: 'destructive',
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ và tên.',
      });
      return;
    }
    setIsCreatingUser(true);
    
    // Firestore will auto-generate an ID, we'll use that as the user's ID.
    const newUserPayload = {
      username: newUsername,
      password: newPassword, // Note: Storing passwords in plaintext is insecure.
      fullName: newFullName,
      role: 'USER',
      createdAt: new Date().toISOString(),
      id: '' // This will be updated post-creation
    };
    
    try {
        const docRef = await addDoc(collection(firestore, 'users'), newUserPayload);
        // Update the document with its own ID.
        await updateDoc(docRef, { id: docRef.id });

        toast({
            title: 'Tạo người dùng thành công',
            description: `Đã tạo tài khoản cho ${newFullName}.`,
        });
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: 'users',
            operation: 'create',
            requestResourceData: newUserPayload
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsCreatingUser(false);
    }
  };
  
  const handleChangeAdminPassword = async () => {
    if (!adminNewPassword || !adminConfirmPassword) {
      toast({ variant: "destructive", title: "Vui lòng nhập mật khẩu" });
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      toast({ variant: "destructive", title: "Mật khẩu không khớp" });
      return;
    }
    setIsUpdatingPassword(true);
    const userDocRef = doc(firestore, 'users', currentUser.id);
    const passwordPayload = { password: adminNewPassword };

    updateDoc(userDocRef, passwordPayload).then(() => {
        toast({ title: "Cập nhật mật khẩu thành công" });
        setAdminNewPassword('');
        setAdminConfirmPassword('');
    }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: passwordPayload
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsUpdatingPassword(false);
    });
  };
  
  const handleDeleteUser = async (userId: string) => {
    const userDocRef = doc(firestore, 'users', userId);
    deleteDoc(userDocRef).then(() => {
        toast({
            title: "Xóa người dùng thành công",
            description: "Đã xóa tài khoản người dùng khỏi hệ thống."
        });
    }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight text-primary">
                Quản trị hệ thống (Admin)
            </h1>
            <div className='flex items-center gap-2'>
                <Link href="/" passHref>
                    <Button variant="outline"><Home className="mr-2 h-4 w-4" /> Về trang chính</Button>
                </Link>
            </div>
        </div>
      
      <VersionManager />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Cấp tài khoản mới</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Tên đăng nhập</Label>
              <Input id="new-username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="VD: nhanvien1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Mật khẩu</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-fullname">Họ và tên hiển thị</Label>
              <Input id="new-fullname" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="VD: Nguyễn Văn A" />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateUser} disabled={isCreatingUser} className="w-full">
              {isCreatingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Tạo tài khoản
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Danh sách tài khoản</CardTitle>
             <CardDescription>
                Hiện có {users?.length ?? 0} tài khoản trong hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                        <TableRow>
                            <TableHead>Họ và tên</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Vai trò</TableHead>
                             <TableHead>Ngày tạo</TableHead>
                             <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingUsers ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : users && users.length > 0 ? (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.fullName}</TableCell>
                                    <TableCell className="text-muted-foreground">@{user.username}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                                    </TableCell>
                                     <TableCell>
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                                    </TableCell>
                                     <TableCell className="text-right">
                                        {user.id !== currentUser.id && (
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Hành động này sẽ xóa vĩnh viễn tài khoản của 
                                                            <span className="font-bold"> {user.fullName} </span>.
                                                            Bạn không thể hoàn tác hành động này.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="bg-destructive hover:bg-destructive/90"
                                                        >
                                                            Xóa
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                   Chưa có tài khoản nào.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Đổi mật khẩu của bạn</CardTitle>
            <CardDescription>Thay đổi mật khẩu cho tài khoản quản trị viên của bạn.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-new-pw">Mật khẩu mới</Label>
              <Input id="admin-new-pw" type="password" value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirm-pw">Xác nhận mật khẩu mới</Label>
              <Input id="admin-confirm-pw" type="password" value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới"/>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleChangeAdminPassword} disabled={isUpdatingPassword} className="ml-auto">
                 {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Lưu mật khẩu
            </Button>
          </CardFooter>
        </Card>
    </div>
  );
}
