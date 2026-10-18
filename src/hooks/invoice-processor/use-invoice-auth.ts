'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where, type Firestore } from 'firebase/firestore';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { useToast } from '@/hooks/use-toast';
import type { User as CustomUser } from '@/types/firebase';

type Toast = ReturnType<typeof useToast>['toast'];

interface Credentials {
  username?: string;
  password?: string;
  newPassword?: string;
}

interface UseInvoiceAuthOptions {
  firestore: Firestore;
  toast: Toast;
  onLogout: () => void;
}

export function useInvoiceAuth({ firestore, toast, onLogout }: UseInvoiceAuthOptions) {
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Could not parse user from localStorage", error);
      localStorage.removeItem('currentUser');
    }
    setIsAuthLoading(false);
  }, []);

  const handleAuthAction = async (
    action: 'login' | 'logout' | 'updatePassword',
    credentials?: Credentials,
  ) => {
    if (!firestore) return;
    setAuthError(null);

    if (action === 'login') {
      const { username, password } = credentials!;
      if (!username || !password) {
        setAuthError('Vui lòng nhập tên đăng nhập và mật khẩu.');
        return;
      }

      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setAuthError('Tên đăng nhập không tồn tại.');
          return;
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data() as CustomUser;

        if (userData.password !== password) {
          setAuthError('Mật khẩu không đúng.');
          return;
        }

        const userToStore = { ...userData, id: userDoc.id };
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
        setCurrentUser(userToStore);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-change'));
        }
      } catch (error) {
        console.error("Login error:", error);
        setAuthError("Đã xảy ra lỗi khi đăng nhập.");
      }
    } else if (action === 'logout') {
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'));
      }
      onLogout();
    } else if (action === 'updatePassword') {
      if (currentUser && credentials?.newPassword) {
        const userDocRef = doc(firestore, 'users', currentUser.id);
        await updateDoc(userDocRef, { password: credentials.newPassword })
          .then(() => {
            toast({ title: 'Thành công', description: 'Đã đổi mật khẩu của bạn.' });
            setIsPasswordDialogOpen(false);
            setNewPassword('');
            setConfirmNewPassword('');
          })
          .catch(error => {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'update',
              requestResourceData: { password: '***' },
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Mật khẩu mới không được để trống.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setIsUpdatingPassword(true);
    await handleAuthAction('updatePassword', { newPassword });
    setIsUpdatingPassword(false);
  };

  return {
    currentUser,
    authError,
    isAuthLoading,
    handleAuthAction,
    isPasswordDialogOpen,
    setIsPasswordDialogOpen,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isUpdatingPassword,
    handleChangePassword,
  };
}
