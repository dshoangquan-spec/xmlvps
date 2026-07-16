

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { InvoiceItem, ExportItem, ViettelExportItem } from '@/types/invoice';
import type { Supplier, MasterCatalogItem, Mapping, InvoiceItem as FirebaseInvoiceItem } from '@/types/firebase';
import { format, parse, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { InvoiceSummaryData } from '@/components/invoice-summary';
import type { ComparisonItem } from './comparison-parser';

interface DetailedInvoiceItem extends FirebaseInvoiceItem {
    sellerName: string;
}

interface EnhancedInvoiceItem extends FirebaseInvoiceItem {
  sellerName: string;
  invoiceDate: string;
}


const formatDateForExport = (dateString: string): string => {
    if (!dateString) return '';
    try {
        // Try parsing with a few common formats.
        // The most common format from parsing is 'dd/MM/yyyy'.
        const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
        if (isValid(parsedDate)) {
            // Return in the desired 'dd/MM/yyyy' format as a string.
            return format(parsedDate, 'dd/MM/yyyy');
        }

        // Add other formats to try if necessary
        const otherAttempt = parse(dateString, 'yyyy-MM-dd', new Date());
         if (isValid(otherAttempt)) {
            return format(otherAttempt, 'dd/MM/yyyy');
        }

    } catch (e) {
        // Fall through if parsing fails
    }
    // If it cannot be parsed into a valid date, return an empty string
    // to indicate it's not a valid date.
    return '';
};


function convertToExportFormat(
  data: InvoiceItem[],
  supplierMapping: Map<string, Supplier>,
  useDiscountPercentage = false
): (ExportItem | {})[] {
  if (data.length === 0) {
    return [];
  }
  
  const exportData: (ExportItem | {})[] = [];
  let lastInvoiceNumber = '';

  data.forEach((item, index) => {
    const currentInvoiceNumber = item['Số hóa đơn'];
    
    // Insert a blank row if the invoice number changes
    if (index > 0 && currentInvoiceNumber !== lastInvoiceNumber) {
      exportData.push({}); // Add an empty object for a blank row
    }

    const vatRate = parseFloat(item['Thuế suất']);
    
    const supplierInfo = supplierMapping.get(item['Mã số thuế'] || '');

    const formattedHsd = formatDateForExport(item['Hạn dùng']);
    const finalHsd = formattedHsd ? formattedHsd : '01/07/2027';

    const formattedNgayHd = formatDateForExport(item['Ngày hóa đơn']);
    
    const itemDiscount = item['Chiết khấu dòng'] || 0;
    const itemTotal = item['Thành tiền'] || 0;
    const itemDiscountForExport = useDiscountPercentage && itemTotal > 0
      ? itemDiscount / itemTotal
      : itemDiscount;

    const exportItem: ExportItem = {
      'Mã nhà CC': supplierInfo?.supplierCode || '',
      'Tên nhà cung cấp': supplierInfo?.supplierName || item['Nhà cung cấp'],
      'Ngày HĐ': formattedNgayHd,
      'Số HĐ': item['Số hóa đơn'],
      'Ngày lập': formattedNgayHd, // Use invoice date for creation date
      'Tổng giảm giá': String(item['Tổng tiền chiết khấu']), // Chiết khấu toàn hóa đơn
      'Thanh toán': '0',
      'Mã hàng hóa': item['Mã hàng'],
      'Tên hàng hóa': item['Tên hàng hóa'],
      'Số lô': item['Số lô'] || 'Null',
      'Hạn sử dụng': finalHsd,
      'Số lượng': item['Số lượng'],
      'Đơn vị nhập': item['ĐVT'],
      'Đơn giá': item['Đơn giá'],
      'Tổng chiết khấu': useDiscountPercentage
        ? itemDiscountForExport
        : String(itemDiscountForExport > 0 ? itemDiscountForExport : 0),
      'VAT %': isNaN(vatRate) ? '0' : String(vatRate),
    };
    
    // Do not filter out the discount item
    exportData.push(exportItem);
    lastInvoiceNumber = currentInvoiceNumber;
  });

  return exportData;
}


function convertToViettelExportFormat(data: InvoiceItem[], supplierMapping: Map<string, Supplier>): (ViettelExportItem | {})[] {
  if (data.length === 0) {
    return [];
  }
  
  const invoiceDiscounts = new Map<string, number>();
  data.forEach(item => {
    const invoiceNumber = item['Số hóa đơn'];
    const discountValue = item['Tổng tiền chiết khấu'] || 0;
    if (discountValue > 0 && !invoiceDiscounts.has(invoiceNumber)) {
        invoiceDiscounts.set(invoiceNumber, discountValue);
    }
  });

  const exportData: (ViettelExportItem | {})[] = [];
  let lastInvoiceNumber = '';

  data.forEach((item, index) => {
    const currentInvoiceNumber = item['Số hóa đơn'];
    
    if (index > 0 && currentInvoiceNumber !== lastInvoiceNumber) {
      exportData.push({});
    }

    const vatRate = parseFloat(item['Thuế suất']);
    const commonDiscountValue = invoiceDiscounts.get(currentInvoiceNumber) || 0;
    const supplierInfo = supplierMapping.get(item['Mã số thuế'] || '');
    const formattedHsd = formatDateForExport(item['Hạn dùng']);
    const finalHsd = formattedHsd ? formattedHsd : '01/07/2027';
    const formattedNgayHd = formatDateForExport(item['Ngày hóa đơn']);

    const exportItem: ViettelExportItem = {
      'Mã phiếu nhập': '', // New empty column
      'Mã nhà CC': supplierInfo?.supplierCode || '',
      'Tên nhà cung cấp': supplierInfo?.supplierName || item['Nhà cung cấp'],
      'Ngày HĐ': formattedNgayHd,
      'Số HĐ': item['Số hóa đơn'],
      'Ngày lập': formattedNgayHd,
      'Tổng giảm giá': String(commonDiscountValue),
      'Thanh toán': '0',
      'Mã hàng hóa': item['Mã hàng'],
      'Tên hàng hóa': item['Tên hàng hóa'],
      'Số lô': item['Số lô'] || 'Null',
      'Hạn sử dụng': finalHsd,
      'Số lượng': item['Số lượng'],
      'Đơn vị nhập': item['ĐVT'],
      'Đơn giá': item['Đơn giá'],
      'Tổng chiết khấu': String(item['Chiết khấu dòng'] || 0),
      'VAT %': isNaN(vatRate) ? '0' : String(vatRate),
    };
    
    exportData.push(exportItem);
    lastInvoiceNumber = currentInvoiceNumber;
  });

  return exportData;
}


export function exportToExcel(
  data: InvoiceItem[],
  type: 'goc' | 'anhxa' | 'anhxa-km-phan-tram',
  supplierMapping: Map<string, Supplier>
) {
  let dataToExport: (InvoiceItem | ExportItem | {})[];
  let headers: string[];
  const isMappedExport = type !== 'goc';
  const isDiscountPercentageExport = type === 'anhxa-km-phan-tram';

  if (isMappedExport) {
    dataToExport = convertToExportFormat(data, supplierMapping, isDiscountPercentageExport);
    headers = [
      'Mã nhà CC', 'Tên nhà cung cấp', 'Ngày HĐ', 'Số HĐ', 'Ngày lập', 'Tổng giảm giá', 'Thanh toán',
      'Mã hàng hóa', 'Tên hàng hóa', 'Số lô', 'Hạn sử dụng', 'Số lượng',
      'Đơn vị nhập', 'Đơn giá', 'Tổng chiết khấu', 'VAT %'
    ];
  } else {
    dataToExport = data;
    headers = Object.keys(data[0] || {});
  }
  
  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  // If exporting mapped data, explicitly set date and specific numeric columns to Text format
  if (isMappedExport && dataToExport.length > 0) {
    // C=Ngày HĐ, E=Ngày lập, F=Tổng giảm giá, K=Hạn sử dụng
    const textColumns = ['C', 'E', 'F', 'K']; 
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Start from row 2 (index 1) to skip header
        for (const C_char of textColumns) {
            const cell_address = `${C_char}${R + 1}`;
            if (worksheet[cell_address] && worksheet[cell_address].v != null) {
                worksheet[cell_address].t = 's'; // 's' forces the cell to be treated as a string (text)
                worksheet[cell_address].v = String(worksheet[cell_address].v); // ensure value is string
            }
        }
    }

    if (isDiscountPercentageExport) {
      // O=Tổng chiết khấu: store the numeric ratio and display it as a percentage.
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell = worksheet[`O${R + 1}`];
        if (cell && cell.v != null) {
          cell.t = 'n';
          cell.z = '0.00%';
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hóa Đơn');

  const colWidths = headers.map(header => {
      const maxLength = (dataToExport as any[]).reduce((w, r) => Math.max(w, (r[header] ?? '').toString().length), header.length + 2);
      return { wch: Math.min(maxLength, 40) };
  });

  worksheet['!cols'] = colWidths;
  
  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const exportLabel = type === 'goc'
    ? 'Goc'
    : isDiscountPercentageExport
      ? 'DaAnhXa_KM_PhanTram'
      : 'DaAnhXa_TheoMau';
  const filename = `TongHop_HoaDon_${exportLabel}_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}

export function exportToExcelViettel(data: InvoiceItem[], supplierMapping: Map<string, Supplier>) {
    const dataToExport = convertToViettelExportFormat(data, supplierMapping);
    const headers = [
      'Mã phiếu nhập', 'Mã nhà CC', 'Ngày HĐ', 'Số HĐ', 'Ngày lập', 'Tổng giảm giá', 'Thanh toán',
      'Mã hàng hóa', 'Tên hàng hóa', 'Số lô', 'Hạn sử dụng', 'Số lượng',
      'Đơn vị nhập', 'Đơn giá', 'Tổng chiết khấu', 'VAT %'
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

    const textColumns = ['C', 'E', 'F', 'K']; 
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (const C_char of textColumns) {
            const cell_address = `${C_char}${R + 1}`;
            if (worksheet[cell_address] && worksheet[cell_address].v != null) {
                worksheet[cell_address].t = 's';
                worksheet[cell_address].v = String(worksheet[cell_address].v);
            }
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hóa Đơn Viettel');

    const colWidths = headers.map(header => {
        const maxLength = (dataToExport as any[]).reduce((w, r) => Math.max(w, (r[header] ?? '').toString().length), header.length + 2);
        return { wch: Math.min(maxLength, 40) };
    });

    worksheet['!cols'] = colWidths;
    
    const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
    const filename = `Mau_Viettel_${timestamp}.xlsx`;
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(blob, filename);
}

export function exportSummaryToExcel(data: InvoiceSummaryData[]) {
  if (data.length === 0) return;

  const headers = [
    "Số hóa đơn", "Ngày lập", "Nhà cung cấp", 
    "Tiền hàng (trước CK)", "Giảm giá", "Tiền thuế", "Tổng cộng (Tính toán)", "Tổng cộng (XML)"
  ];
  
  const dataToExport = data.map(item => ({
    "Số hóa đơn": item.invoiceNumber,
    "Ngày lập": item.issueDate,
    "Nhà cung cấp": item.supplierName,
    "Tiền hàng (trước CK)": item.totalAmountBeforeDiscount,
    "Giảm giá": item.totalDiscount,
    "Tiền thuế": item.totalTax,
    "Tổng cộng (Tính toán)": item.grandTotal,
    "Tổng cộng (XML)": item.xmlGrandTotal,
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  const colWidths = headers.map(header => ({
    wch: Math.max(
        header.length,
        ...dataToExport.map(row => (row[header as keyof typeof row] || '').toString().length)
    ) + 2
  }));

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKe');

  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const filename = `ThongKe_HoaDon_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}

export function exportMasterCatalogToExcel(data: MasterCatalogItem[]) {
  if (data.length === 0) return;
  const headers = ["Mã SP", "Tên sản phẩm", "Hoạt chất", "Hàm lượng", "Số đăng ký", "Quy cách", "ĐVT", "ĐVT nhỏ nhất", "Hệ số QĐ"];
  const dataToExport = data.map(item => ({
    "Mã SP": item.id,
    "Tên sản phẩm": item.productName,
    "Hoạt chất": item.activeIngredient,
    "Hàm lượng": item.concentration,
    "Số đăng ký": item.registrationNumber,
    "Quy cách": item.packaging,
    "ĐVT": item.unit,
    "ĐVT nhỏ nhất": item.smallestUnit,
    "Hệ số QĐ": item.conversionRate
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  worksheet['!cols'] = headers.map(header => ({ wch: 25 }));


  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Muc Chung');
  
  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const filename = `DanhMucChung_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}

export function exportMappingCatalogToExcel(data: Mapping[]) {
  if (data.length === 0) return;
  const headers = ["Mã số thuế NCC", "Mã hàng gốc (XML)", "Tên hàng hóa mới", "Mã ánh xạ mới", "ĐVT (gốc)", "ĐVT mới", "Tỷ lệ quy đổi", "Mã liên kết (danh mục chung)"];
  
  const dataToExport = data.map(item => ({
    "Mã số thuế NCC": item.supplierTaxCode || '',
    "Mã hàng gốc (XML)": item.originalCode,
    "Tên hàng hóa mới": item.newName,
    "Mã ánh xạ mới": item.newCode,
    "ĐVT (gốc)": item.originalUnit,
    "ĐVT mới": item.newUnit,
    "Tỷ lệ quy đổi": item.conversionRate,
    "Mã liên kết (danh mục chung)": item.masterCatalogId,
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  worksheet['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhMucAnhXa');
  
  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const filename = `DanhMucAnhXa_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}


export function exportSupplierCatalogToExcel(data: Supplier[]) {
  if (data.length === 0) return;
  const headers = ["Tên nhà cung cấp", "Mã nhà cung cấp", "Mã số thuế"];
  
  const dataToExport = data.map(item => ({
    "Tên nhà cung cấp": item.supplierName,
    "Mã nhà cung cấp": item.supplierCode,
    "Mã số thuế": item.id,
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  worksheet['!cols'] = [
    { wch: 40 }, { wch: 20 }, { wch: 20 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhMucNhaCungCap');
  
  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const filename = `DanhMucNhaCungCap_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}

export function exportSessionDetailsToExcel(data: DetailedInvoiceItem[], importDate: string) {
    if (data.length === 0) return;
    
    const headers = [
      "Số HĐ", "Nhà cung cấp", "Tên hàng", "Số lô", "Hạn dùng", "ĐVT",
      "SL", "Đơn giá VAT", "Thành tiền"
    ];

    const dataToExport = data.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const taxRate = parseFloat(item.taxRate);
        const unitPriceWithVat = !isNaN(unitPrice) && !isNaN(taxRate) ? Math.round(unitPrice * (1 + taxRate/100)) : Math.round(unitPrice);
        const totalAmount = !isNaN(quantity) && !isNaN(unitPriceWithVat) ? quantity * unitPriceWithVat : (parseFloat(item.totalAmount) || 0) * (1 + (taxRate || 0)/100);

        return {
            "Số HĐ": item.invoiceId,
            "Nhà cung cấp": item.sellerName,
            "Tên hàng": item.itemName,
            "Số lô": item.lotNumber,
            "Hạn dùng": item.expirationDate,
            "ĐVT": item.unit,
            "SL": quantity,
            "Đơn giá VAT": unitPriceWithVat,
            "Thành tiền": totalAmount
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

    worksheet['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, {wch: 10},
        { wch: 10 }, { wch: 15 }, { wch: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ChiTietNhapHang');
    
    const formattedDate = new Date(importDate).strftime("%Y%m%d_%H%M");
    const filename = `ChiTietNhapHang_${formattedDate}.xlsx`;
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(blob, filename);
}

export function exportAllItemsToExcel(data: EnhancedInvoiceItem[], dateRange?: DateRange) {
    if (data.length === 0) return;
    
    const headers = [
      "Ngày HĐ", "Số HĐ", "Nhà cung cấp", "Tên hàng", "Số lô", "Hạn dùng", "ĐVT",
      "SL", "Đơn giá", "Thành tiền"
    ];

    const dataToExport = data.map(item => ({
      "Ngày HĐ": item.invoiceDate,
      "Số HĐ": item.invoiceId,
      "Nhà cung cấp": item.sellerName,
      "Tên hàng": item.itemName,
      "Số lô": item.lotNumber,
      "Hạn dùng": item.expirationDate,
      "ĐVT": item.unit,
      "SL": parseFloat(item.quantity),
      "Đơn giá": parseFloat(item.unitPrice),
      "Thành tiền": parseFloat(item.totalAmount)
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

    worksheet['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, {wch: 10},
        { wch: 10 }, { wch: 15 }, { wch: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TatCaMatHang');
    
    let datePart = 'AllTime';
    if(dateRange?.from && dateRange?.to) {
        datePart = `${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}`;
    }
    const filename = `TatCaMatHang_${datePart}_${new Date().strftime("%Y%m%d%H%M")}.xlsx`;
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(blob, filename);
}

export function exportComparisonToExcel(data: ComparisonItem[]) {
  if (data.length === 0) return;

  const headers = [
    "Số HĐ",
    "Nhà CC",
    "Tiền hàng (XML)",
    "Tiền hàng (Excel)",
    "Thuế (XML)",
    "Thuế (Excel)",
    "CK (XML)",
    "CK (Excel)",
    "Trạng thái (Excel)",
    "Đối chiếu",
  ];

  const dataToExport = data.map(item => ({
    "Số HĐ": item.invoiceNumber,
    "Nhà CC": item.supplierName,
    "Tiền hàng (XML)": item.xmlTotalAmount,
    "Tiền hàng (Excel)": item.excelTotalAmount,
    "Thuế (XML)": item.xmlTotalTax,
    "Thuế (Excel)": item.excelTotalTax,
    "CK (XML)": item.xmlTotalDiscount,
    "CK (Excel)": item.excelTotalDiscount,
    "Trạng thái (Excel)": item.status,
    "Đối chiếu": item.matchStatus,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });

  worksheet['!cols'] = [
    { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 20 }, { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DoiChieuHoaDon');
  
  const timestamp = new Date().strftime("%Y%m%d_%H%M%S");
  const filename = `DoiChieu_HoaDon_${timestamp}.xlsx`;
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
  saveAs(blob, filename);
}



declare global {
  interface Date {
    strftime(format: string): string;
  }
}

if (!Date.prototype.strftime) {
  Date.prototype.strftime = function(format: string): string {
      const zeroPad = (num: number) => String(num).padStart(2, '0');
      const d = this;
      return format.replace(/%([YmdHMS])/g, (match) => {
          switch (match) {
              case '%Y': return String(d.getFullYear());
              case '%m': return zeroPad(d.getMonth() + 1);
              case '%d': return zeroPad(d.getDate());
              case '%H': return zeroPad(d.getHours());
              case '%M': return zeroPad(d.getMinutes());
              case '%S': return zeroPad(d.getSeconds());
              default: return match;
          }
      });
  };
}
