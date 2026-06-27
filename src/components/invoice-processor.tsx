

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, setDoc, deleteDoc, writeBatch, getDoc, increment } from 'firebase/firestore';
import Link from 'next/link';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';
import { InvoiceTable } from '@/components/invoice-table';
import { ManualMappingTable } from '@/components/manual-mapping-table';
import { UnmappedSupplierTable } from '@/components/unmapped-supplier-table';
import { MappingCatalogDialog } from '@/components/mapping-catalog-dialog';
import { SupplierCatalogDialog } from '@/components/supplier-catalog-dialog';
import { InvoiceSummary } from '@/components/invoice-summary';
import { AlreadyMappedTable } from '@/components/already-mapped-table';
import { VersionHistoryDialog } from '@/components/version-history-dialog';
import { ComparisonManager } from '@/components/comparison-manager';

import type { InvoiceItem as ParsedInvoiceItem } from '@/types/invoice';
import type { Mapping, Supplier, CommunityMapping, ProcessingItem } from '@/types/firebase';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, FileUp, RefreshCw, BookMarked, Search, Users, LogOut, ShieldCheck, KeyRound, Database, FileText, Save, Archive, LayoutDashboard, History, FilePieChart, AlertTriangle, Sun, Moon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback } from './ui/avatar';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MappingImportDialog } from '@/components/mapping-import-dialog';
import { SupplierImportDialog } from '@/components/supplier-import-dialog';
import { useCatalogImports } from '@/hooks/invoice-processor/use-catalog-imports';
import { useInvoiceAuth } from '@/hooks/invoice-processor/use-invoice-auth';
import { useInvoiceCatalogData } from '@/hooks/invoice-processor/use-invoice-catalog-data';
import { useInvoiceExport } from '@/hooks/invoice-processor/use-invoice-export';
import { useInvoiceFiles } from '@/hooks/invoice-processor/use-invoice-files';
import { useImportSessionSave } from '@/hooks/invoice-processor/use-import-session-save';
import { useThemeMode } from '@/hooks/invoice-processor/use-theme-mode';


// Helper to sanitize document IDs
const sanitizeDocId = (id: string) => id.replace(/\//g, '-');


export default function InvoiceProcessor() {
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [unmappedItems, setUnmappedItems] = useState<Map<string, ProcessingItem>>(new Map());
  const [alreadyMappedItems, setAlreadyMappedItems] = useState<Map<string, ProcessingItem>>(new Map());
  const [unmappedSuppliers, setUnmappedSuppliers] = useState<Map<string, Supplier>>(new Map());
  const [isFindingUnmappedItems, setIsFindingUnmappedItems] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isSupplierCatalogOpen, setIsSupplierCatalogOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  // Search terms for tables
  const [originalDataSearch, setOriginalDataSearch] = useState('');
  const [mappedDataSearch, setMappedDataSearch] = useState('');
  const [unmappedDataSearch, setUnmappedDataSearch] = useState('');
  const [alreadyMappedSearch, setAlreadyMappedSearch] = useState('');
  const [warningDataSearch, setWarningDataSearch] = useState('');
  
  // State for ManualMappingTable
  const [selectedUnmappedId, setSelectedUnmappedId] = useState<string | null>(null);

  const resetProcessingState = useCallback(() => {
    setUnmappedItems(new Map());
    setAlreadyMappedItems(new Map());
    setUnmappedSuppliers(new Map());
  }, []);

  const {
    invoiceData,
    isProcessingFiles,
    processedFileNames,
    warningData,
    handleFileProcessing,
    handleDownloadXml,
    handleDownloadAllWarningXmls,
    resetInvoiceFiles,
  } = useInvoiceFiles({ toast, onResetProcessingState: resetProcessingState });

  const resetWorkspace = useCallback(() => {
    resetInvoiceFiles();
    resetProcessingState();
  }, [resetInvoiceFiles, resetProcessingState]);

  const {
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
  } = useInvoiceAuth({ firestore, toast, onLogout: resetWorkspace });

  const {
    isMappingImportOpen,
    setIsMappingImportOpen,
    mappingFileData,
    isSupplierImportOpen,
    setIsSupplierImportOpen,
    supplierFileData,
    isImportingMappings,
    isImportingSuppliers,
    handleMappingFileSelect,
    handleConfirmMappingImport,
    handleSupplierFileSelect,
    handleConfirmSupplierImport,
  } = useCatalogImports({ currentUser, firestore, toast });

  const {
    mapping,
    supplierMapping,
    masterCatalog,
    isLoadingMappings,
    isLoadingSuppliers,
  } = useInvoiceCatalogData(firestore, currentUser);

  const { handleExport, handleExportViettel } = useInvoiceExport(toast, supplierMapping);

  const mappedData = useMemo(() => {
    return invoiceData.map(item => {
      const sanitizedId = sanitizeDocId(item['Mã hàng']);
      const taxCode = item['Mã số thuế']?.trim();
      const specificId = taxCode ? `${taxCode}-${sanitizedId}` : null;
      
      const mapInfo = (specificId ? mapping.get(specificId) : null) ?? mapping.get(sanitizedId);

      if (mapInfo) {
        const conversionRate = mapInfo.conversionRate || 1;
        return {
          ...item,
          'Mã hàng (gốc)': item['Mã hàng'],
          'Mã hàng': mapInfo.newCode,
          'Tên hàng hóa': mapInfo.newName || item['Tên hàng hóa'],
          'ĐVT': mapInfo.newUnit || item['ĐVT'],
          'Số lượng': item['Số lượng'] * conversionRate,
          'Đơn giá': item['Đơn giá'] / conversionRate,
        };
      }
      return item;
    });
  }, [invoiceData, mapping]);

  const {
    isSavingSession,
    isDuplicateDialogOpen,
    setIsDuplicateDialogOpen,
    duplicateInvoices,
    handleSaveSession,
    handleDuplicateChoice,
  } = useImportSessionSave({
    currentUser,
    firestore,
    mappedData,
    processedFileNames,
    toast,
    onSaveSuccess: resetWorkspace,
  });

 const findUnmappedItems = useCallback(async (invoices: ParsedInvoiceItem[], currentMapping: Map<string, Mapping>) => {
    if (!currentUser || !firestore) return;

    setIsFindingUnmappedItems(true);
    try {
        const newUnmapped = new Map<string, ProcessingItem>();
        const newAlreadyMapped = new Map<string, ProcessingItem>();
        const communityFetchPromises: Promise<void>[] = [];

        const processedOriginalCodes = new Set<string>();

        for (const item of invoices) {
            const itemCode = item['Mã hàng'];
            const taxCode = item['Mã số thuế']?.trim();
            if (!itemCode) continue;

            const specificId = taxCode ? `${taxCode}-${sanitizeDocId(itemCode)}` : null;
            const genericId = sanitizeDocId(itemCode);
            
            const uniqueOriginalKey = specificId || genericId;
            if (processedOriginalCodes.has(uniqueOriginalKey)) {
                continue;
            }

            const existingMapping = (specificId ? currentMapping.get(specificId) : null) ?? currentMapping.get(genericId);
            processedOriginalCodes.add(uniqueOriginalKey);

            const baseItem: Omit<ProcessingItem, 'id'> = {
                originalCode: itemCode,
                originalName: item['Tên hàng hóa'],
                originalUnit: item['ĐVT'],
                ...(taxCode && { supplierTaxCode: taxCode }),
                newCode: '',
                newName: item['Tên hàng hóa'],
                newUnit: item['ĐVT'],
                conversionRate: 1,
            };

            if (existingMapping) {
                newAlreadyMapped.set(existingMapping.id, { ...baseItem, ...existingMapping });
            } else {
                const promise = getDoc(doc(firestore, 'community_mappings', uniqueOriginalKey)).then(communityDoc => {
                    let suggestion: Partial<Mapping> = {};
                    if (communityDoc.exists()) {
                        const communityData = communityDoc.data() as CommunityMapping;
                        // ONLY suggest unit and conversion rate from community
                        suggestion = {
                            newUnit: communityData.newUnit,
                            conversionRate: communityData.conversionRate,
                        };
                    }
                    newUnmapped.set(uniqueOriginalKey, {
                        ...baseItem,
                        id: uniqueOriginalKey,
                        // Let newName default to originalName, and newCode be empty
                        newName: baseItem.newName,
                        newCode: '', 
                        // Apply suggestions only for unit and conversion rate
                        newUnit: suggestion.newUnit || baseItem.newUnit,
                        conversionRate: suggestion.conversionRate || baseItem.conversionRate,
                    });
                }).catch(e => {
                    console.warn("Could not fetch community suggestion for", uniqueOriginalKey, e);
                    newUnmapped.set(uniqueOriginalKey, { ...baseItem, id: uniqueOriginalKey });
                });
                communityFetchPromises.push(promise);
            }
        }

        await Promise.all(communityFetchPromises);
        
        setAlreadyMappedItems(newAlreadyMapped);
        setUnmappedItems(newUnmapped);
    } catch (error) {
        console.error("Error in findUnmappedItems: ", error);
        toast({
            variant: "destructive",
            title: "Lỗi khi đối chiếu mã",
            description: "Đã có lỗi xảy ra trong quá trình tìm mã chưa ánh xạ."
        });
    } finally {
        setIsFindingUnmappedItems(false);
    }
  }, [currentUser, firestore, toast]);

  const findUnmappedSuppliers = useCallback((invoices: ParsedInvoiceItem[], currentSuppliers: Map<string, Supplier>) => {
    const suppliersToProcess = new Map<string, Supplier>();
    const processedTaxIds = new Set<string>();

    invoices.forEach(item => {
      const taxId = item['Mã số thuế']?.trim();
      if (!taxId || processedTaxIds.has(taxId)) return;
      
      processedTaxIds.add(taxId);
      const existingSupplier = currentSuppliers.get(taxId);

      if (!existingSupplier) {
        suppliersToProcess.set(taxId, {
          id: taxId,
          supplierName: item['Nhà cung cấp'] || '',
          supplierCode: '',
        });
      } else if (!existingSupplier.supplierCode || existingSupplier.supplierCode.trim() === '') {
        suppliersToProcess.set(taxId, existingSupplier);
      }
    });
    setUnmappedSuppliers(suppliersToProcess);
  }, []);

  useEffect(() => {
    if (invoiceData.length > 0 && currentUser && firestore && !isLoadingMappings) {
      findUnmappedItems(invoiceData, mapping);
    }
  }, [invoiceData, currentUser, firestore, isLoadingMappings, mapping, findUnmappedItems]);
  
  useEffect(() => {
    if (invoiceData.length > 0 && !isLoadingSuppliers) {
      findUnmappedSuppliers(invoiceData, supplierMapping);
    }
  }, [invoiceData, isLoadingSuppliers, supplierMapping, findUnmappedSuppliers]);

  const handleUpdateUnmappedItem = (updatedItem: { id: string; newValues: Partial<Mapping> }) => {
    const { id, newValues } = updatedItem;
    setUnmappedItems(prev => {
        const newMap = new Map(prev);
        const currentItem = newMap.get(id);
        if (currentItem) {
            newMap.set(id, { ...currentItem, ...newValues });
        }
        return newMap;
    });
  };
  
  const handleUpdateAlreadyMappedItem = (updatedItem: { id: string; newValues: Partial<Mapping> }) => {
    const { id, newValues } = updatedItem;
    
    // Also update the main mapping in memory so the final mapped data is correct
    mapping.set(id, { ...mapping.get(id)!, ...newValues });

    setAlreadyMappedItems(prev => {
        const newMap = new Map(prev);
        const currentItem = newMap.get(id);
        if (currentItem) {
            newMap.set(id, { ...currentItem, ...newValues });
        }
        return newMap;
    });
  };

  const handleUnmapItem = (itemToUnmap: ProcessingItem) => {
    setAlreadyMappedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemToUnmap.id);
        return newMap;
    });
    setUnmappedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(itemToUnmap.id, itemToUnmap);
        return newMap;
    });
    toast({ title: "Đã hủy ánh xạ", description: `Mã "${itemToUnmap.originalCode}" đã được chuyển sang danh sách cần xử lý.` });
  };


  const handleIgnoreUnmappedItem = (id: string) => {
    setUnmappedItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  const handleConfirmManualMappings = async () => {
    if (!currentUser || !firestore) return;
  
    const batch = writeBatch(firestore);
    const mappingsToSave = new Map<string, Mapping>();
  
    unmappedItems.forEach((value, key) => {
      if (value.newCode && value.newCode.trim() !== '') {
        const mappingToSave: Mapping = {
            id: value.id,
            originalCode: value.originalCode,
            originalName: value.originalName,
            newName: value.newName,
            newCode: value.newCode,
            originalUnit: value.originalUnit,
            newUnit: value.newUnit,
            conversionRate: value.conversionRate,
            ...(value.supplierTaxCode && { supplierTaxCode: value.supplierTaxCode }),
        };
        mappingsToSave.set(key, mappingToSave);
      }
    });
  
    if (mappingsToSave.size > 0) {
        for (const [key, value] of mappingsToSave.entries()) {
            const userMappingRef = doc(firestore, 'users', currentUser.id, 'mappings', key);
            batch.set(userMappingRef, value);
            
            const communityMappingRef = doc(firestore, 'community_mappings', key);
            const communityData: Omit<CommunityMapping, 'id' | 'updateCount'> & { updateCount: any } = {
                originalCode: value.originalCode,
                ...(value.supplierTaxCode && { supplierTaxCode: value.supplierTaxCode }),
                newCode: value.newCode,
                newName: value.newName,
                newUnit: value.newUnit,
                conversionRate: value.conversionRate,
                updateCount: increment(1)
            };
            batch.set(communityMappingRef, communityData, { merge: true });
        }
  
      await batch.commit()
        .then(() => {
          setUnmappedItems(prev => {
            const remaining = new Map(prev);
            mappingsToSave.forEach((_, key) => remaining.delete(key));
            return remaining;
          });
          setAlreadyMappedItems(prev => {
              const newMap = new Map(prev);
              mappingsToSave.forEach((value, key) => newMap.set(key, value as ProcessingItem));
              return newMap;
          });
      
          toast({
            title: "Cập nhật danh mục thành công",
            description: `Đã thêm ${mappingsToSave.size} ánh xạ mới.`
          });
        })
        .catch(error => {
          const permissionError = new FirestorePermissionError({
            path: `batch write to mappings and community_mappings`,
            operation: 'write',
          });
          errorEmitter.emit('permission-error', permissionError);
        });

    } else {
      toast({
        variant: "destructive",
        title: "Chưa có thay đổi",
        description: "Bạn cần nhập 'Mã ánh xạ mới' để cập nhật."
      });
    }
  };

  const handleUpdateUnmappedSupplier = (taxId: string, field: keyof Supplier, value: string) => {
    setUnmappedSuppliers(prev => {
        const newMap = new Map(prev);
        const supplier = newMap.get(taxId);
        if (supplier) {
            newMap.set(taxId, { ...supplier, [field]: value });
        }
        return newMap;
    });
  };


  const handleConfirmUnmappedSuppliers = async () => {
    if (!currentUser || !firestore) return;

    const suppliersToUpdate = Array.from(unmappedSuppliers.values()).filter(
      s => s.supplierCode && s.supplierCode.trim() !== '' && s.supplierName && s.supplierName.trim() !== ''
    );
    if (suppliersToUpdate.length === 0) {
      toast({
        variant: "destructive",
        title: "Chưa có thay đổi",
        description: "Bạn cần nhập 'Mã nhà cung cấp' và đảm bảo 'Tên NCC' không trống để cập nhật.",
      });
      return;
    }

    const batch = writeBatch(firestore);
    suppliersToUpdate.forEach(supplier => {
      const docRef = doc(firestore, 'users', currentUser.id, 'suppliers', supplier.id);
      batch.set(docRef, supplier, { merge: true });
    });

    await batch.commit()
      .then(() => {
        setUnmappedSuppliers(new Map());
        toast({
          title: "Cập nhật thành công",
          description: `Đã cập nhật thông tin cho ${suppliersToUpdate.length} nhà cung cấp.`,
        });
      })
      .catch(error => {
        const permissionError = new FirestorePermissionError({
            path: `batch write to users/${currentUser.id}/suppliers`,
            operation: 'write'
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!currentUser || !firestore) return;
    const docRef = doc(firestore, 'users', currentUser.id, 'mappings', mappingId);

    deleteDoc(docRef)
      .then(() => {
        toast({
          title: "Đã xóa ánh xạ",
          description: `Đã xóa quy tắc ánh xạ: ${mappingId}`
        });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };
  
  const handleUpdateMappingInCatalog = async (mappingId: string, newValues: Mapping) => {
    if (!currentUser || !firestore) return;

    const docRef = doc(firestore, 'users', currentUser.id, 'mappings', mappingId);
    
    const finalValues = { ...newValues, id: mappingId };

    setDoc(docRef, finalValues, { merge: true })
      .then(() => {
        toast({
            title: "Cập nhật thành công",
            description: `Đã cập nhật quy tắc ánh xạ cho: ${mappingId}`
        });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: finalValues,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    if (!currentUser || !firestore) return;
    const docRef = doc(firestore, 'users', currentUser.id, 'suppliers', newSupplier.id);
    
    setDoc(docRef, newSupplier)
      .then(() => {
        toast({
            title: "Thêm thành công",
            description: `Đã thêm nhà cung cấp mới: ${newSupplier.supplierName}`
        });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: newSupplier,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDeleteSupplier = async (taxId: string) => {
    if (!currentUser || !firestore) return;
    const docRef = doc(firestore, 'users', currentUser.id, 'suppliers', taxId);

    deleteDoc(docRef)
      .then(() => {
        toast({
            title: "Đã xóa nhà cung cấp",
            description: `Đã xóa nhà cung cấp có MST: ${taxId}`
        });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleUpdateSupplier = async (originalTaxId: string, newValues: Supplier) => {
    if (!currentUser || !firestore) return;
    
    if (originalTaxId !== newValues.id) {
      const batch = writeBatch(firestore);
      const oldDocRef = doc(firestore, 'users', currentUser.id, 'suppliers', originalTaxId);
      const newDocRef = doc(firestore, 'users', currentUser.id, 'suppliers', newValues.id);
      
      batch.delete(oldDocRef);
      batch.set(newDocRef, newValues);
      
      batch.commit()
        .then(() => {
           toast({
              title: "Cập nhật thành công",
              description: `Đã cập nhật thông tin cho nhà cung cấp: ${newValues.supplierName}`
          });
        })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: newDocRef.path,
              operation: 'write',
              requestResourceData: newValues,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
      const docRef = doc(firestore, 'users', currentUser.id, 'suppliers', newValues.id);
      setDoc(docRef, newValues, { merge: true })
        .then(() => {
          toast({
              title: "Cập nhật thành công",
              description: `Đã cập nhật thông tin cho nhà cung cấp: ${newValues.supplierName}`
          });
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: newValues,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const currentUnmappedList = useMemo(() => {
    let list = Array.from(unmappedItems.values());
    if (unmappedDataSearch) {
      const lowercasedFilter = unmappedDataSearch.toLowerCase();
      list = list.filter(item => 
        (item.originalCode || '').toLowerCase().includes(lowercasedFilter) ||
        (item.newName || '').toLowerCase().includes(lowercasedFilter)
      );
    }
    return list;
  }, [unmappedItems, unmappedDataSearch]);
  
   const currentAlreadyMappedList = useMemo(() => {
    let list = Array.from(alreadyMappedItems.values());
    if (alreadyMappedSearch) {
      const lowercasedFilter = alreadyMappedSearch.toLowerCase();
      list = list.filter(item =>
        (item.originalCode || '').toLowerCase().includes(lowercasedFilter) ||
        (item.newName || '').toLowerCase().includes(lowercasedFilter) ||
        (item.newCode || '').toLowerCase().includes(lowercasedFilter)
      );
    }
    return list;
  }, [alreadyMappedItems, alreadyMappedSearch]);

  const AuthComponent = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const onLoginClick = async () => {
        setIsLoggingIn(true);
        await handleAuthAction('login', { username, password });
        setIsLoggingIn(false);
    }

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>Chào mừng bạn</CardTitle>
                <CardDescription>Đăng nhập để tiếp tục</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input id="username" type="text" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
            </CardContent>
             <CardFooter className="flex flex-col gap-4">
                <Button onClick={onLoginClick} className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng nhập
                </Button>
                <p className="text-xs text-muted-foreground text-center w-full pt-2">
                    Dữ liệu của bạn được lưu trữ an toàn và riêng tư.
                </p>
            </CardFooter>
        </Card>
      </div>
    );
  };
  
  const canSaveSession = useMemo(() => {
    return invoiceData.length > 0 && currentUnmappedList.length === 0 && unmappedSuppliers.size === 0;
  }, [invoiceData, currentUnmappedList, unmappedSuppliers]);
  
  if (isAuthLoading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Đang tải...</p>
        </div>
    )
  }

  if (!currentUser) {
    return <AuthComponent />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300 pb-16">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-md">
               X
             </div>
             <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
               XML Invoice Pro
             </span>
          </div>
          
          <div className="flex items-center gap-4">
             <nav className="hidden md:flex items-center gap-2">
                {currentUser.role === 'ADMIN' && (
                    <Link href="/admin">
                        <Button variant="ghost" size="sm" className="font-medium">
                            <ShieldCheck className="mr-1.5 h-4 w-4 text-primary" />
                            Quản trị
                        </Button>
                    </Link>
                )}
                 <Link href="/accounts">
                    <Button variant="ghost" size="sm" className="font-medium">
                        <FileText className="mr-1.5 h-4 w-4 text-primary" />
                        Tài khoản
                    </Button>
                </Link>
                <Link href="/catalogs">
                    <Button variant="ghost" size="sm" className="font-medium">
                        <Database className="mr-1.5 h-4 w-4 text-primary" />
                        Danh mục
                    </Button>
                </Link>
                 <Link href="/data">
                    <Button variant="ghost" size="sm" className="font-medium">
                        <Archive className="mr-1.5 h-4 w-4 text-primary" />
                        Dữ liệu
                    </Button>
                </Link>
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="font-medium">
                        <LayoutDashboard className="mr-1.5 h-4 w-4 text-primary" />
                        Dashboard
                    </Button>
                </Link>
                 <Link href="/tax-report">
                    <Button variant="ghost" size="sm" className="font-medium">
                        <FilePieChart className="mr-1.5 h-4 w-4 text-primary" />
                        Báo cáo Thuế
                    </Button>
                </Link>
             </nav>
             
             <div className="h-6 w-px bg-border/60 hidden md:block"></div>
             
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={toggleDarkMode}>
               {isDarkMode ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4 text-primary" />}
             </Button>

             {currentUser && (
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="font-semibold text-sm leading-none">{currentUser.fullName || currentUser.username}</p>
                        <p className='text-xs text-muted-foreground mt-1'>{currentUser.role}</p>
                    </div>
                    <Avatar className="h-8 w-8 shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                          {(currentUser.fullName || currentUser.username || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                     <Button variant="outline" size="sm" className="h-8 hidden lg:flex" onClick={() => setIsPasswordDialogOpen(true)}>
                        <KeyRound className="mr-1.5 h-3.5 w-3.5"/>
                        Đổi mật khẩu
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleAuthAction('logout')}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 space-y-8 flex-1">
      {isMappingImportOpen && mappingFileData && (
        <MappingImportDialog
          isOpen={isMappingImportOpen}
          onOpenChange={setIsMappingImportOpen}
          excelData={mappingFileData}
          onConfirm={handleConfirmMappingImport}
          isImporting={isImportingMappings}
        />
      )}
      
      {isSupplierImportOpen && supplierFileData && (
        <SupplierImportDialog
          isOpen={isSupplierImportOpen}
          onOpenChange={setIsSupplierImportOpen}
          excelData={supplierFileData}
          onConfirm={handleConfirmSupplierImport}
          isImporting={isImportingSuppliers}
        />
      )}
      
      <MappingCatalogDialog 
        isOpen={isCatalogOpen} 
        onOpenChange={setIsCatalogOpen}
        mapping={mapping}
        onDeleteMapping={handleDeleteMapping}
        onUpdateMapping={handleUpdateMappingInCatalog}
        suppliers={supplierMapping}
        masterCatalog={masterCatalog}
      />
      <SupplierCatalogDialog
        isOpen={isSupplierCatalogOpen}
        onOpenChange={setIsSupplierCatalogOpen}
        supplierMapping={supplierMapping}
        onAddSupplier={handleAddSupplier}
        onDeleteSupplier={handleDeleteSupplier}
        onUpdateSupplier={handleUpdateSupplier}
      />
      
      
      <VersionHistoryDialog
          isOpen={isVersionHistoryOpen}
          onOpenChange={setIsVersionHistoryOpen}
          userRole={currentUser.role}
      />


       <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu mới cho tài khoản của bạn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-pw" className="text-right">
                Mật khẩu mới
              </Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirm-pw" className="text-right">
                Xác nhận
              </Label>
              <Input id="confirm-pw" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword}>
              {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive h-6 w-6" />
                        Phát hiện Hóa đơn Trùng lặp
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                       Hệ thống đã tìm thấy {duplicateInvoices.length} hóa đơn trong tệp của bạn đã tồn tại trong lịch sử. Bạn muốn làm gì?
                       <div className="mt-2 max-h-32 overflow-y-auto rounded-md border bg-muted p-2 text-sm text-foreground">
                        {duplicateInvoices.map(inv => <div key={inv.id}>- HĐ: {inv.id} (NCC: {inv.sellerName})</div>)}
                      </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm text-muted-foreground">
                   <p>Vui lòng chọn một hành động để tiếp tục.</p>
                 </div>
                <AlertDialogFooter>
                    <Button variant="outline" onClick={() => handleDuplicateChoice('cancel')}>Hủy bỏ</Button>
                    <Button variant="secondary" onClick={() => handleDuplicateChoice('skip')}>Chỉ lưu HĐ mới</Button>
                    <Button variant="destructive" onClick={() => handleDuplicateChoice('overwrite')}>Xóa cũ & Lưu mới</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


      {/* ---===[ KHU VỰC 1: TẢI TỆP ]===--- */}
      <Card className="w-full shadow-lg border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center pb-6 border-b border-border/40">
          <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-500 to-accent bg-clip-text text-transparent pt-4">
            CHƯƠNG TRÌNH QUẢN LÝ NHẬP HÀNG BẰNG XML
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground mt-2">
            Tải lên các tệp XML hóa đơn, tệp ánh xạ và tệp nhà cung cấp để bắt đầu đối chiếu dữ liệu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Cột 1: Tải hóa đơn */}
          <div className="flex flex-col bg-background/50 hover:bg-background/80 border border-border/60 hover:border-primary/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group h-full justify-between">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center justify-center text-xs font-bold w-6 h-6 rounded-full bg-primary/10 text-primary">1</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-secondary/60 px-2 py-0.5 rounded-full">Hóa đơn</span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Hóa đơn XML/ZIP</h3>
              <p className="text-xs text-muted-foreground">Tải lên tệp .xml lẻ hoặc tệp nén .zip chứa nhiều hóa đơn để hệ thống xử lý hàng loạt.</p>
            </div>
            <FileUploader
              id="xml-invoices"
              onFilesSelected={handleFileProcessing}
              acceptedFileTypes=".xml,.zip"
              uploadIcon={<FileUp className="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110" />}
              buttonText="Chọn tệp XML hoặc ZIP"
              dragText="Kéo thả tệp XML/ZIP"
            />
          </div>

          {/* Cột 2: Tệp ánh xạ */}
          <div className="flex flex-col bg-background/50 hover:bg-background/80 border border-border/60 hover:border-accent/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group h-full justify-between">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center justify-center text-xs font-bold w-6 h-6 rounded-full bg-accent/10 text-accent">2</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-secondary/60 px-2 py-0.5 rounded-full">Danh mục</span>
              </div>
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">Tệp ánh xạ (Excel)</h3>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-lg border-accent/20 hover:bg-accent/10 hover:text-accent shrink-0 gap-1" onClick={() => setIsCatalogOpen(true)}>
                  <BookMarked className="h-3.5 w-3.5" />
                  Xem ({mapping.size})
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Ánh xạ mã nhà cung cấp sang mã nội bộ, đối chiếu danh mục vật tư.</p>
            </div>
            <FileUploader
              id="mapping"
              onFilesSelected={handleMappingFileSelect}
              acceptedFileTypes=".xlsx, .xls"
              multiple={false}
              uploadIcon={<FileUp className="h-10 w-10 text-accent transition-transform duration-300 group-hover:scale-110" />}
              buttonText="Chọn tệp Excel"
              dragText="Kéo thả tệp ánh xạ"
            />
          </div>

          {/* Cột 3: Tệp nhà cung cấp */}
          <div className="flex flex-col bg-background/50 hover:bg-background/80 border border-border/60 hover:border-emerald-500/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group h-full justify-between">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center justify-center text-xs font-bold w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">3</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-secondary/60 px-2 py-0.5 rounded-full">Đối tác</span>
              </div>
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-base font-semibold text-foreground group-hover:text-emerald-500 transition-colors">Tệp nhà cung cấp</h3>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-lg border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0 gap-1" onClick={() => setIsSupplierCatalogOpen(true)}>
                  <Users className="h-3.5 w-3.5" />
                  Xem ({supplierMapping.size})
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Tệp danh sách đối tác Excel chứa mã số thuế và thông tin định danh.</p>
            </div>
            <FileUploader 
              id="supplier"
              onFilesSelected={handleSupplierFileSelect}
              acceptedFileTypes=".xlsx, .xls"
              multiple={false}
              uploadIcon={<Users className="h-10 w-10 text-emerald-600 dark:text-emerald-400 transition-transform duration-300 group-hover:scale-110" />}
              buttonText="Chọn tệp Excel"
              dragText="Kéo thả tệp NCC"
            />
          </div>
        </CardContent>
         <CardFooter className="justify-end">
            <Button variant="link" size="sm" onClick={() => setIsVersionHistoryOpen(true)}>
                <History className="mr-2 h-4 w-4"/>
                Xem lịch sử cập nhật
            </Button>
        </CardFooter>
      </Card>

      {(isProcessingFiles || isFindingUnmappedItems) && (
        <Card>
          <CardHeader>
            <CardTitle>{isProcessingFiles ? 'Đang xử lý tệp...' : 'Đang tìm và đối chiếu mã...'}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center p-8">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}
      
      {!isProcessingFiles && !isFindingUnmappedItems && unmappedSuppliers.size > 0 && (
        <Card className="shadow-lg border-amber-500/20 bg-amber-500/[0.02] dark:bg-amber-950/[0.03] backdrop-blur-sm">
          <CardHeader className="border-b border-amber-500/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  Xử lý Nhà cung cấp cần bổ sung
                  <span className="flex h-5 px-2 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                    {unmappedSuppliers.size}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Các nhà cung cấp này được tìm thấy trong hóa đơn nhưng chưa có trong danh mục hoặc thiếu mã.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <UnmappedSupplierTable 
              suppliers={Array.from(unmappedSuppliers.values())}
              onUpdate={handleUpdateUnmappedSupplier}
              supplierMapping={supplierMapping}
            />
          </CardContent>
          <CardFooter className="border-t border-amber-500/10 pt-4 justify-end">
            <Button onClick={handleConfirmUnmappedSuppliers} className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm rounded-lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Lưu thông tin NCC
            </Button>
          </CardFooter>
        </Card>
      )}

      {!isProcessingFiles && !isFindingUnmappedItems && currentUnmappedList.length > 0 && (
        <Card className="shadow-lg border-rose-500/20 bg-rose-500/[0.01] dark:bg-rose-950/[0.02] backdrop-blur-sm">
            <CardHeader className="border-b border-rose-500/10 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-5 w-5 animate-bounce" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                          Xử lý mã chưa được ánh xạ
                          <span className="flex h-5 px-2 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400">
                            {currentUnmappedList.length}
                          </span>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          Các mã hàng này chưa có trong danh mục. Hãy điền thông tin và cập nhật để mở khóa hoàn tất.
                        </CardDescription>
                      </div>
                    </div>
                     <div className="relative w-full sm:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input 
                             placeholder="Tìm kiếm mã hoặc tên..."
                             value={unmappedDataSearch}
                             onChange={(e) => setUnmappedDataSearch(e.target.value)}
                             className="pl-10 border-rose-500/20 focus-visible:ring-rose-500"
                         />
                     </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <ManualMappingTable 
                    items={currentUnmappedList}
                    onUpdate={handleUpdateUnmappedItem}
                    onIgnore={handleIgnoreUnmappedItem}
                    selectedId={selectedUnmappedId}
                    onSelectRow={setSelectedUnmappedId}
                    masterCatalog={masterCatalog}
                />
            </CardContent>
            <CardFooter className="border-t border-rose-500/10 pt-4 justify-end">
                <Button onClick={handleConfirmManualMappings} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm rounded-lg">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Cập nhật danh mục
                </Button>
            </CardFooter>
        </Card>
      )}

      {!isProcessingFiles && !isFindingUnmappedItems && currentAlreadyMappedList.length > 0 && (
        <Card className="shadow-lg border-emerald-500/20 bg-emerald-500/[0.01] dark:bg-emerald-950/[0.02] backdrop-blur-sm">
            <CardHeader className="border-b border-emerald-500/10 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                          Các mã đã được ánh xạ
                          <span className="flex h-5 px-2 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {currentAlreadyMappedList.length}
                          </span>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                           Các mã này đã được tự động ánh xạ. Bạn có thể xem lại và chỉnh sửa nếu cần.
                        </CardDescription>
                      </div>
                    </div>
                     <div className="relative w-full sm:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input 
                             placeholder="Tìm kiếm mã hoặc tên..."
                             value={alreadyMappedSearch}
                             onChange={(e) => setAlreadyMappedSearch(e.target.value)}
                             className="pl-10 border-emerald-500/20 focus-visible:ring-emerald-500"
                         />
                     </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <AlreadyMappedTable
                    items={currentAlreadyMappedList}
                    onUpdate={handleUpdateAlreadyMappedItem}
                    onUnmap={handleUnmapItem}
                    masterCatalog={masterCatalog}
                />
            </CardContent>
             <CardFooter className="border-t border-emerald-500/10 pt-4 justify-end">
                <Button onClick={() => {
                  const updates = Array.from(alreadyMappedItems.values());
                  const batch = writeBatch(firestore);
                  updates.forEach(item => {
                    const docRef = doc(firestore, 'users', currentUser!.id, 'mappings', item.id);
                    batch.set(docRef, item);
                  });
                  batch.commit().then(() => {
                    toast({title: 'Đã lưu các thay đổi.'})
                  }).catch(e => {
                    toast({variant: 'destructive', title: 'Lỗi', description: 'Không thể lưu thay đổi.'})
                  })
                }} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm rounded-lg">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Lưu các thay đổi
                </Button>
            </CardFooter>
        </Card>
      )}


      {!isProcessingFiles && invoiceData.length > 0 && (
        <Tabs defaultValue="mapped" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-5 p-1 bg-muted/60 backdrop-blur-sm rounded-xl border border-border/40 h-auto gap-1">
            <TabsTrigger 
              value="summary"
              className="rounded-lg transition-all py-2.5 text-sm font-medium hover:bg-background/40 hover:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Thống kê hóa đơn
            </TabsTrigger>
            <TabsTrigger 
              value="comparison"
              className="rounded-lg transition-all py-2.5 text-sm font-medium hover:bg-background/40 hover:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Đối chiếu bảng kê
            </TabsTrigger>
            <TabsTrigger 
              value="mapped"
              className="rounded-lg transition-all py-2.5 text-sm font-medium hover:bg-background/40 hover:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Dữ liệu đã ánh xạ
            </TabsTrigger>
            <TabsTrigger 
              value="original"
              className="rounded-lg transition-all py-2.5 text-sm font-medium hover:bg-background/40 hover:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Dữ liệu gốc
            </TabsTrigger>
            <TabsTrigger 
              value="warning" 
              className={`relative flex items-center justify-center gap-1.5 rounded-lg transition-all py-2.5 text-sm font-medium hover:bg-background/40 data-[state=active]:shadow-sm ${
                warningData.length > 0 
                  ? "text-rose-500 border border-rose-500/30 bg-rose-500/5 shadow-[0_0_8px_rgba(239,68,68,0.2)] dark:shadow-[0_0_12px_rgba(239,68,68,0.15)] data-[state=active]:bg-rose-500/10 data-[state=active]:border-rose-500/40" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/20"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 ${warningData.length > 0 ? "animate-bounce" : ""}`} />
              Cảnh báo
              {warningData.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white animate-pulse">
                  {warningData.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <InvoiceSummary data={invoiceData} />
          </TabsContent>
           <TabsContent value="comparison">
            <ComparisonManager xmlInvoiceData={invoiceData} supplierMapping={supplierMapping} />
          </TabsContent>
          <TabsContent value="original">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                       <CardTitle>Dữ liệu gốc</CardTitle>
                        <CardDescription>
                          Tìm thấy {invoiceData.length} mặt hàng từ các tệp XML.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Tìm kiếm trong bảng..."
                            value={originalDataSearch}
                            onChange={(e) => setOriginalDataSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <InvoiceTable data={invoiceData} searchTerm={originalDataSearch} />
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleExport(invoiceData, 'goc')} className="ml-auto bg-gray-500 hover:bg-gray-600">
                  <Download className="mr-2 h-4 w-4" />
                  Xuất dữ liệu gốc
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="mapped">
            <Card className="shadow-lg">
              <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <CardTitle>Dữ liệu đã ánh xạ</CardTitle>
                        <CardDescription>
                          Hiển thị {mappedData.length} mặt hàng sau khi áp dụng {mapping.size} quy tắc ánh xạ.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Tìm kiếm trong bảng..."
                            value={mappedDataSearch}
                            onChange={(e) => setMappedDataSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <InvoiceTable data={mappedData} searchTerm={mappedDataSearch} />
              </CardContent>
              <CardFooter>
                <div className="ml-auto flex gap-2">
                    <Button onClick={() => handleExport(mappedData, 'anhxa')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Download className="mr-2 h-4 w-4" />
                      Xuất dữ liệu đã ánh xạ
                    </Button>
                    <Button onClick={() => handleExportViettel(mappedData)} variant="destructive">
                      <Download className="mr-2 h-4 w-4" />
                      Xuất mẫu Viettel
                    </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="warning">
            <Card className="shadow-lg border-destructive/20">
              <CardHeader className="bg-destructive/5 border-b border-destructive/10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                       <CardTitle className="text-destructive flex items-center gap-2">
                         <AlertTriangle className="h-5 w-5" />
                         Cảnh báo số lô / hạn dùng
                       </CardTitle>
                        <CardDescription>
                          Hiển thị danh sách các sản phẩm (số lượng &gt; 0) chưa đọc được Số lô hoặc Hạn dùng từ tệp XML.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Tìm kiếm mặt hàng..."
                            value={warningDataSearch}
                            onChange={(e) => setWarningDataSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button
                      onClick={handleDownloadAllWarningXmls}
                      disabled={warningData.length === 0}
                      variant="destructive"
                      className="w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Tải tất cả XML cảnh báo
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <InvoiceTable data={warningData} searchTerm={warningDataSearch} showFileName={true} onDownloadXml={handleDownloadXml} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {invoiceData.length > 0 && (
        <Card className="shadow-lg border-primary/20 bg-primary/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <Save className="h-5 w-5 animate-pulse" />
              Hoàn tất & Lưu trữ
            </CardTitle>
            <CardDescription className="text-sm">
              Sau khi đã ánh xạ tất cả các mã và nhà cung cấp, hãy lưu kết quả vào lịch sử nhập hàng của hệ thống.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-0">
            <Button 
              onClick={handleSaveSession}
              disabled={!canSaveSession || isSavingSession}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md px-6 rounded-lg transition-all"
            >
              {isSavingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Hoàn tất & Lưu vào Lịch sử
            </Button>
            {!canSaveSession && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 animate-bounce">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Vui lòng xử lý hết các mục chưa ánh xạ và nhà cung cấp cần bổ sung trước khi lưu.
              </p>
            )}
          </CardFooter>
        </Card>
      )}
      </div>
    </div>
  );
}
