
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  getDoc,
  doc,
  where,
  collectionGroup,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { Invoice, InvoiceItem, User as CustomUser } from "@/types/firebase";
import { DateRange } from "react-day-picker";
import {
  addDays,
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  isWithinInterval,
} from "date-fns";
import { vi } from "date-fns/locale";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Loader2, Search, Download, Calendar as CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportAllItemsToExcel } from "@/lib/excel-exporter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";

interface AllItemsViewerProps {
  currentUser: CustomUser;
}

interface FinalItem extends InvoiceItem {
  sellerName: string;
  invoiceDate: string;
}

type SortableKeys = keyof FinalItem | "unitPriceVat" | "totalAmountVat";

export default function AllItemsViewer({ currentUser }: AllItemsViewerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [items, setItems] = useState<FinalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -90),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: "asc" | "desc" } | null>({
    key: "invoiceDate",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (!currentUser?.id || !firestore) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const itemsQuery = query(
      collectionGroup(firestore, 'items'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(itemsQuery, (itemsSnapshot) => {
      const all: FinalItem[] = itemsSnapshot.docs.map(doc => {
          const item = doc.data() as InvoiceItem;
          return {
              ...item,
              id: doc.id,
          };
      });
      setItems(all);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      toast({ variant: "destructive", title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách mặt hàng." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.id, firestore, toast]);


  // 🔍 Filter theo ngày
  const filteredByDate = useMemo(() => {
    if (!date?.from || !date?.to) return items;

    return items.filter(item => {
      let d: Date | null = null;
      const dateString = item.invoiceDate || '';

      // Define a list of possible date formats
      const formatsToTry = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy'];

      for (const fmt of formatsToTry) {
        const parsedDate = parse(dateString, fmt, new Date());
        if (isValid(parsedDate)) {
          d = parsedDate;
          break; // Stop on first successful parse
        }
      }

      return d && isValid(d) && isWithinInterval(d, { start: date.from!, end: date.to! });
    });
  }, [items, date]);

  // 🔢 VAT calculation
  const calculateVat = useCallback((i: InvoiceItem) => {
    const quantity = parseFloat(i.quantity) || 0;
    const unitPrice = parseFloat(i.unitPrice) || 0;
    const tax = parseFloat(i.taxRate) / 100 || 0;
    const unitPriceVat = Math.round(unitPrice * (1 + tax));
    const totalAmountVat = quantity * unitPriceVat;
    return { unitPriceVat, totalAmountVat };
  }, []);

  // 🔄 Sort + Search
  const sortedAndFiltered = useMemo(() => {
    let list = [...filteredByDate];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(s))
      );
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let A: any, B: any;

        if (sortConfig.key === "unitPriceVat" || sortConfig.key === "totalAmountVat") {
          A = calculateVat(a)[sortConfig.key];
          B = calculateVat(b)[sortConfig.key];
        } else {
          A = a[sortConfig.key as keyof FinalItem];
          B = b[sortConfig.key as keyof FinalItem];
        }
        
        if (A == null) return 1;
        if (B == null) return -1;
        
        if (sortConfig.key === "invoiceDate") {
          const da = parse(a.invoiceDate, "dd/MM/yyyy", new Date());
          const db = parse(b.invoiceDate, "dd/MM/yyyy", new Date());
          if (isValid(da) && isValid(db)) {
            return sortConfig.direction === "asc" ? da.getTime() - db.getTime() : db.getTime() - da.getTime();
          }
        }
        
        if (typeof A === 'number' && typeof B === 'number') {
            return sortConfig.direction === 'asc' ? A - B : B - A;
        }

        return sortConfig.direction === "asc"
          ? String(A).localeCompare(String(B), "vi")
          : String(B).localeCompare(String(A), "vi");
      });
    }

    return list;
  }, [filteredByDate, searchTerm, sortConfig, calculateVat]);

  const total = sortedAndFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedAndFiltered.slice(start, start + limit);
  }, [sortedAndFiltered, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, date]);

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [page, totalPages]);

  const requestSort = (key: SortableKeys) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortableHeader = ({ sortKey, children, className }: {sortKey: SortableKeys, children: React.ReactNode, className?: string}) => {
    const active = sortConfig?.key === sortKey;
    return (
      <TableHead className={cn("font-semibold", className)}>
        <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
          {children}
          <ArrowUpDown className={cn("ml-2 h-3 w-3", active ? "text-primary" : "text-muted-foreground")} />
        </Button>
      </TableHead>
    );
  };

  const formatNumber = (n: any) => {
    const v = parseFloat(String(n).replace(/,/g, ""));
    return isNaN(v) ? "" : v.toLocaleString("vi-VN");
  };

  const presets = [
    { label: "7 ngày qua", range: { from: addDays(new Date(), -6), to: new Date() }},
    { label: "30 ngày qua", range: { from: addDays(new Date(), -29), to: new Date() }},
    { label: "90 ngày qua", range: { from: addDays(new Date(), -89), to: new Date() }},
    { label: "Tháng này", range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }},
    { label: "Quý này", range: { from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }},
    { label: "Năm nay", range: { from: new Date(new Date().getFullYear(), 0, 1), to: new Date(new Date().getFullYear(), 11, 31) }},
  ];

  const isAdminView = currentUser.role === 'ADMIN';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Tất cả mặt hàng của {isAdminView ? currentUser.fullName : 'bạn'}</CardTitle>
            <CardDescription>Xem, tìm kiếm và lọc toàn bộ mặt hàng đã nhập (Tổng cộng: {total.toLocaleString('vi-VN')} mặt hàng).</CardDescription>
          </div>
          {!isAdminView && (
            <Link href="/" passHref>
              <Button variant="outline"><Home className="mr-2 h-4 w-4" /> Trang chính</Button>
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[250px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? `${format(date.from, "dd/MM/yy")} - ${format(date.to, "dd/MM/yy")}` : format(date.from, "dd/MM/yy")
                  ) : "Chọn ngày"}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="space-y-2 p-2" align="end">
                <Select
                  onValueChange={v => {
                    const p = presets.find(p => p.label === v);
                    if (p) setDate(p.range);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhanh..." />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem value={p.label} key={p.label}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="border rounded-md">
                  <Calendar
                    mode="range"
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={vi}
                  />
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={() => exportAllItemsToExcel(sortedAndFiltered, date)}>
              <Download className="mr-2 h-4 w-4" /> Xuất Excel
            </Button>
          </div>
        </div>

        {/* TABLE */}
        <ScrollArea className="h-[60vh] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <SortableHeader sortKey="invoiceDate" className="w-[8%]">Ngày HĐ</SortableHeader>
                <SortableHeader sortKey="invoiceId" className="w-[8%]">Số HĐ</SortableHeader>
                <SortableHeader sortKey="sellerName" className="w-[15%]">Nhà cung cấp</SortableHeader>
                <SortableHeader sortKey="itemName" className="w-[22%]">Tên hàng</SortableHeader>
                <SortableHeader sortKey="lotNumber" className="w-[8%]">Số lô</SortableHeader>
                <SortableHeader sortKey="expirationDate" className="w-[8%]">Hạn dùng</SortableHeader>
                <SortableHeader sortKey="unit" className="w-[6%] text-center">ĐVT</SortableHeader>
                <SortableHeader sortKey="quantity" className="w-[5%] text-right">SL</SortableHeader>
                <SortableHeader sortKey="unitPriceVat" className="w-[8%] text-right">Đơn giá VAT</SortableHeader>
                <SortableHeader sortKey="totalAmountVat" className="w-[10%] text-right">Thành tiền</SortableHeader>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : sortedAndFiltered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    Không tìm thấy dữ liệu.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => {
                  const { unitPriceVat, totalAmountVat } = calculateVat(item);
                  return (
                    <TableRow key={item.id + "-" + index}>
                      <TableCell>{item.invoiceDate}</TableCell>
                      <TableCell>{item.invoiceId}</TableCell>
                      <TableCell>{item.sellerName}</TableCell>
                      <TableCell className="break-words">{item.itemName}</TableCell>
                      <TableCell>{item.lotNumber}</TableCell>
                      <TableCell>{item.expirationDate}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{item.unit}</Badge></TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-right">{formatNumber(unitPriceVat)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(totalAmountVat)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <Select
              value={String(limit)}
              onValueChange={(val) => {
                setLimit(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>dòng / trang</span>
            <span className="hidden md:inline pl-2 text-xs">
              (Hiển thị {startRecord.toLocaleString('vi-VN')} - {endRecord.toLocaleString('vi-VN')} trong tổng số{' '}
              {total.toLocaleString('vi-VN')} mặt hàng)
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              title="Trang đầu"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              title="Trang trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 px-1">
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className={cn('h-8 w-8 p-0 text-xs', p === page && 'pointer-events-none')}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              title="Trang tiếp"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              title="Trang cuối"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>

            <span className="text-xs pl-2">
              Trang {page}/{totalPages || 1}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

    