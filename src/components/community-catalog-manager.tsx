'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { CommunityMapping, User as CustomUser, Supplier, MasterCatalogItem } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Home,
  Library,
  Search,
  Trash2,
  ArrowUpDown,
  Check,
  X,
  Link as LinkIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { exportCommunityMappingCatalogToExcel } from '@/lib/excel-exporter';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Combobox } from './ui/combobox';

type SortableKeys =
  | 'updateCount'
  | 'originalCode'
  | 'newName'
  | 'newCode'
  | 'newUnit'
  | 'conversionRate'
  | 'masterCatalogId'
  | 'supplierTaxCode';

interface CommunityCatalogManagerProps {
  currentUser: CustomUser;
}

export default function CommunityCatalogManager({ currentUser }: CommunityCatalogManagerProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<CommunityMapping[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({
    key: 'updateCount',
    direction: 'desc',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CommunityMapping> | null>(null);

  const [suppliersData, setSuppliersData] = useState<Supplier[]>([]);
  const [masterCatalogData, setMasterCatalogData] = useState<MasterCatalogItem[]>([]);

  const isAdmin = currentUser?.role === 'ADMIN';

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load suppliers and master catalog for labels & dropdown
  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/suppliers?userId=${currentUser.id}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setSuppliersData(data);
        })
        .catch((err) => console.error('Error fetching suppliers:', err));
    }

    fetch('/api/master-catalog')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMasterCatalogData(data);
      })
      .catch((err) => console.error('Error fetching master catalog:', err));
  }, [currentUser?.id]);

  const masterCatalogOptions = useMemo(
    () =>
      masterCatalogData.map((item) => ({
        value: item.id,
        label: `${item.productName} (${item.id})`,
      })),
    [masterCatalogData]
  );

  const suppliersMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliersData.forEach((s) => map.set(s.id, s.supplierName));
    return map;
  }, [suppliersData]);

  const masterCatalogMap = useMemo(() => {
    const map = new Map<string, MasterCatalogItem>();
    masterCatalogData.forEach((item) => map.set(item.id, item));
    return map;
  }, [masterCatalogData]);

  // Fetch paginated community mappings from PostgreSQL API
  const fetchCommunityMappings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      const res = await fetch(`/api/community-mappings?${params.toString()}`);
      if (!res.ok) throw new Error('Không thể tải dữ liệu danh mục cộng đồng');

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error: any) {
      console.error('Fetch community mappings error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi nạp dữ liệu',
        description: error.message || 'Không thể nạp danh mục ánh xạ.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, sortConfig, toast]);

  useEffect(() => {
    fetchCommunityMappings();
  }, [fetchCommunityMappings]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPage(1);
  };

  const SortableHeader = ({
    sortKey,
    children,
    className,
  }: {
    sortKey: SortableKeys;
    children: React.ReactNode;
    className?: string;
  }) => {
    const isSorted = sortConfig.key === sortKey;
    return (
      <TableHead className={cn('font-semibold', className)}>
        <Button
          variant="ghost"
          onClick={() => requestSort(sortKey)}
          className="px-2 py-1 h-auto -ml-2 hover:bg-muted/80 text-foreground"
        >
          {children}
          <ArrowUpDown
            className={cn('ml-2 h-3.5 w-3.5', isSorted ? 'text-primary' : 'text-muted-foreground/40')}
          />
        </Button>
      </TableHead>
    );
  };

  const handleEdit = (item: CommunityMapping) => {
    setEditingId(item.id);
    setEditFormData({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleInputChange = (field: keyof CommunityMapping, value: string | number) => {
    if (editFormData) {
      setEditFormData((prev) => ({ ...prev!, [field]: value }));
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editingId || !editFormData) return;
    try {
      const res = await fetch('/api/community-mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          masterCatalogId: editFormData.masterCatalogId || null,
        }),
      });

      if (!res.ok) throw new Error('Cập nhật mã liên kết thất bại');

      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId ? { ...it, masterCatalogId: editFormData.masterCatalogId || null } : it
        )
      );

      toast({ title: 'Cập nhật thành công!' });
      handleCancelEdit();
    } catch (error: any) {
      console.error('Error updating master catalog ID:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật mã liên kết.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`/api/community-mappings?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Xóa quy tắc thất bại');

      toast({ title: 'Đã xóa ánh xạ khỏi danh mục cộng đồng.' });
      fetchCommunityMappings();
    } catch (error: any) {
      console.error('Error deleting community mapping:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể xóa ánh xạ.',
      });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    toast({
      title: 'Đang chuẩn bị tệp Excel...',
      description: 'Hệ thống đang trích xuất dữ liệu ánh xạ cộng đồng từ máy chủ.',
    });

    try {
      const params = new URLSearchParams({
        all: 'true',
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      const res = await fetch(`/api/community-mappings?${params.toString()}`);
      if (!res.ok) throw new Error('Không thể tải toàn bộ danh mục để xuất');

      const data = await res.json();
      const exportList: CommunityMapping[] = data.items || [];

      if (exportList.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Không có dữ liệu',
          description: 'Không có quy tắc ánh xạ nào để xuất.',
        });
        return;
      }

      exportCommunityMappingCatalogToExcel(exportList, suppliersMap, masterCatalogMap);
      toast({
        title: 'Tải xuống thành công!',
        description: `Đã xuất ${exportList.length.toLocaleString('vi-VN')} quy tắc ánh xạ cộng đồng.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi xuất Excel',
        description: error.message || 'Không thể tạo file Excel.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Generate pagination page numbers
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

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Library className="h-8 w-8 text-primary shrink-0" />
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
                Danh mục Ánh xạ Cộng đồng
              </CardTitle>
              <CardDescription className="mt-1">
                Các quy tắc ánh xạ được đóng góp bởi tất cả người dùng để tăng tốc độ nhập liệu.
                Hiện có <span className="font-semibold text-foreground">{total.toLocaleString('vi-VN')}</span> quy tắc.
              </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls Bar: Search & Export */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative flex-grow w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Tìm theo tên, mã gốc, mã mới, MST...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto shrink-0"
              disabled={isExporting || total === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Đang xuất...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Xuất ra Excel
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="h-[60vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
                <SortableHeader sortKey="supplierTaxCode" className="w-[15%]">Nhà cung cấp</SortableHeader>
                <SortableHeader sortKey="originalCode" className="w-[12%]">Mã gốc</SortableHeader>
                <SortableHeader sortKey="newName" className="w-[22%]">Tên gợi ý</SortableHeader>
                <SortableHeader sortKey="newCode" className="w-[12%]">Mã gợi ý (Nội bộ)</SortableHeader>
                <SortableHeader sortKey="newUnit" className="w-[7%] text-center">ĐVT Mới</SortableHeader>
                <SortableHeader sortKey="conversionRate" className="w-[7%] text-center">Hệ số QĐ</SortableHeader>
                <SortableHeader sortKey="masterCatalogId" className="w-[15%]">Mã liên kết (Chung)</SortableHeader>
                <SortableHeader sortKey="updateCount" className="w-[5%] text-center">Lượt</SortableHeader>
                {isAdmin && <TableHead className="w-[5%] text-center">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="h-40 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu trang...</p>
                  </TableCell>
                </TableRow>
              ) : items.length > 0 ? (
                items.map((item) => {
                  const isEditing = isAdmin && editingId === item.id;
                  const currentData = isEditing ? editFormData : item;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <Badge variant="secondary" className="font-normal text-xs">
                          {item.supplierTaxCode
                            ? suppliersMap.get(item.supplierTaxCode) || `MST: ${item.supplierTaxCode}`
                            : 'Chung'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {item.originalCode}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{item.newName}</TableCell>
                      <TableCell className="font-mono text-xs">{item.newCode}</TableCell>
                      <TableCell className="text-center text-xs">{item.newUnit}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{item.conversionRate}</TableCell>
                      <TableCell>
                        {isEditing && currentData ? (
                          <Combobox
                            options={masterCatalogOptions}
                            value={currentData.masterCatalogId || ''}
                            onChange={(value) => handleInputChange('masterCatalogId', value)}
                            placeholder="Chọn mã chung..."
                            searchPlaceholder="Tìm mã hoặc tên..."
                            emptyPlaceholder="Không tìm thấy."
                          />
                        ) : item.masterCatalogId ? (
                          <span className="font-mono text-xs text-primary font-medium">
                            {item.masterCatalogId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Chưa liên kết</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.updateCount}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={handleSaveEdit}
                                title="Lưu"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-muted"
                                onClick={handleCancelEdit}
                                title="Hủy"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:bg-primary/10"
                                onClick={() => handleEdit(item)}
                                title="Liên kết mã chung"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                    title="Xóa quy tắc"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa quy tắc này?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bạn có chắc muốn xóa vĩnh viễn quy tắc cho mã{' '}
                                      <span className="font-bold text-foreground">{item.originalCode}</span>?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(item.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Xóa
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 9 : 8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {debouncedSearch
                      ? `Không tìm thấy quy tắc nào khớp với "${debouncedSearch}".`
                      : 'Danh mục cộng đồng trống.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
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
              {total.toLocaleString('vi-VN')} quy tắc)
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              title="Trang đầu"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
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
                  disabled={isLoading}
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
              disabled={page >= totalPages || isLoading}
              title="Trang tiếp"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
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
