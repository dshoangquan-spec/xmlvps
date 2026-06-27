'use client';

import { useState } from 'react';
import { doc, writeBatch, type Firestore } from 'firebase/firestore';
import { read, utils, type WorkBook } from 'xlsx';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { processMappingFile, type ColumnMap as MappingColumnMap } from '@/lib/mapping-parser';
import { processSupplierFile, type ColumnMap as SupplierColumnMap } from '@/lib/supplier-parser';
import type { ExcelData } from '@/components/mapping-import-dialog';
import type { useToast } from '@/hooks/use-toast';
import type { User as CustomUser } from '@/types/firebase';

type Toast = ReturnType<typeof useToast>['toast'];

interface UseCatalogImportsOptions {
  currentUser: CustomUser | null;
  firestore: Firestore;
  toast: Toast;
}

export function useCatalogImports({ currentUser, firestore, toast }: UseCatalogImportsOptions) {
  const [isMappingImportOpen, setIsMappingImportOpen] = useState(false);
  const [mappingFileData, setMappingFileData] = useState<ExcelData | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [isSupplierImportOpen, setIsSupplierImportOpen] = useState(false);
  const [supplierFileData, setSupplierFileData] = useState<ExcelData | null>(null);
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [isImportingMappings, setIsImportingMappings] = useState(false);
  const [isImportingSuppliers, setIsImportingSuppliers] = useState(false);

  const readExcelPreview = (file: File, onPreview: (data: ExcelData) => void, emptyDescription?: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook: WorkBook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 1) {
          toast({ variant: "destructive", title: "Tệp Excel trống", description: emptyDescription });
          return;
        }

        const headers = jsonData[0].map(h => String(h));
        const preview = jsonData.slice(1, 6);
        onPreview({ headers, preview });
      } catch (error) {
        toast({ variant: "destructive", title: "Lỗi đọc tệp Excel", description: "Không thể đọc hoặc phân tích tệp." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setMappingFile(file);

    readExcelPreview(file, (excelData) => {
      setMappingFileData(excelData);
      setIsMappingImportOpen(true);
    }, "Tệp không có dữ liệu.");
  };

  const handleConfirmMappingImport = async (columnMap: MappingColumnMap) => {
    if (!mappingFile || !currentUser || !firestore) return;
    setIsImportingMappings(true);

    try {
      const newMappingFromFile = await processMappingFile(mappingFile, columnMap);

      const batch = writeBatch(firestore);
      newMappingFromFile.forEach((value, key) => {
        const docRef = doc(firestore, 'users', currentUser.id, 'mappings', key);
        batch.set(docRef, { ...value, id: key });
      });

      await batch.commit()
        .then(() => {
          toast({
            title: 'Tải tệp ánh xạ thành công',
            description: `Đã tải lên và lưu ${newMappingFromFile.size} ánh xạ vào cơ sở dữ liệu.`,
          });
          setMappingFile(null);
          setMappingFileData(null);
          setIsMappingImportOpen(false);
        })
        .catch(error => {
          const permissionError = new FirestorePermissionError({
            path: `batch write to users/${currentUser.id}/mappings`,
            operation: 'write',
            requestResourceData: { info: `Importing ${newMappingFromFile.size} mappings` },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi xử lý tệp ánh xạ',
        description: e.message,
      });
    } finally {
      setIsImportingMappings(false);
    }
  };

  const handleSupplierFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSupplierFile(file);

    readExcelPreview(file, (excelData) => {
      setSupplierFileData(excelData);
      setIsSupplierImportOpen(true);
    });
  };

  const handleConfirmSupplierImport = async (columnMap: SupplierColumnMap) => {
    if (!supplierFile || !currentUser || !firestore) return;
    setIsImportingSuppliers(true);

    try {
      const newSuppliers = await processSupplierFile(supplierFile, columnMap);
      const batch = writeBatch(firestore);
      newSuppliers.forEach((value, key) => {
        const docRef = doc(firestore, 'users', currentUser.id, 'suppliers', key);
        batch.set(docRef, { ...value, id: key });
      });

      await batch.commit()
        .then(() => {
          toast({
            title: 'Tải tệp nhà cung cấp thành công',
            description: `Đã tải lên và lưu ${newSuppliers.size} nhà cung cấp.`,
          });
          setSupplierFile(null);
          setSupplierFileData(null);
          setIsSupplierImportOpen(false);
        })
        .catch(error => {
          const permissionError = new FirestorePermissionError({
            path: `batch write to users/${currentUser.id}/suppliers`,
            operation: 'write',
            requestResourceData: { info: `Importing ${newSuppliers.size} suppliers` },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Lỗi xử lý tệp nhà cung cấp',
        description: e.message,
      });
    } finally {
      setIsImportingSuppliers(false);
    }
  };

  return {
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
  };
}
