'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { read, utils, WorkBook } from 'xlsx';

import type { MasterCatalogItem, User as CustomUser } from '@/types/firebase';
import { exportMasterCatalogToExcel } from '@/lib/excel-exporter';
import { cn } from '@/lib/utils';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Home,
  Database,
  FileUp,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Download,
  ArrowUpDown,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MasterCatalogImportDialog, type ExcelData } from './master-catalog-import-dialog';
import type { ColumnMap as MasterCatalogColumnMap } from '@/lib/master-catalog-parser';
import { processMasterCatalogFile } from '@/lib/master-catalog-parser';

const emptyItem: MasterCatalogItem = {
  id: '',
  productName: '',
  activeIngredient: '',
  concentration: '',
  registrationNumber: '',
  packaging: '',
  unit: '',
  smallestUnit: '',
  conversionRate: 1,
};

type SortableKeys = keyof MasterCatalogItem;

const LOCAL_STORAGE_KEY = 'master-catalog-column-visibility';

const initialColumnVisibility = {
  id: true,
  productName: true,
  activeIngredient: true,
  concentration: true,
  registrationNumber: false,
  packaging: false,
  unit: true,
  smallestUnit: true,
  conversionRate: true,
};

export default function MasterCatalogManager() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Pagination & Filtering state
  const [items, setItems] = useState<MasterCatalogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({
    key: 'id',
    direction: 'asc',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Edit / Add state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<MasterCatalogItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemData, setNewItemData] = useState<MasterCatalogItem>(emptyItem);

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFileData, setImportFileData] = useState<ExcelData | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...initialColumnVisibility, ...parsed };
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage', error);
    }
    return initialColumnVisibility;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('Error writing to localStorage', error);
    }
  }, [columnVisibility]);

  const columnConfig: Array<{ key: keyof MasterCatalogItem; label: string; width: string }> = [
    { key: 'id', label: 'Mã SP', width: 'w-[12%]' },
    { key: 'productName', label: 'Tên sản phẩm', width: 'w-[25%]' },
    { key: 'activeIngredient', label: 'Hoạt chất', width: 'w-[15%]' },
    { key: 'concentration', label: 'Hàm lượng', width: 'w-[12%]' },
    { key: 'registrationNumber', label: 'Số đăng ký', width: 'w-[12%]' },
    { key: 'packaging', label: 'Quy cách', width: 'w-[15%]' },
    { key: 'unit', label: 'ĐVT', width: 'w-[7%]' },
    { key: 'smallestUnit', label: 'ĐVT nhỏ nhất', width: 'w-[10%]' },
    { key: 'conversionRate', label: 'Hệ số QĐ', width: 'w-[8%]' },
  ];

  // Fetch current user details
  useEffect(() => {
    if (!authChecked) {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAuthChecked(true);
      }
    }
  }, [authChecked]);

  const isAdmin = currentUser?.role === 'ADMIN';

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch paginated master catalog from PostgreSQL API
  const fetchMasterCatalog = useCallback(async () => {
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

      const res = await fetch(`/api/master-catalog?${params.toString()}`);
      if (!res.ok) throw new Error('Không thể tải danh mục sản phẩm');

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error: any) {
      console.error('Fetch master catalog error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi nạp dữ liệu',
        description: error.message || 'Không thể nạp danh mục chung.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, sortConfig, toast]);

  useEffect(() => {
    fetchMasterCatalog();
  }, [fetchMasterCatalog]);

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

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0 || !isAdmin) return;
    const file = files[0];
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook: WorkBook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 1) {
          toast({ variant: 'destructive', title: 'Tệp Excel trống' });
          return;
        }

        const headers = jsonData[0].map((h) => String(h));
        const preview = jsonData.slice(1, 6);

        setImportFileData({ headers, preview });
        setIsImportOpen(true);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Lỗi đọc tệp Excel' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async (columnMap: MasterCatalogColumnMap) => {
    if (!importFile || !isAdmin) return;

    try {
      const newItemsMap = await processMasterCatalogFile(importFile, columnMap);
      const itemsArray = Array.from(newItemsMap.entries()).map(([id, item]) => ({
        ...item,
        id,
      }));

      const res = await fetch('/api/master-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsArray),
      });

      if (!res.ok) throw new Error('Lưu dữ liệu nhập Excel thất bại');

      toast({
        title: 'Tải lên danh mục thành công',
        description: `Đã lưu ${itemsArray.length.toLocaleString('vi-VN')} sản phẩm vào CSDL.`,
      });

      setImportFile(null);
      setImportFileData(null);
      setIsImportOpen(false);
      fetchMasterCatalog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lỗi xử lý tệp danh mục', description: e.message });
    }
  };

  const handleEdit = (item: MasterCatalogItem) => {
    setIsAdding(false);
    setEditingId(item.id);
    setEditFormData({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItemData(emptyItem);
  };

  const handleInputChange = (field: keyof MasterCatalogItem, value: string | number, isNew: boolean) => {
    const processValue = (prev: MasterCatalogItem | null) => {
      const newPrev = prev ? { ...prev } : { ...emptyItem };
      if (field === 'conversionRate') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        newPrev[field] = isNaN(numValue) ? 1 : numValue;
      } else {
        newPrev[field as Exclude<keyof MasterCatalogItem, 'conversionRate'>] = value as string;
      }
      return newPrev;
    };

    if (isNew) {
      setNewItemData(processValue);
    } else if (editFormData) {
      setEditFormData(processValue);
    }
  };

  const handleSaveNew = async () => {
    if (!isAdmin || !newItemData.id || !newItemData.productName) {
      toast({ variant: 'destructive', title: 'Thiếu thông tin', description: 'Mã SP và Tên SP là bắt buộc.' });
      return;
    }

    try {
      const res = await fetch('/api/master-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemData),
      });

      if (!res.ok) throw new Error('Không thể thêm sản phẩm');

      toast({ title: 'Thêm sản phẩm thành công' });
      handleCancelAdd();
      fetchMasterCatalog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: e.message });
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editingId || !editFormData || !editFormData.id || !editFormData.productName) {
      toast({ variant: 'destructive', title: 'Thiếu thông tin', description: 'Mã SP và Tên SP là bắt buộc.' });
      return;
    }

    try {
      // If ID changed, delete old one
      if (editingId !== editFormData.id) {
        await fetch(`/api/master-catalog?id=${encodeURIComponent(editingId)}`, { method: 'DELETE' });
      }

      const res = await fetch('/api/master-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) throw new Error('Không thể lưu cập nhật');

      toast({ title: 'Cập nhật sản phẩm thành công' });
      handleCancelEdit();
      fetchMasterCatalog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`/api/master-catalog?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Không thể xóa sản phẩm');

      toast({ title: 'Đã xóa sản phẩm thành công' });
      fetchMasterCatalog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: e.message });
    }
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/master-catalog?all=true', { method: 'DELETE' });
      if (!res.ok) throw new Error('Không thể xóa toàn bộ danh mục');

      toast({ title: 'Đã xóa toàn bộ danh mục' });
      fetchMasterCatalog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: e.message });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    toast({
      title: 'Đang chuẩn bị tệp Excel...',
      description: 'Hệ thống đang trích xuất dữ liệu danh mục chung.',
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

      const res = await fetch(`/api/master-catalog?${params.toString()}`);
      if (!res.ok) throw new Error('Không thể tải toàn bộ danh mục để xuất');

      const data = await res.json();
      const exportList: MasterCatalogItem[] = data.items || [];

      if (exportList.length === 0) {
        toast({ variant: 'destructive', title: 'Không có dữ liệu', description: 'Danh mục hiện tại trống.' });
        return;
      }

      exportMasterCatalogToExcel(exportList);
      toast({
        title: 'Tải xuống thành công!',
        description: `Đã xuất ${exportList.length.toLocaleString('vi-VN')} sản phẩm ra file Excel.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({ variant: 'destructive', title: 'Lỗi xuất Excel', description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

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

  return (
    <>
      <MasterCatalogImportDialog
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        excelData={importFileData}
        onConfirm={handleConfirmImport}
      />
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary shrink-0" />
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
                  Danh mục Sản phẩm dùng chung
                </CardTitle>
                <CardDescription className="mt-1">
                  Danh mục chuẩn hóa để liên kết các mã hàng hóa từ nhiều nhà cung cấp khác nhau. Hiện có{' '}
                  <span className="font-semibold text-foreground">{total.toLocaleString('vi-VN')}</span> sản phẩm.
                </CardDescription>
              </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls Bar: Search & Action Buttons */}
          <div className="flex flex-col lg:flex-row gap-3 justify-between items-center">
            <div className="relative flex-grow w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Tìm theo mã, tên, hoạt chất, số đăng ký...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
              {isAdmin && (
                <Button
                  onClick={() => {
                    setIsAdding(true);
                    setEditingId(null);
                  }}
                  disabled={isAdding}
                  size="sm"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Thêm sản phẩm
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="mr-2 h-4 w-4" /> Cột hiển thị
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Tùy chỉnh cột hiển thị</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columnConfig.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      className="capitalize text-xs"
                      checked={columnVisibility[col.key as keyof typeof columnVisibility]}
                      onCheckedChange={(value) =>
                        setColumnVisibility((prev) => ({ ...prev, [col.key]: !!value }))
                      }
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
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

              {isAdmin && (
                <>
                  <label htmlFor="import-catalog" className="cursor-pointer">
                    <Button asChild size="sm">
                      <span>
                        <FileUp className="mr-2 h-4 w-4" /> Tải lên từ Excel
                      </span>
                    </Button>
                    <input
                      id="import-catalog"
                      type="file"
                      className="hidden"
                      accept=".xlsx, .xls"
                      onChange={(e) => handleFileSelect(e.target.files ? Array.from(e.target.files) : [])}
                    />
                  </label>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Xóa toàn bộ
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="text-destructive" />
                          Xác nhận xóa toàn bộ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này sẽ xóa vĩnh viễn TOÀN BỘ sản phẩm trong danh mục chung. Dữ liệu không
                          thể khôi phục. Bạn có chắc chắn muốn tiếp tục?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAll}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Xóa tất cả
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="h-[60vh] overflow-auto rounded-md border">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <TableRow>
                  {isAdmin && <TableHead className="w-[90px] text-center">Hành động</TableHead>}
                  {columnConfig
                    .filter((c) => columnVisibility[c.key as keyof typeof columnVisibility])
                    .map((col) => (
                      <SortableHeader
                        key={col.key}
                        sortKey={col.key as SortableKeys}
                        className={col.width}
                      >
                        {col.label}
                      </SortableHeader>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAdmin && isAdding && (
                  <TableRow className="bg-muted/50">
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={handleSaveNew}
                          title="Lưu"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:bg-muted"
                          onClick={handleCancelAdd}
                          title="Hủy"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    {columnConfig
                      .filter((c) => columnVisibility[c.key as keyof typeof columnVisibility])
                      .map((col) => (
                        <TableCell key={col.key}>
                          <Input
                            type={col.key === 'conversionRate' ? 'number' : 'text'}
                            value={newItemData[col.key as keyof MasterCatalogItem] as string | number}
                            onChange={(e) =>
                              handleInputChange(col.key as keyof MasterCatalogItem, e.target.value, true)
                            }
                            placeholder={`${col.label}${col.key === 'id' || col.key === 'productName' ? ' (*)' : ''}`}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                      ))}
                  </TableRow>
                )}

                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="h-40 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu danh mục...</p>
                    </TableCell>
                  </TableRow>
                ) : items.length > 0 ? (
                  items.map((item) => {
                    const isEditing = editingId === item.id;
                    const currentData = isEditing ? editFormData : item;

                    return (
                      <TableRow
                        key={item.id}
                        className={cn('hover:bg-muted/40 transition-colors', isEditing && 'bg-muted/60')}
                      >
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
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                      title="Xóa"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Xóa sản phẩm này?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bạn có chắc muốn xóa vĩnh viễn sản phẩm{' '}
                                        <span className="font-bold text-foreground">{item.productName}</span>?
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
                        {columnConfig
                          .filter((c) => columnVisibility[c.key as keyof typeof columnVisibility])
                          .map((col) => (
                            <TableCell
                              key={col.key}
                              className={cn(
                                col.key === 'id' && 'font-mono text-xs font-semibold text-primary',
                                col.key === 'productName' && 'font-medium text-sm',
                                (col.key === 'unit' || col.key === 'smallestUnit') && 'text-center text-xs',
                                col.key === 'conversionRate' && 'text-center font-mono text-xs'
                              )}
                            >
                              {isEditing && currentData ? (
                                <Input
                                  type={col.key === 'conversionRate' ? 'number' : 'text'}
                                  value={currentData[col.key] as string | number}
                                  onChange={(e) =>
                                    handleInputChange(col.key, e.target.value, false)
                                  }
                                  className="h-8 text-xs"
                                />
                              ) : (
                                (item[col.key] ?? '')
                              )}
                            </TableCell>
                          ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 10 : 9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {debouncedSearch
                        ? `Không tìm thấy sản phẩm nào khớp với "${debouncedSearch}".`
                        : 'Danh mục sản phẩm dùng chung trống.'}
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
                {total.toLocaleString('vi-VN')} sản phẩm)
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
    </>
  );
}
