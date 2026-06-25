
"use client";

import { useState, useMemo, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Mapping, Supplier, MasterCatalogItem } from "@/types/firebase";
import { Trash2, Pencil, Check, X, Search, ArrowUpDown, Download, Settings2 } from "lucide-react";
import { Combobox } from "./ui/combobox";
import { cn } from "@/lib/utils";
import { exportMappingCatalogToExcel } from "@/lib/excel-exporter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { errorEmitter, FirestorePermissionError } from "@/firebase";

interface MappingCatalogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mapping: Map<string, Mapping>;
  onDeleteMapping: (id: string) => void;
  onUpdateMapping: (id: string, newValues: Mapping) => void;
  suppliers: Map<string, Supplier>;
  masterCatalog: Map<string, MasterCatalogItem>;
}

type SortableKeys = keyof Mapping | 'supplierName';

const initialUnitOptions = [
  { value: "Viên", label: "Viên" },
  { value: "Chai", label: "Chai" },
  { value: "Lọ", label: "Lọ" },
  { value: "Ống", label: "Ống" },
  { value: "Túi", label: "Túi" },
  { value: "Tuýp", label: "Tuýp" },
  { value: "Hộp", label: "Hộp" },
  { value: "Lon", label: "Lon" },
  { value: "Cuộn", label: "Cuộn" },
  { value: "Cái", label: "Cái" },
  { value: "Suất", label: "Suất" },
];

type ColumnConfig = {
  key: keyof Mapping | 'supplierName';
  label: string;
  width: string;
}

const ITEMS_PER_PAGE = 50;

const LOCAL_STORAGE_KEY = 'mapping-catalog-column-visibility';

const initialColumnVisibility = {
  supplierName: true,
  originalCode: true,
  newName: true,
  newCode: true,
  masterCatalogId: true,
  originalUnit: false,
  newUnit: false,
  conversionRate: false,
};


export function MappingCatalogDialog({ 
  isOpen, 
  onOpenChange, 
  mapping, 
  onDeleteMapping, 
  onUpdateMapping, 
  suppliers, 
  masterCatalog 
}: MappingCatalogDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Mapping | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'asc' });
  const { toast } = useToast();
  const [unitOptions, setUnitOptions] = useState(initialUnitOptions);
  
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

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(columnVisibility));
        }
    } catch (error) {
        console.error("Error writing to localStorage", error);
    }
  }, [columnVisibility]);

  const masterCatalogOptions = useMemo(() => 
    Array.from(masterCatalog.values()).map(item => ({ value: item.id, label: `${item.productName} (${item.id})` }))
  , [masterCatalog]);


  const columnConfig: ColumnConfig[] = [
    { key: 'supplierName', label: 'Nhà cung cấp', width: 'w-[15%]' },
    { key: 'originalCode', label: 'Mã hàng gốc (XML)', width: 'w-[12%]' },
    { key: 'newName', label: 'Tên hàng hóa mới', width: 'w-[18%]' },
    { key: 'newCode', label: 'Mã ánh xạ mới', width: 'w-[10%]' },
    { key: 'masterCatalogId', label: 'Mã liên kết', width: 'w-[20%]' },
    { key: 'originalUnit', label: 'ĐVT (gốc)', width: 'w-[7%]' },
    { key: 'newUnit', label: 'ĐVT mới', width: 'w-[10%]' },
    { key: 'conversionRate', label: 'Quy đổi', width: 'w-[8%]' },
  ];


  const sortedAndFilteredMapping = useMemo(() => {
    let items = Array.from(mapping.values());

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      items = items.filter((info) => {
        const supplierName = info.supplierTaxCode ? suppliers.get(info.supplierTaxCode)?.supplierName || '' : '';
        const masterItem = info.masterCatalogId ? masterCatalog.get(info.masterCatalogId) : null;
        return info.id.toLowerCase().includes(lowercasedFilter) ||
          (info.originalCode && info.originalCode.toLowerCase().includes(lowercasedFilter)) ||
          info.newCode.toLowerCase().includes(lowercasedFilter) ||
          info.newName.toLowerCase().includes(lowercasedFilter) ||
          (info.masterCatalogId && info.masterCatalogId.toLowerCase().includes(lowercasedFilter)) ||
          (masterItem && masterItem.productName.toLowerCase().includes(lowercasedFilter)) ||
          supplierName.toLowerCase().includes(lowercasedFilter)
      });
    }

    if (sortConfig) {
       items.sort((a, b) => {
        let valA, valB;
        
        if (sortConfig.key === 'supplierName') {
          valA = a.supplierTaxCode ? suppliers.get(a.supplierTaxCode)?.supplierName : null;
          valB = b.supplierTaxCode ? suppliers.get(b.supplierTaxCode)?.supplierName : null;
        } else {
          valA = a[sortConfig.key as keyof Mapping];
          valB = b[sortConfig.key as keyof Mapping];
        }

        // Handle null or undefined values by pushing them to the end
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else {
            // Treat as string for everything else, using localeCompare for proper alphabetical sorting
            comparison = String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' });
        }
        
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }
    return items;
  }, [mapping, searchTerm, sortConfig, suppliers, masterCatalog]);
  
  const totalPages = Math.ceil(sortedAndFilteredMapping.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredMapping.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredMapping, currentPage]);


  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleEdit = (info: Mapping) => {
    setEditingId(info.id);
    setEditFormData(info);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editFormData) {
      if (!editFormData.newCode || editFormData.newCode.trim() === '') {
        return;
      }
      onUpdateMapping(editingId, editFormData);
      handleCancelEdit();
    }
  };

  const handleInputChange = (field: keyof Mapping, value: string | number) => {
    if (editFormData) {
      if(field === 'conversionRate') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        setEditFormData({ ...editFormData, [field]: isNaN(numValue) ? 1 : numValue });
      } else {
         setEditFormData({ ...editFormData, [field]: value });
      }
    }
  };
  
  const handleAddUnit = (newUnit: string) => {
    if (newUnit && !unitOptions.some(opt => opt.value.toLowerCase() === newUnit.toLowerCase())) {
      const newOption = { value: newUnit, label: newUnit };
      setUnitOptions(prev => [newOption, ...prev].sort((a,b) => a.label.localeCompare(b.label)));
    }
  };
  
  const handleExport = () => {
    if (sortedAndFilteredMapping.length === 0) {
        toast({
            variant: "destructive",
            title: "Không có dữ liệu",
            description: "Không có dữ liệu trong danh mục để xuất."
        });
        return;
    }
    exportMappingCatalogToExcel(sortedAndFilteredMapping);
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
            handleCancelEdit();
            setSearchTerm('');
            setCurrentPage(1);
        }
        onOpenChange(open);
    }}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Danh mục ánh xạ ({sortedAndFilteredMapping.length} mục)</DialogTitle>
          <DialogDescription>
            Đây là toàn bộ các quy tắc ánh xạ. Tìm kiếm, chỉnh sửa hoặc liên kết với danh mục sản phẩm dùng chung.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Tìm kiếm mã, tên, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
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
        </div>

        <div className="mt-4 h-[60vh] overflow-auto rounded-md border">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                 {columnConfig.filter(c => columnVisibility[c.key as keyof typeof columnVisibility]).map(col => (
                    <SortableHeader key={col.key} sortKey={col.key} className={col.width}>
                        {col.label}
                    </SortableHeader>
                 ))}
                <TableHead className="font-semibold w-[10%] text-center">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length + 1} className="text-center text-muted-foreground h-24">
                    {searchTerm ? "Không tìm thấy kết quả." : "Danh mục của bạn đang trống."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((info) => {
                  const isEditing = editingId === info.id;
                  const currentData = isEditing && editFormData ? editFormData : info;
                  const supplier = info.supplierTaxCode ? suppliers.get(info.supplierTaxCode) : null;
                  
                  return (
                    <TableRow key={info.id}>
                        {columnVisibility.supplierName && <TableCell className="text-xs break-words">
                            {supplier ? supplier.supplierName : <Badge variant="secondary">Chung (Mặc định)</Badge>}
                        </TableCell>}
                        {columnVisibility.originalCode && <TableCell className="font-medium break-words">{info.originalCode || info.id}</TableCell>}
                        {columnVisibility.newName && <TableCell className="break-words">
                            <Input value={currentData?.newName} readOnly={!isEditing} onChange={(e) => handleInputChange('newName', e.target.value)} className={cn("h-8", !isEditing && "border-none bg-transparent p-0")} />
                        </TableCell>}
                        {columnVisibility.newCode && <TableCell className="break-words">
                            {isEditing ? (
                            <Input value={currentData?.newCode} onChange={(e) => handleInputChange('newCode', e.target.value)} className="h-8"/>
                            ) : (
                            currentData?.newCode
                            )}
                        </TableCell>}
                        {columnVisibility.masterCatalogId && <TableCell>
                           {isEditing && currentData ? (
                            <Combobox
                                options={masterCatalogOptions}
                                value={currentData.masterCatalogId || ''}
                                onChange={(value) => handleInputChange('masterCatalogId', value)}
                                placeholder="Chọn mã chung..."
                                searchPlaceholder="Tìm mã hoặc tên..."
                                emptyPlaceholder="Không tìm thấy sản phẩm."
                            />
                            ) : (
                                currentData.masterCatalogId || ''
                            )}
                        </TableCell>}
                        {columnVisibility.originalUnit && <TableCell className="break-words">{currentData?.originalUnit}</TableCell>}
                        {columnVisibility.newUnit && <TableCell>
                         {isEditing && currentData ? (
                           <Combobox
                              options={unitOptions}
                              value={currentData.newUnit}
                              onChange={(value) => handleInputChange('newUnit', value)}
                              onAddOption={handleAddUnit}
                              placeholder="Chọn ĐVT..."
                              searchPlaceholder="Tìm hoặc thêm..."
                              emptyPlaceholder="Không có kết quả."
                            />
                        ) : (
                          currentData?.newUnit
                        )}
                        </TableCell>}
                       {columnVisibility.conversionRate && <TableCell className="text-right break-words">
                         {isEditing ? (
                          <Input type="number" value={currentData?.conversionRate} onChange={(e) => handleInputChange('conversionRate', e.target.value)} className="h-8 text-right"/>
                        ) : (
                          currentData?.conversionRate
                        )}
                        </TableCell>}

                      <TableCell className="text-center">
                      {isEditing ? (
                          <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={handleSaveEdit}>
                              <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-700" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                          </Button>
                          </div>
                      ) : (
                          <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" className="text-primary hover:text-primary/90" onClick={() => handleEdit(info)}>
                              <Pencil className="h-4 w-4" />
                          </Button>
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
                                  Hành động này sẽ xóa vĩnh viễn quy tắc ánh xạ cho mã 
                                  <span className="font-bold text-foreground"> {info.originalCode || info.id} </span>
                                  của nhà cung cấp <span className="font-bold text-foreground">{supplier?.supplierName || 'Chung'}</span>.
                                  Bạn không thể hoàn tác hành động này.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction
                                  onClick={() => onDeleteMapping(info.id)}
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
         <DialogFooter className="mt-4 sm:justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Trang {currentPage} trên {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Sau
              </Button>
            </div>
            <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Xuất ra Excel
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
