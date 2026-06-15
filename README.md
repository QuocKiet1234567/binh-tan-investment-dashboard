# Ban Quản Lý Dự Án Phường Bình Tân

Web dashboard báo cáo đầu tư công triển khai trên Vercel.

## Chạy nhanh

Mở trực tiếp `index.html` trong trình duyệt để dùng bản demo.

Nếu muốn chạy bằng Vercel CLI:

```bash
npm install
npm run dev
```

## Deploy Vercel

1. Tạo GitHub repository mới.
2. Upload toàn bộ thư mục `vercel-app`.
3. Vào Vercel > Add New > Project.
4. Import repository.
5. Framework Preset chọn `Other`.
6. Deploy.

## Tính năng

- Login giao diện nội bộ.
- Upload Excel `.xlsx` phụ lục dự án.
- Upload Word `.docx` báo cáo thuyết minh.
- Tự phân tích danh sách dự án, vốn, tiến độ, pháp lý, khó khăn.
- Dashboard biểu đồ/KPI.
- Sửa dữ liệu trực tiếp trên web.
- Lưu dữ liệu tạm trong trình duyệt.
- Xuất Excel dạng CSV.
- Xuất Word báo cáo dạng `.doc`.

## Ghi chú

Bản này lưu dữ liệu trong `localStorage` để demo nhanh cho lãnh đạo. Khi cần dùng thật nhiều người, nên gắn Supabase hoặc Vercel Postgres để lưu dữ liệu tập trung.
