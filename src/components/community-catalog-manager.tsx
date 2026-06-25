
'use client';

import { useState, useMemo } from 'react';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { CommunityMapping, User as CustomUser, Supplier, MasterCatalogItem } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, Library, Search, Trash2, AlertTriangle, ArrowUpDown, Pencil, Check, X, Link as LinkIcon } from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { Combobox } from './ui/combobox';


type SortableKeys = keyof CommunityMapping | 'supplierName';

interface CommunityCatalogManagerProps {
  currentUser: CustomUser;
}

export default function CommunityCatalogManager({ currentUser }: CommunityCatalogManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' } | null>({ key: 'updateCount', direction: 'desc' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CommunityMapping> | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  const communityMappingsRef = useMemoFirebase(() => collection(firestore, 'community_mappings'), [firestore]);
  const { data: communityMappings, isLoading: isLoadingMappings } = useCollection<CommunityMapping>(communityMappingsRef);

  const suppliersRef = useMemoFirebase(() => collection(firestore, 'users', currentUser.id, 'suppliers'), [firestore, currentUser.id]);
  const { data: suppliersData } = useCollection<Supplier>(suppliersRef);
  
  const masterCatalogRef = useMemoFirebase(() => collection(firestore, 'master_catalog'), [firestore]);
  const { data: masterCatalogData } = useCollection<MasterCatalogItem>(masterCatalogRef);

  const masterCatalogOptions = useMemo(() => 
    masterCatalogData?.map(item => ({ value: item.id, label: `${item.productName} (${item.id})` })) || []
  , [masterCatalogData]);

  const suppliersMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliersData?.forEach(s => map.set(s.id, s.supplierName));
    return map;
  }, [suppliersData]);

  const sortedAndFilteredMappings = useMemo(() => {
    if (!communityMappings) return [];
    
    let items = [...communityMappings];

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      items = items.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(lowercasedFilter)
        )
      );
    }

    if (sortConfig) {
      items.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'supplierName') {
            valA = a.supplierTaxCode ? suppliersMap.get(a.supplierTaxCode) || '' : '';
            valB = b.supplierTaxCode ? suppliersMap.get(b.supplierTaxCode) || '' : '';
        } else {
            valA = a[sortConfig.key as keyof CommunityMapping];
            valB = b[sortConfig.key as keyof CommunityMapping];
        }

        if (valA == null) return 1;
        if (valB == null) return -1;
        
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else {
            comparison = String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' });
        }
        
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return items;
  }, [communityMappings, searchTerm, sortConfig, suppliersMap]);

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

  const handleEdit = (item: CommunityMapping) => {
    setEditingId(item.id);
    setEditFormData(item);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };
  
  const handleInputChange = (field: keyof CommunityMapping, value: string | number) => {
    if (editFormData) {
      setEditFormData(prev => ({...prev!, [field]: value }));
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editingId || !editFormData) return;
    const docRef = doc(firestore, 'community_mappings', editingId);
    try {
      // Only update the masterCatalogId field
      await setDoc(docRef, { masterCatalogId: editFormData.masterCatalogId || "" }, { merge: true });
      toast({ title: 'Cập nhật thành công!' });
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating master catalog ID:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể cập nhật mã liên kết.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'community_mappings', id));
      toast({ title: 'Đã xóa ánh xạ khỏi danh mục cộng đồng.' });
    } catch (error) {
      console.error("Error deleting community mapping:", error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể xóa ánh xạ.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Library className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight text-primary">
                Danh mục Ánh xạ Cộng đồng
              </CardTitle>
              <CardDescription>
                Các quy tắc ánh xạ được đóng góp bởi tất cả người dùng để tăng tốc độ nhập liệu.
                Hiện có {isLoadingMappings ? "..." : communityMappings?.length ?? 0} quy tắc.
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
              placeholder={`Tìm kiếm trong ${communityMappings?.length ?? 0} quy tắc...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="h-[65vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <SortableHeader sortKey="supplierName" className="w-[15%]">Nhà cung cấp</SortableHeader>
                <SortableHeader sortKey="originalCode" className="w-[12%]">Mã gốc</SortableHeader>
                <SortableHeader sortKey="newName" className="w-[20%]">Tên gợi ý</SortableHeader>
                <SortableHeader sortKey="newCode" className="w-[12%]">Mã gợi ý (Nội bộ)</SortableHeader>
                <SortableHeader sortKey="newUnit" className="w-[8%] text-center">ĐVT Mới</SortableHeader>
                <SortableHeader sortKey="conversionRate" className="w-[8%] text-center">Hệ số QĐ</SortableHeader>
                <SortableHeader sortKey="masterCatalogId" className="w-[15%]">Mã liên kết (Chung)</SortableHeader>
                <SortableHeader sortKey="updateCount" className="w-[5%] text-center">Lượt</SortableHeader>
                {isAdmin && <TableHead className="w-[5%] text-center">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMappings ? (
                <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
              ) : sortedAndFilteredMappings.length > 0 ? (
                sortedAndFilteredMappings.map(item => {
                  const isEditing = isAdmin && editingId === item.id;
                  const currentData = isEditing ? editFormData : item;

                  return (
                  <TableRow key={item.id}>
                    <TableCell><Badge variant="secondary">{item.supplierTaxCode ? (suppliersMap.get(item.supplierTaxCode) || `MST: ${item.supplierTaxCode}`) : 'Chung'}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{item.originalCode}</TableCell>
                    <TableCell>{item.newName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.newCode}</TableCell>
                    <TableCell className="text-center">{item.newUnit}</TableCell>
                    <TableCell className="text-center">{item.conversionRate}</TableCell>
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
                      ) : (
                        item.masterCatalogId || <span className="text-muted-foreground text-xs italic">Chưa liên kết</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center"><Badge>{item.updateCount}</Badge></TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={handleSaveEdit}><Check className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleCancelEdit}><X className="h-4 w-4"/></Button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleEdit(item)}><LinkIcon className="h-4 w-4"/></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/90"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xóa quy tắc này?</AlertDialogTitle>
                                  <AlertDialogDescription>Bạn có chắc muốn xóa vĩnh viễn quy tắc cho mã <span className="font-bold">{item.originalCode}</span>?</AlertDialogDescription>
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
                  </TableRow>
                )})
              ) : (
                <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center text-muted-foreground">{searchTerm ? "Không tìm thấy quy tắc nào." : "Danh mục cộng đồng trống."}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
