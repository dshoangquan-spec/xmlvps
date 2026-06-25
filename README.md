# Chương trình Quản lý Nhập hàng bằng XML (Next.js 16 + MCP)

Xử lý các file xml của thuế và ứng dụng hỗ trợ phân tích hóa đơn XML, hỗ trợ giải nén file ZIP tự động, đối chiếu bảng kê và xuất dữ liệu ra Excel theo mẫu.

## Các tính năng nổi bật:
- **Xử lý tệp ZIP**: Tự động giải nén và lấy file XML hóa đơn.
- **Trình trích xuất thông minh**: Tự động tách Số lô, Hạn dùng từ tên thuốc (VD: Daflavon) hoặc các trường mở rộng (`External2`, `External3`, `SLo`, `HDung`).
- **Dashboard Admin**: Xem tổng hợp toàn hệ thống hoặc chi tiết từng đơn vị.
- **Next.js MCP**: Kích hoạt máy chủ MCP hỗ trợ tác nhân AI.

## Hướng dẫn Push code lên GitHub:

Nếu anh muốn đưa mã nguồn này lên GitHub, hãy mở **Terminal** trong workspace và chạy các lệnh sau:

1. **Khởi tạo Git** (nếu chưa có):
   ```bash
   git init
   ```

2. **Add các file vào vùng chờ**:
   ```bash
   git add .
   ```

3. **Commit đầu tiên**:
   ```bash
   git commit -m "Initial commit: Hệ thống xử lý hóa đơn XML v1.2.0"
   ```

4. **Kết nối với Repository của anh**:
   *(Thay link bên dưới bằng link repo anh vừa tạo trên GitHub)*
   ```bash
   git remote add origin https://github.com/TEN_USER/TEN_REPO.git
   ```

5. **Push code**:
   ```bash
   git branch -M main
   ```

---
*Phát triển bởi App Prototyper - Firebase Studio*
