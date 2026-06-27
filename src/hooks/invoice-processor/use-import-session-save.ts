'use client';

import { useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch, type Firestore } from 'firebase/firestore';
import { format, isValid, parse } from 'date-fns';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { useToast } from '@/hooks/use-toast';
import type { ImportSession, Invoice, InvoiceItem, User as CustomUser } from '@/types/firebase';
import type { InvoiceItem as ParsedInvoiceItem } from '@/types/invoice';

type Toast = ReturnType<typeof useToast>['toast'];

const sanitizeDocId = (id: string) => id.replace(/\//g, '-');

interface UseImportSessionSaveOptions {
  currentUser: CustomUser | null;
  firestore: Firestore;
  mappedData: ParsedInvoiceItem[];
  processedFileNames: string[];
  toast: Toast;
  onSaveSuccess: () => void;
}

function createInvoiceIdentifier(invoiceNum: string, date: string, taxCode: string) {
  try {
    const parsedDate = parse(date, 'dd/MM/yyyy', new Date());
    if (isValid(parsedDate)) {
      const isoDate = format(parsedDate, 'yyyy-MM-dd');
      return `${invoiceNum}_${isoDate}_${taxCode}`;
    }
  } catch (e) {
    // Fallback for invalid date format.
  }
  return `${invoiceNum}_${date}_${taxCode}`;
}

function buildInvoiceHeaders(mappedData: ParsedInvoiceItem[]) {
  const invoices = new Map<string, Omit<Invoice, 'id'>>();
  const uniqueIdentifiers = new Set<string>();

  mappedData.forEach(item => {
    const invoiceNum = item['Số hóa đơn'];
    if (!invoices.has(invoiceNum)) {
      const identifier = createInvoiceIdentifier(invoiceNum, item['Ngày hóa đơn'], item['Mã số thuế']);
      uniqueIdentifiers.add(identifier);
      invoices.set(invoiceNum, {
        importSessionId: '',
        provider: item['Nhà cung cấp'],
        invoiceDate: item['Ngày hóa đơn'],
        sellerName: item['Nhà cung cấp'],
        sellerTaxCode: item['Mã số thuế'],
        sellerAddress: item['Địa chỉ'],
        buyerName: item['Nhà thuốc'],
        fileName: item['Tên file'],
        portalLink: item['Link truy cập'],
        accessCode: item['Mã truy cập'],
      });
    }
  });

  return { invoices, uniqueIdentifiers };
}

export function useImportSessionSave({
  currentUser,
  firestore,
  mappedData,
  processedFileNames,
  toast,
  onSaveSuccess,
}: UseImportSessionSaveOptions) {
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateInvoices, setDuplicateInvoices] = useState<Invoice[]>([]);

  const executeSave = async (invoicesToSave: Map<string, Omit<Invoice, 'id'>>, invoicesToDelete: Invoice[] = []) => {
    if (!currentUser || !firestore) return;
    setIsSavingSession(true);
    const now = new Date();

    const sessionRef = doc(collection(firestore, 'users', currentUser.id, 'import_sessions'));
    const sessionId = sessionRef.id;

    const newSession: Omit<ImportSession, 'id'> = {
      userId: currentUser.id,
      importDate: now.toISOString(),
      fileNames: processedFileNames,
      invoiceCount: invoicesToSave.size,
      itemCount: mappedData.filter(item => invoicesToSave.has(item['Số hóa đơn'])).length,
    };

    const batch = writeBatch(firestore);

    for (const invToDelete of invoicesToDelete) {
      const invoiceDocRef = doc(firestore, 'users', currentUser.id, 'invoices', invToDelete.id);
      const itemsSnapshot = await getDocs(collection(invoiceDocRef, 'items'));
      itemsSnapshot.forEach(itemDoc => batch.delete(itemDoc.ref));
      batch.delete(invoiceDocRef);
    }

    batch.set(sessionRef, newSession);

    invoicesToSave.forEach((invoiceHeader, invoiceNum) => {
      const sanitizedInvoiceNum = sanitizeDocId(invoiceNum);
      const invoiceDocRef = doc(firestore, 'users', currentUser.id, 'invoices', sanitizedInvoiceNum);

      const uniqueId = createInvoiceIdentifier(invoiceNum, invoiceHeader.invoiceDate, invoiceHeader.sellerTaxCode);
      batch.set(invoiceDocRef, { ...invoiceHeader, id: invoiceNum, uniqueIdentifier: uniqueId, importSessionId: sessionId });

      const itemsForThisInvoice = mappedData.filter(item => item['Số hóa đơn'] === invoiceNum);
      itemsForThisInvoice.forEach((itemData, index) => {
        const itemDocRef = doc(collection(invoiceDocRef, 'items'));
        let isoDate = '';
        try {
          const parsedDate = parse(itemData['Ngày hóa đơn'], 'dd/MM/yyyy', new Date());
          if (isValid(parsedDate)) {
            isoDate = format(parsedDate, 'yyyy-MM-dd');
          }
        } catch (e) {
          // Keep blank ISO date when input is not parseable.
        }

        const invoiceItem: Omit<InvoiceItem, 'id'> = {
          userId: currentUser.id,
          invoiceId: invoiceNum,
          invoiceDate: itemData['Ngày hóa đơn'],
          invoiceDateISO: isoDate,
          sellerName: itemData['Nhà cung cấp'],
          lineNumber: itemData['STT'] || String(index + 1),
          itemCode: itemData['Mã hàng'],
          itemName: itemData['Tên hàng hóa'],
          manufacturer: itemData['Nhà sản xuất'],
          unit: itemData['ĐVT'],
          quantity: String(itemData['Số lượng']),
          unitPrice: String(itemData['Đơn giá']),
          totalAmount: String(itemData['Thành tiền']),
          taxRate: itemData['Thuế suất'],
          lotNumber: itemData['Số lô'],
          expirationDate: itemData['Hạn dùng'],
        };
        batch.set(itemDocRef, invoiceItem);
      });
    });

    try {
      await batch.commit();
      toast({
        title: "Đã lưu kết quả nhập hàng",
        description: `${invoicesToSave.size} hóa đơn và ${mappedData.filter(item => invoicesToSave.has(item['Số hóa đơn'])).length} dòng sản phẩm đã được lưu.`,
      });
      onSaveSuccess();
      setDuplicateInvoices([]);
      setIsDuplicateDialogOpen(false);
    } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: 'batch write to multiple documents',
        operation: 'write',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleSaveSession = async () => {
    if (!currentUser || !firestore || mappedData.length === 0) return;

    setIsSavingSession(true);
    const { invoices, uniqueIdentifiers } = buildInvoiceHeaders(mappedData);

    try {
      const invoicesRef = collection(firestore, 'users', currentUser.id, 'invoices');
      const q = query(invoicesRef, where('uniqueIdentifier', 'in', Array.from(uniqueIdentifiers)));
      const querySnapshot = await getDocs(q);

      const foundDuplicates = querySnapshot.docs.map(doc => doc.data() as Invoice);

      if (foundDuplicates.length > 0) {
        setDuplicateInvoices(foundDuplicates);
        setIsDuplicateDialogOpen(true);
      } else {
        await executeSave(invoices);
      }
    } catch (e) {
      console.error("Error checking for duplicates:", e);
      toast({ variant: 'destructive', title: "Lỗi kiểm tra dữ liệu", description: "Không thể kiểm tra hóa đơn trùng lặp." });
    } finally {
      if (duplicateInvoices.length === 0) {
        setIsSavingSession(false);
      }
    }
  };

  const handleDuplicateChoice = async (choice: 'overwrite' | 'skip' | 'cancel') => {
    setIsDuplicateDialogOpen(false);

    if (choice === 'cancel') {
      setIsSavingSession(false);
      return;
    }

    const { invoices: allInvoices } = buildInvoiceHeaders(mappedData);

    if (choice === 'overwrite') {
      await executeSave(allInvoices, duplicateInvoices);
    } else if (choice === 'skip') {
      const duplicatesIds = new Set(duplicateInvoices.map(d => d.id));
      const invoicesToSave = new Map<string, Omit<Invoice, 'id'>>();
      allInvoices.forEach((value, key) => {
        if (!duplicatesIds.has(key)) {
          invoicesToSave.set(key, value);
        }
      });

      if (invoicesToSave.size > 0) {
        await executeSave(invoicesToSave);
      } else {
        toast({ title: "Không có hóa đơn mới nào để lưu." });
        setIsSavingSession(false);
      }
    }
  };

  return {
    isSavingSession,
    isDuplicateDialogOpen,
    setIsDuplicateDialogOpen,
    duplicateInvoices,
    handleSaveSession,
    handleDuplicateChoice,
  };
}
