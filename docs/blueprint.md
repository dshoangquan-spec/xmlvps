# **App Name**: XML Invoice Parser

## Core Features:

- Tải Tệp XML: Cho phép người dùng tải lên các tệp XML chứa dữ liệu hóa đơn.
- Nhận Diện Nhà Cung Cấp: Tự động nhận diện nhà cung cấp hóa đơn (VNPT, MeInvoice, Viettel) dựa trên cấu trúc XML.
- Trích Xuất Dữ Liệu: Trích xuất dữ liệu hóa đơn liên quan (chi tiết mặt hàng, thông tin nhà cung cấp, v.v.) từ tệp XML dựa trên nhà cung cấp đã nhận diện.
- Định Dạng Dữ Liệu: Định dạng dữ liệu đã trích xuất, bao gồm định dạng ngày tháng cho các trường 'Số lô' và 'Hạn dùng'.
- Xuất Excel: Xuất dữ liệu đã trích xuất và định dạng vào tệp Excel (.xlsx).
- Xác Định Liên Kết/Mã Tra Cứu: Cố gắng xác định và trích xuất liên kết cổng thông tin và mã tra cứu (Fkey) nếu có trong phần TTin cho mục đích xác minh hóa đơn.
- Gợi Ý Dữ Liệu Thông Minh (AI): Công cụ gợi ý dữ liệu còn thiếu hoặc điều chỉnh dữ liệu đã xác định bằng AI, sử dụng LLM. Ví dụ: gợi ý 'Tên hàng hóa' dựa trên 'Mã hàng'.

## Style Guidelines:

- Màu chính: Tím đậm (#673AB7) thể hiện sự tin cậy và hiệu quả trong xử lý dữ liệu.
- Màu nền: Tím rất nhạt (#F3E5F5) tạo nền mềm mại, không phô trương.
- Màu nhấn: Xanh điện (#304FFE) cho các yếu tố tương tác và nổi bật, tạo độ tương phản và rõ ràng.
- Phông chữ cho nội dung và tiêu đề: 'Inter' cho giao diện hiện đại, trung tính và dễ đọc.
- Sử dụng các biểu tượng rõ ràng, tối giản để đại diện cho các trường dữ liệu và hành động khác nhau (ví dụ: tải lên, xuất).
- Duy trì bố cục dạng bảng sạch sẽ để hiển thị dữ liệu đã trích xuất, đảm bảo khả năng đọc và so sánh dễ dàng.
- Sử dụng các hiệu ứng động tinh tế để biểu thị trạng thái tải và trích xuất hoặc xuất dữ liệu thành công, cung cấp phản hồi cho người dùng.