
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { read, utils, WorkBook } from 'xlsx';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { MasterCatalogItem, User as CustomUser } from '@/types/firebase';
import { exportMasterCatalogToExcel } from '@/lib/excel-exporter';
import { cn } from '@/lib/utils';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, Database, FileUp, Search, PlusCircle, Pencil, Trash2, Check, X, AlertTriangle, Download, ArrowUpDown, Settings2 } from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MasterCatalogImportDialog, type ExcelData } from './master-catalog-import-dialog';
import type { ColumnMap as MasterCatalogColumnMap } from '@/lib/master-catalog-parser';
import { processMasterCatalogFile } from '@/lib/master-catalog-parser';


const emptyItem: MasterCatalogItem = {
    id: "",
    productName: "",
    activeIngredient: "",
    concentration: "",
    registrationNumber: "",
    packaging: "",
    unit: "",
    smallestUnit: "",
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
  const firestore = useFirestore();
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<MasterCatalogItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemData, setNewItemData] = useState<MasterCatalogItem>(emptyItem);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFileData, setImportFileData] = useState<ExcelData | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'asc' });

  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure all keys from initial are present
                return { ...initialColumnVisibility, ...parsed };
            }
        }
    } catch (error) {
        console.error("Error reading from localStorage", error);
    }
    return initialColumnVisibility;
  });

  useEffect(() => {
      try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(columnVisibility));
      } catch (error) {
          console.error("Error writing to localStorage", error);
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

  // Fetch current user details to check role
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

  const masterCatalogRef = useMemoFirebase(() => collection(firestore, 'master_catalog'), [firestore]);
  const { data: catalog, isLoading: isLoadingCatalog } = useCollection<MasterCatalogItem>(masterCatalogRef);

  const catalogMap = useMemo(() => {
    const map = new Map<string, MasterCatalogItem>();
    catalog?.forEach(item => map.set(item.id, item));
    return map;
  }, [catalog]);

  const sortedAndFilteredCatalog = useMemo(() => {
    if (!catalog) return [];
    
    let items = [...catalog];

    // Filtering
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      items = items.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(lowercasedFilter)
        )
      );
    }

    // Sorting
    if (sortConfig !== null) {
        items.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;
            
            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            } else {
                comparison = String(valA).localeCompare(String(valB), 'vi', { sensitivity: 'base' });
            }

            return sortConfig.direction === 'desc' ? -comparison : comparison;
        });
    }

    return items;
  }, [catalog, searchTerm, sortConfig]);
  
  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
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
            toast({ variant: "destructive", title: "Tệp Excel trống" });
            return;
        }

        const headers = jsonData[0].map(h => String(h));
        const preview = jsonData.slice(1, 6);

        setImportFileData({ headers, preview });
        setIsImportOpen(true);
      } catch (error) {
        toast({ variant: "destructive", title: "Lỗi đọc tệp Excel" });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmImport = async (columnMap: MasterCatalogColumnMap) => {
    if (!importFile || !isAdmin || !firestore) return;

    try {
      const newItems = await processMasterCatalogFile(importFile, columnMap);
      const batch = writeBatch(firestore);
      newItems.forEach((value, key) => {
          const docRef = doc(firestore, 'master_catalog', key);
          batch.set(docRef, { ...value, id: key });
      });
      await batch.commit();

      toast({
        title: 'Tải lên danh mục thành công',
        description: `Đã tải lên và lưu ${newItems.size} sản phẩm.`,
      });
      
      setImportFile(null);
      setImportFileData(null);
      setIsImportOpen(false);

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
    const processValue = (prev: MasterCatalogItem) => {
      const newPrev = {...prev};
      if (field === 'conversionRate') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        newPrev[field] = isNaN(numValue) ? 1 : numValue;
      } else {
        newPrev[field as Exclude<keyof MasterCatalogItem, 'conversionRate'>] = value as string;
      }
      return newPrev;
    }
    
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
    if (catalogMap.has(newItemData.id)) {
        toast({ variant: 'destructive', title: 'Mã sản phẩm đã tồn tại.' });
        return;
    }
    await addDoc(collection(firestore, 'master_catalog'), newItemData);
    toast({ title: 'Thêm sản phẩm thành công' });
    handleCancelAdd();
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editingId || !editFormData || !editFormData.id || !editFormData.productName) {
      toast({ variant: 'destructive', title: 'Thiếu thông tin', description: 'Mã SP và Tên SP là bắt buộc.' });
      return;
    }
    const originalDocRef = doc(firestore, 'master_catalog', editingId);

    // If ID is changed, we must delete old doc and create new one
    if (editingId !== editFormData.id) {
        if (catalogMap.has(editFormData.id)) {
            toast({ variant: 'destructive', title: 'Mã sản phẩm mới đã tồn tại.' });
            return;
        }
        const newDocRef = doc(firestore, 'master_catalog', editFormData.id);
        const batch = writeBatch(firestore);
        batch.delete(originalDocRef);
        batch.set(newDocRef, editFormData);
        await batch.commit();
    } else {
        await updateDoc(originalDocRef, editFormData);
    }
    toast({ title: 'Cập nhật sản phẩm thành công' });
    handleCancelEdit();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(firestore, 'master_catalog', id));
    toast({ title: 'Đã xóa sản phẩm' });
  };
  
  const handleDeleteAll = async () => {
    if (!isAdmin || !catalog) return;
    const batch = writeBatch(firestore);
    catalog.forEach(item => {
        const docRef = doc(firestore, 'master_catalog', item.id);
        batch.delete(docRef);
    });
    await batch.commit();
    toast({ title: 'Đã xóa toàn bộ danh mục' });
  };
  
  const handleExport = () => {
    if (sortedAndFilteredCatalog.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có sản phẩm nào trong danh mục để xuất.",
      });
      return;
    }
    exportMasterCatalogToExcel(sortedAndFilteredCatalog);
    toast({
      title: "Đang xuất file Excel...",
      description: `Sẽ tải về ${sortedAndFilteredCatalog.length} sản phẩm.`
    });
  };

  if (!authChecked) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-8">
      {importFileData && (
        <MasterCatalogImportDialog
          isOpen={isImportOpen}
          onOpenChange={setIsImportOpen}
          excelData={importFileData}
          onConfirm={handleConfirmImport}
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Database className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary">
                        Danh mục sản phẩm dùng chung
                    </CardTitle>
                    <CardDescription>
                        Tìm kiếm và quản lý danh mục sản phẩm toàn hệ thống.
                        Hiện có {isLoadingCatalog ? "..." : catalog?.length ?? 0} sản phẩm.
                    </CardDescription>
                </div>
            </div>
            <Link href="/" passHref>
                <Button variant="outline"><Home className="mr-2 h-4 w-4" /> Về trang chính</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder={`Tìm kiếm trong ${catalog?.length ?? 0} sản phẩm...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className='flex gap-2'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Settings2 className="mr-2 h-4 w-4" />
                           Cột hiển thị
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Bật/tắt các cột</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {columnConfig.map(col => (
                           <DropdownMenuCheckboxItem
                            key={col.key}
                            className="capitalize"
                            checked={columnVisibility[col.key as keyof typeof columnVisibility]}
                            onCheckedChange={(value) =>
                              setColumnVisibility(prev => ({...prev, [col.key]: !!value}))
                            }
                          >
                            {col.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={handleExport} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Xuất ra Excel
                    </Button>
                    {isAdmin && (
                      <>
                        <label htmlFor="import-catalog" className="cursor-pointer">
                            <Button asChild>
                                <span><FileUp className="mr-2 h-4 w-4" /> Tải lên từ Excel</span>
                            </Button>
                            <input id="import-catalog" type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileSelect(e.target.files ? Array.from(e.target.files) : [])}/>
                        </label>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Xóa toàn bộ
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Xác nhận xóa toàn bộ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Hành động này sẽ xóa vĩnh viễn TOÀN BỘ sản phẩm trong danh mục chung. Dữ liệu không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Xóa tất cả</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        </>
                    )}
                </div>
            </div>
            <div className="h-[60vh] overflow-auto rounded-md border">
                <Table className="table-fixed">
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                        <TableRow>
                            {isAdmin && <TableHead className="w-[100px] text-center">Hành động</TableHead>}
                            {columnConfig.filter(c => columnVisibility[c.key as keyof typeof columnVisibility]).map(col => (
                               <SortableHeader key={col.key} sortKey={col.key as SortableKeys} className={col.width}>
                                   {col.label}
                               </SortableHeader>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {isAdmin && isAdding && (
                            <TableRow>
                                <TableCell className="text-center">
                                    <div className="flex justify-center gap-2">
                                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={handleSaveNew}><Check className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-700" onClick={handleCancelAdd}><X className="h-4 w-4" /></Button>
                                    </div>
                                </TableCell>
                                {columnConfig.filter(c => columnVisibility[c.key as keyof typeof columnVisibility]).map(col => (
                                     <TableCell key={col.key}>
                                        <Input 
                                            type={col.key === 'conversionRate' ? 'number' : 'text'}
                                            value={newItemData[col.key as keyof MasterCatalogItem] as string | number} 
                                            onChange={(e) => handleInputChange(col.key as keyof MasterCatalogItem, e.target.value, true)} 
                                            placeholder={`${col.label}${col.key === 'id' || col.key === 'productName' ? ' (*)' : ''}`} 
                                            className="h-8"
                                        />
                                    </TableCell>
                                ))}
                            </TableRow>
                        )}
                        {isLoadingCatalog ? (
                            <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                        ) : sortedAndFilteredCatalog.length > 0 ? (
                            sortedAndFilteredCatalog.map(item => {
                                const isEditing = editingId === item.id;
                                return (
                                    <TableRow key={item.id} className={isEditing ? 'bg-secondary' : ''}>
                                        {isAdmin && (
                                            <TableCell className="text-center">
                                                {isEditing ? (
                                                     <div className="flex justify-center gap-2">
                                                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={handleSaveEdit}><Check className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-700" onClick={handleCancelEdit}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        <Button variant="ghost" size="icon" className="text-primary hover:text-primary/90" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Xóa sản phẩm này?</AlertDialogTitle>
                                                                    <AlertDialogDescription>Bạn có chắc muốn xóa vĩnh viễn sản phẩm <span className='font-bold'>{item.productName}</span>?</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                        {columnConfig.filter(c => columnVisibility[c.key as keyof typeof columnVisibility]).map(col => (
                                             <TableCell key={col.key} className="break-words">
                                                {isEditing && editFormData ? (
                                                    <Input 
                                                      type={col.key === 'conversionRate' ? 'number' : 'text'}
                                                      value={editFormData[col.key as keyof MasterCatalogItem] as string | number} 
                                                      onChange={(e) => handleInputChange(col.key as keyof MasterCatalogItem, e.target.value, false)} 
                                                      className="h-8"/>
                                                ): (
                                                    item[col.key as keyof MasterCatalogItem]
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow><TableCell colSpan={isAdmin ? 10 : 9} className="h-24 text-center text-muted-foreground">{searchTerm ? "Không tìm thấy sản phẩm nào." : "Danh mục trống."}</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        {isAdmin && !isAdding && (
            <CardFooter>
                <Button onClick={() => setIsAdding(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm sản phẩm mới
                </Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
