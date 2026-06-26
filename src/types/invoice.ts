
export interface InvoiceItem {
  'STT': string;
  'Mã hàng': string;
  'Mã hàng (gốc)'?: string;
  'Tên hàng hóa': string;
  'ĐVT': string;
  'Số lượng': number;
  'Đơn giá': number;
  'Thành tiền': number;
  'Thuế suất': string;
  'Số lô': string;
  'Hạn dùng': string;
  'Số hóa đơn': string;
  'Ngày hóa đơn': string;
  'Nhà cung cấp': string; // Tên NCC
  'Mã số thuế': string; // MST NCC
  'Địa chỉ': string;
  'Nhà thuốc': string;
  'Tên file': string;
  'Link truy cập': string;
  'Mã truy cập': string;
  'Tổng tiền thanh toán': number; // XML Grand Total
  'Tổng tiền chiết khấu': number; // XML Total Discount
  'Chiết khấu dòng': number; // Item-level discount
}

export interface ExportItem {
  'Mã nhà CC': string;
  'Tên nhà cung cấp': string;
  'Ngày HĐ': string;
  'Số HĐ': string;
  'Ngày lập': string;
  'Tổng giảm giá': string;
  'Thanh toán': string;
  'Mã hàng hóa': string;
  'Tên hàng hóa': string;
  'Số lô': string;
  'Hạn sử dụng': string;
  'Số lượng': number;
  'Đơn vị nhập': string;
  'Đơn giá': number;
  'Tổng chiết khấu': string;
  'VAT %': string;
}

export interface ViettelExportItem {
  'Mã phiếu nhập': string;
  'Mã nhà CC': string;
  'Tên nhà cung cấp'?: string;
  'Ngày HĐ': string;
  'Số HĐ': string;
  'Ngày lập': string;
  'Tổng giảm giá': string;
  'Thanh toán': string;
  'Mã hàng hóa': string;
  'Tên hàng hóa': string;
  'Số lô': string;
  'Hạn sử dụng': string;
  'Số lượng': number;
  'Đơn vị nhập': string;
  'Đơn giá': number;
  'Tổng chiết khấu': string;
  'VAT %': string;
}
