'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User as CustomUser } from '@/types/firebase';
import {
  FileCode,
  Database,
  History,
  LayoutDashboard,
  FilePieChart,
  Building2,
  ShieldCheck,
  User,
  LogOut,
  KeyRound,
  Menu,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Xử lý XML', href: '/', icon: FileCode },
  { label: 'Danh mục', href: '/catalogs', icon: Database },
  { label: 'Dữ liệu & Lịch sử', href: '/data', icon: History },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Báo cáo Thuế', href: '/tax-report', icon: FilePieChart },
  { label: 'Tài khoản PM', href: '/accounts', icon: Building2 },
  { label: 'Quản trị', href: '/admin', icon: ShieldCheck, adminOnly: true },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Password dialog
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    toast({ title: 'Đã đăng xuất' });
    router.push('/');
    window.location.reload();
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Mật khẩu quá ngắn',
        description: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Mật khẩu không khớp',
        description: 'Vui lòng nhập lại mật khẩu xác nhận chính xác.',
      });
      return;
    }

    if (!currentUser?.id) return;

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          newPassword,
        }),
      });

      if (!res.ok) throw new Error('Không thể cập nhật mật khẩu');

      toast({ title: 'Đổi mật khẩu thành công!' });
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: err.message || 'Không thể đổi mật khẩu.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  // Không hiển thị header nếu chưa đăng nhập
  if (!currentUser) return null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-card/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group mr-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:bg-primary/90 transition-colors">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-base font-bold tracking-tight text-slate-900">Thuốc Số XML</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Pro
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_ITEMS.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-9 px-3 text-sm font-semibold transition-colors gap-2',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-slate-700 hover:text-primary hover:bg-slate-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-slate-300 text-slate-800 px-3 hover:bg-slate-100 font-semibold"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="max-w-[140px] truncate text-xs font-semibold sm:max-w-[180px]">
                    {currentUser.fullName || currentUser.username}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{currentUser.fullName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      @{currentUser.username} • {currentUser.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => setIsPasswordDialogOpen(true)}
                >
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span>Đổi mật khẩu</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/80 bg-card px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block"
                >
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start h-9 text-sm font-medium gap-2.5',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <KeyRound className="h-5 w-5" /> Đổi mật khẩu
            </DialogTitle>
            <DialogDescription>
              Cập nhật mật khẩu mới cho tài khoản{' '}
              <span className="font-semibold text-foreground">
                {currentUser.username}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">Mật khẩu mới</Label>
              <Input
                id="new-pwd"
                type="password"
                placeholder="Ít nhất 6 ký tự..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirm-pwd"
                type="password"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(false)}
              disabled={isUpdatingPassword}
            >
              Hủy
            </Button>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
