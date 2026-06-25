
"use client";

import { useState } from 'react';
import { read, utils, WorkBook } from 'xlsx';
import type { InvoiceItem as ParsedInvoiceItem } from '@/types/invoice';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from './file-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ComparisonImportDialog, type ExcelData } from './comparison-import-dialog';
import { processComparisonFile, type ComparisonColumnMap, type ComparisonItem, type ExcelRowData } from '@/lib/comparison-parser';
import { Button } from './ui/button';
import { Loader2, Download } from 'lucide-react';
import { ComparisonTable } from './comparison-table';
import { exportComparisonToExcel } from '@/lib/excel-exporter';
import type { Supplier } from '@/types/firebase';


interface ComparisonManagerProps {
    xmlInvoiceData: ParsedInvoiceItem[];
    supplierMapping: Map<string, Supplier>;
}

export function ComparisonManager({ xmlInvoiceData, supplierMapping }: ComparisonManagerProps) {
    const { toast } = useToast();
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [excelFileData, setExcelFileData] = useState<ExcelData | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [comparisonResults, setComparisonResults] = useState<ComparisonItem[] | null>(null);

    const handleFileSelect = (files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        setExcelFile(file);
        setComparisonResults(null); // Reset results when a new file is selected

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook: WorkBook = read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = utils.sheet_to_json(worksheet, { header: 1, defval: null }) as (string | number | null)[][];
                
                if (jsonData.length < 1) {
                    toast({ variant: "destructive", title: "Tệp Excel trống" });
                    return;
                }

                setExcelFileData({
                    headers: jsonData[5]?.map(h => String(h || '-')) || [], // Assume headers on row 6, replace null/empty with '-'
                    preview: jsonData.slice(6, 11) // Preview rows 7-11
                });
                setIsImportDialogOpen(true);

            } catch (error) {
                toast({ variant: "destructive", title: "Lỗi đọc tệp Excel" });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleConfirmImport = async (columnMap: ComparisonColumnMap, startRow: number) => {
        if (!excelFile) return;
        setIsProcessing(true);
        setIsImportDialogOpen(false);

        try {
            const excelDataMap = await processComparisonFile(excelFile, columnMap, startRow);
            
            const results: ComparisonItem[] = [];
            const processedExcelKeys = new Set<string>();

            // Aggregate XML data, using the supplier mapping as the source of truth for the tax code
            const xmlDataMap = new Map<string, { totalAmount: number; totalTax: number; totalDiscount: number; supplierName: string; invoiceNumber: string; taxCode: string }>();
            
            xmlInvoiceData.forEach(item => {
                const xmlTaxCode = item['Mã số thuế'];
                const supplierInfo = supplierMapping.get(xmlTaxCode);
                const definitiveTaxCode = supplierInfo?.id || xmlTaxCode; // Fallback to XML tax code if not in mapping

                if (!definitiveTaxCode) return;

                const key = `${item['Số hóa đơn']}_${definitiveTaxCode}`;
                if (!xmlDataMap.has(key)) {
                    xmlDataMap.set(key, { 
                        totalAmount: 0, 
                        totalTax: 0, 
                        totalDiscount: item['Tổng tiền chiết khấu'] || 0, 
                        supplierName: item['Nhà cung cấp'],
                        invoiceNumber: item['Số hóa đơn'],
                        taxCode: definitiveTaxCode
                    });
                }
                const entry = xmlDataMap.get(key)!;
                const taxRate = parseFloat(item['Thuế suất']) || 0;
                const amountAfterItemDiscount = item['Thành tiền'] || 0;
                entry.totalAmount += amountAfterItemDiscount;
                entry.totalTax += amountAfterItemDiscount * (taxRate / 100);
            });


            // --- Comparison Logic ---

            xmlDataMap.forEach((xml, xmlKey) => {
                let excelMatch: ExcelRowData | undefined = excelDataMap.get(xmlKey);
                
                // If no direct match, try matching with a leading '0' in the tax code from supplier catalog
                if (!excelMatch) {
                    const keyWithLeadingZero = `${xml.invoiceNumber}_0${xml.taxCode}`;
                    excelMatch = excelDataMap.get(keyWithLeadingZero);
                    if (excelMatch) {
                        processedExcelKeys.add(keyWithLeadingZero);
                    }
                } else {
                    processedExcelKeys.add(xmlKey);
                }

                 if (excelMatch) {
                     const isAmountMatch = Math.abs(xml.totalAmount - excelMatch.totalAmount) < 1;
                     const isTaxMatch = Math.abs(xml.totalTax - excelMatch.totalTax) < 1;
                     const isDiscountMatch = Math.abs(xml.totalDiscount - excelMatch.totalDiscount) < 1;

                     results.push({
                         invoiceNumber: xml.invoiceNumber,
                         supplierName: xml.supplierName,
                         xmlTotalAmount: xml.totalAmount,
                         excelTotalAmount: excelMatch.totalAmount,
                         xmlTotalTax: xml.totalTax,
                         excelTotalTax: excelMatch.totalTax,
                         xmlTotalDiscount: xml.totalDiscount,
                         excelTotalDiscount: excelMatch.totalDiscount,
                         status: excelMatch.status,
                         matchStatus: isAmountMatch && isTaxMatch && isDiscountMatch ? ' khớp' : 'lệch'
                     });
                 } else {
                     // Found in XML but not in Excel
                     results.push({
                         invoiceNumber: xml.invoiceNumber,
                         supplierName: xml.supplierName,
                         xmlTotalAmount: xml.totalAmount,
                         excelTotalAmount: null,
                         xmlTotalTax: xml.totalTax,
                         excelTotalTax: null,
                         xmlTotalDiscount: xml.totalDiscount,
                         excelTotalDiscount: null,
                         status: null,
                         matchStatus: 'chỉ có trong xml'
                     });
                 }
            });
            
            // Find items in Excel but not in XML
            excelDataMap.forEach((excel, key) => {
                if(!processedExcelKeys.has(key)) {
                    const [invoiceNumber, taxCode] = key.split('_');
                    results.push({
                         invoiceNumber,
                         supplierName: `MST: ${taxCode}`,
                         xmlTotalAmount: null,
                         excelTotalAmount: excel.totalAmount,
                         xmlTotalTax: null,
                         excelTotalTax: excel.totalTax,
                         xmlTotalDiscount: null,
                         excelTotalDiscount: excel.totalDiscount,
                         status: excel.status,
                         matchStatus: 'chỉ có trong excel'
                     });
                }
            });

            setComparisonResults(results);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Lỗi xử lý đối chiếu', description: error.message });
            setComparisonResults(null);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleExport = () => {
        if (!comparisonResults || comparisonResults.length === 0) {
            toast({ variant: 'destructive', title: 'Không có dữ liệu để xuất' });
            return;
        }
        exportComparisonToExcel(comparisonResults);
    }


    return (
        <Card className="shadow-lg">
            {isImportDialogOpen && excelFileData && (
                <ComparisonImportDialog
                    isOpen={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                    excelData={excelFileData}
                    onConfirm={handleConfirmImport}
                />
            )}
            <CardHeader>
                <CardTitle>Đối chiếu Hóa đơn với Bảng kê Excel</CardTitle>
                <CardDescription>
                    Tải lên tệp Excel chứa bảng kê tổng hợp để so sánh với dữ liệu hóa đơn XML đã được xử lý.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FileUploader
                    id="comparison-uploader"
                    onFilesSelected={handleFileSelect}
                    acceptedFileTypes=".xlsx, .xls"
                    multiple={false}
                    buttonText="Chọn tệp Excel bảng kê"
                    dragText="Kéo và thả tệp Excel vào đây"
                />
                
                {isProcessing && (
                     <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border rounded-lg">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4">Đang xử lý và đối chiếu dữ liệu...</p>
                    </div>
                )}
                
                {comparisonResults && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Kết quả đối chiếu ({comparisonResults.length} dòng)</h3>
                            <Button onClick={handleExport} variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Xuất Excel
                            </Button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto border rounded-md">
                            <ComparisonTable data={comparisonResults} />
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
