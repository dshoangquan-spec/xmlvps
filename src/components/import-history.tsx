
'use client';

import { useState, useMemo, useEffect, useCallback }from 'react';
import Link from 'next/link';
import { collection, doc, getDocs, query, where, writeBatch, Query, collectionGroup, getDoc, orderBy, onSnapshot } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { User as CustomUser, ImportSession, Invoice, InvoiceItem } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Loader2, FileText, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Trash2, AlertTriangle, Search, ArrowUpDown, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { exportSessionDetailsToExcel } from '@/lib/excel-exporter';

interface ImportHistoryProps {
  currentUser: CustomUser;
}

interface DetailedInvoiceItem extends InvoiceItem {
    sellerName: string;
}

type SortableKeys = keyof DetailedInvoiceItem | 'invoiceId' | 'sellerName';


const formatNumber = (num: number | string | undefined) => {
  if (num === undefined || num === null) return '';
  const parsed = typeof num === 'number' ? num : parseFloat(String(num).replace(/,/g, ''));
  return isNaN(parsed) ? num : parsed.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};


function SessionDetailDialog({ session, user, isOpen, onOpenChange }: { session: ImportSession | null, user: CustomUser | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const firestore = useFirestore();
  const [items, setItems] = useState<DetailedInvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' } | null>({ key: 'invoiceId', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !session?.id || !user?.id || !firestore) {
      setItems([]);
      return;
    }

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const invoicesQuery = query(
          collection(firestore, 'users', user.id, 'invoices'), 
          where('importSessionId', '==', session.id)
        );
        const invoiceSnapshot = await getDocs(invoicesQuery);
        if (invoiceSnapshot.empty) {
            setItems([]);
            setIsLoading(false);
            return;
        }

        const allItems: DetailedInvoiceItem[] = [];
        
        for (const invoiceDoc of invoiceSnapshot.docs) {
            const invoiceData = invoiceDoc.data() as Invoice;
            const itemsRef = collection(invoiceDoc.ref, 'items');
            const itemsSnapshot = await getDocs(itemsRef);
            itemsSnapshot.forEach(itemDoc => {
                allItems.push({ 
                    ...itemDoc.data() as InvoiceItem, 
                    id: itemDoc.id,
                    sellerName: invoiceData.sellerName,
                });
            });
        }
        
        setItems(allItems);
      } catch (error) {
        console.error("Error fetching session items: ", error);
        toast({ variant: 'destructive', title: "Lỗi tải chi tiết", description: "Không thể tải chi tiết các mặt hàng."});
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [isOpen, session?.id, user?.id, firestore, toast]);
  
  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedAndFilteredItems = useMemo(() => {
    let filtered = [...items];
    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        filtered = items.filter(item => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(lowerCaseSearch)
            )
        );
    }
    
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key as keyof DetailedInvoiceItem];
        const valB = b[sortConfig.key as keyof DetailedInvoiceItem];

        if (valA == null) return 1;
        if (valB == null) return -1;

        let comparison = 0;
        if (['quantity', 'unitPrice', 'totalAmount'].includes(sortConfig.key)) {
            const numA = parseFloat(String(valA));
            const numB = parseFloat(String(valB));
            if (!isNaN(numA) && !isNaN(numB)) {
                comparison = numA - numB;
            }
        } else {
          comparison = String(valA).localeCompare(String(valB), 'vi', { sensitivity: 'base' });
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [items, searchTerm, sortConfig]);

  const total = sortedAndFilteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedAndFilteredItems.slice(start, start + limit);
  }, [sortedAndFilteredItems, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, isOpen]);

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortableKeys, children: React.ReactNode, className?: string }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
      <TableHead className={cn("font-semibold", className)}>
        <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
          {children}
          <ArrowUpDown className={cn("ml-2 h-3 w-3", isSorted ? "text-primary" : "text-muted-foreground/50")} />
        </Button>
      </TableHead>
    );
  };
  
  const handleExport = () => {
    if(sortedAndFilteredItems.length > 0) {
      exportSessionDetailsToExcel(sortedAndFilteredItems, session?.importDate || new Date().toISOString());
    } else {
      toast({ variant: 'destructive', title: "Không có dữ liệu để xuất." });
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Chi tiết các mặt hàng đã nhập</DialogTitle>
          {session && (
            <DialogDescription>
              Ngày nhập: {new Date(session.importDate).toLocaleString('vi-VN')} - Tổng số {items?.length ?? 0} dòng sản phẩm.
            </DialogDescription>
          )}
        </DialogHeader>
         <div className="flex justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="Tìm kiếm trong các mặt hàng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Xuất Excel
            </Button>
        </div>
        <ScrollArea className="h-[55vh] rounded-md border mt-4">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <SortableHeader sortKey="invoiceId" className="w-[10%]">Số HĐ</SortableHeader>
                <SortableHeader sortKey="sellerName" className="w-[15%]">Nhà cung cấp</SortableHeader>
                <SortableHeader sortKey="itemName" className="w-[25%]">Tên hàng</SortableHeader>
                <SortableHeader sortKey="lotNumber" className="w-[8%]">Số lô</SortableHeader>
                <SortableHeader sortKey="expirationDate" className="w-[8%]">Hạn dùng</SortableHeader>
                <SortableHeader sortKey="unit" className="w-[6%] text-center">ĐVT</SortableHeader>
                <SortableHeader sortKey="quantity" className="w-[6%] text-right">SL</SortableHeader>
                <TableHead className="w-[9%] text-right font-semibold">Đơn giá VAT</TableHead>
                <SortableHeader sortKey="totalAmount" className="w-[10%] text-right">Thành tiền</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : sortedAndFilteredItems && sortedAndFilteredItems.length > 0 ? (
                paginatedItems.map(item => {
                    const quantity = parseFloat(item.quantity) || 0;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    const taxRate = parseFloat(item.taxRate) / 100 || 0;
                    
                    const unitPriceWithVat = Math.round(unitPrice * (1 + taxRate));
                    const totalAmount = quantity * unitPriceWithVat;

                    return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium break-words">{item.invoiceId}</TableCell>
                            <TableCell className="text-sm text-muted-foreground break-words">{item.sellerName}</TableCell>
                            <TableCell className="break-words">{item.itemName}</TableCell>
                            <TableCell className="break-words">{item.lotNumber}</TableCell>
                            <TableCell>{item.expirationDate}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{item.unit}</Badge></TableCell>
                            <TableCell className="text-right">{formatNumber(quantity)}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(unitPriceWithVat)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatNumber(totalAmount)}</TableCell>
                        </TableRow>
                    )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Không có mặt hàng nào trong phiên này.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination Bar for Dialog */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <Select
              value={String(limit)}
              onValueChange={(val) => {
                setLimit(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-[64px] text-xs">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>dòng / trang</span>
            <span>(Hiển thị {startRecord} - {endRecord} trên tổng số {total} mặt hàng)</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">Trang {page}/{totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function commitLargeBatch(firestore: Firestore, operations: any[]) {
  let batch = writeBatch(firestore);
  let count = 0;

  for (const op of operations) {
    if (op.type === "delete") batch.delete(op.ref);
    if (op.type === "set") batch.set(op.ref, op.data);
    if (op.type === "update") batch.update(op.ref, op.data);

    count++;

    // Firestore giới hạn 500 operations/batch
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(firestore);
      count = 0;
    }
  }

  // commit phần còn lại
  if (count > 0) {
    await batch.commit();
  }
}


export default function ImportHistory({ currentUser }: ImportHistoryProps) {
  const firestore = useFirestore();
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionLimit, setSessionLimit] = useState(10);
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<boolean | string>(false); // Can be boolean or sessionId string

  useEffect(() => {
    if (!currentUser?.id || !firestore) {
      setSessions([]);
      setIsLoadingSessions(false);
      return;
    };
    setIsLoadingSessions(true);
    const sessionsQuery = query(
      collection(firestore, 'users', currentUser.id, 'import_sessions'),
      orderBy('importDate', 'desc')
    );
    const unsubscribe = onSnapshot(sessionsQuery, snapshot => {
      const fetchedSessions = snapshot.docs.map(doc => ({ ...doc.data() as ImportSession, id: doc.id }));
      setSessions(fetchedSessions);
      setIsLoadingSessions(false);
    }, err => {
      console.error(err);
      toast({ variant: 'destructive', title: 'Lỗi tải lịch sử' });
      setIsLoadingSessions(false);
    });

    return () => unsubscribe();
  }, [currentUser?.id, firestore, toast]);

  const handleViewDetails = (session: ImportSession) => {
    setSelectedSession(session);
    setIsDetailOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentUser || !firestore) return;
    setIsDeleting(sessionId);

    try {
      const batch = writeBatch(firestore);
      
      const invoicesQuery = query(collection(firestore, 'users', currentUser.id, 'invoices'), where('importSessionId', '==', sessionId));
      const invoiceSnapshot = await getDocs(invoicesQuery);
      
      for (const invoiceDoc of invoiceSnapshot.docs) {
        const itemsCollectionRef = collection(invoiceDoc.ref, 'items');
        const itemsSnapshot = await getDocs(itemsCollectionRef);
        itemsSnapshot.forEach(itemDoc => batch.delete(itemDoc.ref));
        
        batch.delete(invoiceDoc.ref);
      }
      
      const sessionDocRef = doc(firestore, 'users', currentUser.id, 'import_sessions', sessionId);
      batch.delete(sessionDocRef);

      await batch.commit();

      toast({
        title: 'Xóa thành công',
        description: 'Đã xóa phiên nhập hàng và tất cả dữ liệu liên quan.',
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        variant: 'destructive',
        title: 'Lỗi xóa dữ liệu',
        description: 'Không thể xóa phiên nhập hàng. Vui lòng thử lại.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllHistory = async () => {
    if (!currentUser || !firestore || !sessions) return;
    setIsDeleting(true);

    try {
      const allOps: any[] = [];

      for (const session of sessions) {
        // delete invoices
        const invoicesQuery = query(
          collection(firestore, 'users', currentUser.id, 'invoices'),
          where('importSessionId', '==', session.id)
        );
        const invoiceSnapshot = await getDocs(invoicesQuery);

        for (const invoiceDoc of invoiceSnapshot.docs) {
          // delete items
          const itemsSnapshot = await getDocs(collection(invoiceDoc.ref, "items"));
          itemsSnapshot.forEach(itemDoc => {
            allOps.push({ type: "delete", ref: itemDoc.ref });
          });

          allOps.push({ type: "delete", ref: invoiceDoc.ref });
        }

        // delete session
        allOps.push({
          type: "delete",
          ref: doc(firestore, 'users', currentUser.id, 'import_sessions', session.id),
        });
      }

      // commit tất cả theo batch nhỏ
      await commitLargeBatch(firestore, allOps);
      
      // setSessions([]); // No need to set here, onSnapshot will handle it

      toast({
        title: "Xóa toàn bộ thành công",
        description: "Toàn bộ dữ liệu đã được xóa.",
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Lỗi khi xóa",
        description: "Không thể xóa toàn bộ dữ liệu.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAdminView = currentUser?.role === 'ADMIN';

  const totalSessions = sessions.length;
  const totalSessionPages = Math.max(1, Math.ceil(totalSessions / sessionLimit));
  const paginatedSessions = useMemo(() => {
    const start = (sessionPage - 1) * sessionLimit;
    return sessions.slice(start, start + sessionLimit);
  }, [sessions, sessionPage, sessionLimit]);

  const startSessionRecord = totalSessions === 0 ? 0 : (sessionPage - 1) * sessionLimit + 1;
  const endSessionRecord = Math.min(sessionPage * sessionLimit, totalSessions);

  return (
    <>
      <SessionDetailDialog session={selectedSession} user={currentUser} isOpen={isDetailOpen} onOpenChange={setIsDetailOpen} />
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight text-primary">Lịch sử nhập hàng của {isAdminView && sessions.length > 0 ? currentUser.fullName : 'bạn'}</CardTitle>
              <CardDescription>Xem lại các lần nhập hóa đơn từ file XML (Tổng cộng: {totalSessions} phiên nhập).</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!!isDeleting || !sessions || sessions.length === 0}>
                      {isDeleting === true ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                      Xóa Toàn Bộ Lịch Sử
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/> Xác nhận xóa TOÀN BỘ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hành động này sẽ xóa vĩnh viễn tất cả các phiên nhập hàng đã lưu của người dùng <span className="font-bold">{currentUser.fullName}</span>. 
                        Dữ liệu không thể khôi phục. Bạn có chắc chắn muốn tiếp tục không?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllHistory} className="bg-destructive hover:bg-destructive/90">Tôi chắc chắn, Xóa tất cả</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] rounded-md border">
            {isLoadingSessions || isDeleting === true ? (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4">{isDeleting === true ? 'Đang dọn dẹp dữ liệu...' : 'Đang tải lịch sử...'}</p>
                </div>
            ) : sessions && sessions.length > 0 ? (
                <div className="p-4 space-y-4">
                    {paginatedSessions.map(session => (
                        <div key={session.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                            <div className='flex items-center gap-4'>
                                {isDeleting === session.id ? <Loader2 className='h-8 w-8 animate-spin text-primary' /> : <FileText className='h-8 w-8 text-primary' />}
                                <div>
                                    <p className="font-semibold text-lg">
                                        Nhập lúc: {new Date(session.importDate).toLocaleString('vi-VN')}
                                    </p>
                                    <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                                        <span>Số file: <Badge variant="secondary">{session.fileNames.length}</Badge></span>
                                        <span>Số hóa đơn: <Badge variant="secondary">{session.invoiceCount}</Badge></span>
                                        <span>Số dòng SP: <Badge variant="secondary">{session.itemCount}</Badge></span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleViewDetails(session)} disabled={!!isDeleting}>
                                    Xem chi tiết <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" disabled={!!isDeleting}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Xác nhận xóa phiếu nhập?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Hành động này sẽ xóa vĩnh viễn phiếu nhập hàng lúc <span className='font-bold'>{new Date(session.importDate).toLocaleString('vi-VN')}</span>.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteSession(session.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                    <p>Chưa có lịch sử nhập hàng nào.</p>
                    <p className="mt-2">{isAdminView ? `Người dùng ${currentUser.fullName} chưa có dữ liệu.` : "Hãy về trang chính và tải lên tệp XML để bắt đầu."}</p>
                </div>
            )}
          </ScrollArea>

          {/* Pagination Bar for Sessions */}
          {totalSessions > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Hiển thị</span>
                <Select
                  value={String(sessionLimit)}
                  onValueChange={(val) => {
                    setSessionLimit(Number(val));
                    setSessionPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[72px]">
                    <SelectValue placeholder={sessionLimit} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                  </SelectContent>
                </Select>
                <span>phiên / trang</span>
                <span className="hidden sm:inline">
                  (Hiển thị {startSessionRecord} - {endSessionRecord} trên tổng số {totalSessions} phiên)
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSessionPage(1)}
                  disabled={sessionPage <= 1}
                  title="Trang đầu"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                  disabled={sessionPage <= 1}
                  title="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs">
                  Trang {sessionPage}/{totalSessionPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSessionPage(p => Math.min(totalSessionPages, p + 1))}
                  disabled={sessionPage >= totalSessionPages}
                  title="Trang tiếp"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSessionPage(totalSessionPages)}
                  disabled={sessionPage >= totalSessionPages}
                  title="Trang cuối"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
