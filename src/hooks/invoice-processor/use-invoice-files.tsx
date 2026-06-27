'use client';

import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import JSZip from 'jszip';

import { processXmlFile } from '@/lib/invoice-parser';
import type { InvoiceItem as ParsedInvoiceItem } from '@/types/invoice';
import type { useToast } from '@/hooks/use-toast';

type Toast = ReturnType<typeof useToast>['toast'];

interface UseInvoiceFilesOptions {
  toast: Toast;
  onResetProcessingState: () => void;
}

export function useInvoiceFiles({ toast, onResetProcessingState }: UseInvoiceFilesOptions) {
  const [invoiceData, setInvoiceData] = useState<ParsedInvoiceItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState<string[]>([]);
  const [uploadedXmls, setUploadedXmls] = useState<Record<string, string>>({});

  const warningData = useMemo(() => {
    return invoiceData.filter(item => {
      const quantity = item["Số lượng"];
      const isProduct = quantity > 0;
      const missingSolo = !item["Số lô"] || item["Số lô"] === "Null" || item["Số lô"].trim() === "";
      const missingHsdd = !item["Hạn dùng"] || item["Hạn dùng"].trim() === "";
      return isProduct && (missingSolo || missingHsdd);
    });
  }, [invoiceData]);

  const resetInvoiceFiles = useCallback(() => {
    setInvoiceData([]);
    setProcessedFileNames([]);
    setUploadedXmls({});
  }, []);

  const handleFileProcessing = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessingFiles(true);
    resetInvoiceFiles();
    onResetProcessingState();

    const allItems: ParsedInvoiceItem[] = [];
    const finalFileNames: string[] = [];
    const errors: string[] = [];
    const newUploadedXmls: Record<string, string> = {};

    for (const file of files) {
      try {
        if (file.name.toLowerCase().endsWith('.zip')) {
          finalFileNames.push(file.name);
          const zip = await JSZip.loadAsync(file);

          let invoiceFile = null;
          const rootInvoiceFile = zip.file('invoice');

          if (rootInvoiceFile && !rootInvoiceFile.dir) {
            invoiceFile = rootInvoiceFile;
          } else {
            const itaxInvoiceFile = zip.file('itax/invoice');
            if (itaxInvoiceFile && !itaxInvoiceFile.dir) {
              invoiceFile = itaxInvoiceFile;
            } else {
              const xmlFiles = zip.filter((relativePath, file) => {
                return !file.dir && relativePath.toLowerCase().endsWith('.xml');
              });
              if (xmlFiles.length > 0) {
                invoiceFile = xmlFiles[0];
              }
            }
          }

          if (invoiceFile) {
            const content = await invoiceFile.async('string');
            newUploadedXmls[file.name] = content;
            const items = await processXmlFile(content, file.name);
            allItems.push(...items);
          } else {
            errors.push(`Không tìm thấy file XML hóa đơn trong file ${file.name}`);
          }
        } else if (file.name.toLowerCase().endsWith('.xml')) {
          finalFileNames.push(file.name);
          const content = await file.text();
          newUploadedXmls[file.name] = content;
          const items = await processXmlFile(content, file.name);
          allItems.push(...items);
        }
      } catch (e: any) {
        errors.push(e.message || `Lỗi xử lý file ${file.name}`);
      }
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Đã xảy ra lỗi xử lý tệp',
        description: <div className="whitespace-pre-wrap">{errors.join('\n')}</div>,
      });
    }

    const sortedData = allItems.sort((a, b) => {
      const dateA = a['Ngày hóa đơn']?.split('/').reverse().join('') ?? '';
      const dateB = b['Ngày hóa đơn']?.split('/').reverse().join('') ?? '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a['Số hóa đơn'].localeCompare(b['Số hóa đơn']);
    });

    setInvoiceData(sortedData);
    setProcessedFileNames(finalFileNames);
    setUploadedXmls(newUploadedXmls);
    setIsProcessingFiles(false);
  };

  const handleDownloadXml = useCallback((fileName: string) => {
    const content = uploadedXmls[fileName];
    if (!content) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: `Không tìm thấy dữ liệu gốc của tệp ${fileName}`,
      });
      return;
    }
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.xml') ? fileName : `${fileName}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [uploadedXmls, toast]);

  const handleDownloadAllWarningXmls = useCallback(async () => {
    const uniqueFileNames = Array.from(
      new Set(warningData.map(item => item["Tên file"]).filter(Boolean)),
    );

    if (uniqueFileNames.length === 0) {
      toast({
        title: 'Không có tệp để tải',
        description: 'Danh sách cảnh báo hiện không có tệp XML nào.',
      });
      return;
    }

    const zip = new JSZip();
    const missingFiles: string[] = [];

    uniqueFileNames.forEach(fileName => {
      const content = uploadedXmls[fileName];
      if (!content) {
        missingFiles.push(fileName);
        return;
      }
      zip.file(fileName.endsWith('.xml') ? fileName : `${fileName}.xml`, content);
    });

    if (Object.keys(zip.files).length === 0) {
      toast({
        variant: 'destructive',
        title: 'Không thể tải tệp',
        description: 'Không tìm thấy dữ liệu gốc của các tệp XML trong cảnh báo.',
      });
      return;
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xml-canh-bao-${format(new Date(), 'yyyyMMdd-HHmmss')}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Đã tải tệp cảnh báo',
      description: `Đã nén ${Object.keys(zip.files).length} tệp XML không trùng.${missingFiles.length ? ` Thiếu dữ liệu gốc của ${missingFiles.length} tệp.` : ''}`,
    });
  }, [uploadedXmls, warningData, toast]);

  return {
    invoiceData,
    setInvoiceData,
    isProcessingFiles,
    processedFileNames,
    warningData,
    handleFileProcessing,
    handleDownloadXml,
    handleDownloadAllWarningXmls,
    resetInvoiceFiles,
  };
}
