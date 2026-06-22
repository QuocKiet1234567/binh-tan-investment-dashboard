# Ban Quản Lý Dự Án Phường Bình Tân - Dashboard Báo Cáo Đầu Tư Công

**Project Management and Public Investment Reporting Portal for Binh Tan Ward**

## 📋 Tổng Quan (Overview)

Hệ thống báo cáo quản trị dự án đầu tư công phục vụ **Ban Quản Lý Dự Án Phường Bình Tân**. Ứng dụng cho phép các quản lý dự án tải lên các báo cáo từ Excel hoặc Word, hệ thống sẽ tự động trích xuất và phân tích dữ liệu dự án, vốn, tiến độ, pháp lý, khó khăn và cảnh báo.

A web-based public investment project dashboard for Binh Tan Ward. Upload Excel or Word reports, and the system automatically extracts project data, budgets, progress, legal status, issues, and alerts.

### ✨ Tính Năng Chính (Key Features)

- **📊 Dashboard Thống Kê**: Hiển thị KPIs chính (Tổng dự án, Vốn, Kế hoạch, Cảnh báo)
- **📁 Danh Mục Dự Án**: Quản lý danh sách dự án với tìm kiếm, lọc theo trạng thái và nhóm
- **📈 Chi Tiết Dự Án**: Xem thông tin chi tiết từng dự án (bình thường, pháp lý, tiến độ, vốn)
- **📤 Tải Dữ Liệu**: Hỗ trợ import từ:
  - Excel files (.xlsx)
  - Word documents (.docx)
  - Google Sheets (CSV format)
- **📊 Biểu Đồ Tương Tác**: Chart.js cho phép visualize dữ liệu theo trạng thái và ngân sách
- **💾 Xuất Báo Cáo**: Export dữ liệu sang Excel hoặc Word
- **🔐 Phân Quyền Truy Cập**: Admin/Viewer roles với xác thực qua Supabase
- **⚡ Giải Ngân Vốn**: Theo dõi kế hoạch giải ngân, tiến độ chi tiêu
- **📋 Báo Cáo Định Kỳ**: Tổng hợp báo cáo theo kỳ báo cáo
- **🔔 Cảnh Báo**: Tự động theo dõi các dự án có vấn đề (chậm tiến độ, quá ngân sách, etc)
- **💾 Lưu Trữ Linh Hoạt**: localStorage cho demo nhanh, Supabase cho production đa người dùng

## 🛠️ Tech Stack

- **Frontend**:
  - HTML5, CSS3, Vanilla JavaScript
  - Chart.js (Data visualization)
  - XLSX.js (Excel file parsing)
  - Mammoth.js (Word document parsing)

- **Backend**:
  - Vercel Serverless Functions (Node.js)

- **Database**:
  - Supabase (PostgreSQL + Real-time)

- **Deployment**:
  - Vercel

## 📦 Cấu Trúc Dự Án (Project Structure)

```
project2/
├── Index.html (root file)
├── vercel-app/
│   ├── index.html           # Main application interface
│   ├── app.js              # Main application logic & state management
│   ├── styles.css          # Styling
│   ├── package.json        # Dependencies
│   ├── vercel.json         # Vercel configuration
│   ├── DEPLOY.md           # Deployment guide
│   └── api/
│       ├── google-sheet.js # Endpoint to fetch Google Sheets data
│       └── health.js       # Health check endpoint (/api/health)
```

## 🚀 Khởi Động (Getting Started)

### Chạy Nhanh (Quick Start)

Mở trực tiếp `index.html` trong trình duyệt để dùng bản demo:

```bash
# Mở file trực tiếp
open vercel-app/index.html
```

### Chạy với Vercel CLI

```bash
cd vercel-app
npm install
npm run dev
# Server chạy tại http://localhost:3000
```

### Yêu Cầu (Prerequisites)
- Node.js 18+
- npm or yarn
- Vercel CLI (for local development)

## 🚀 Triển Khai (Deployment)

### Deploy Vercel (Recommended)

```bash
npm run deploy
# hoặc
cd vercel-app
vercel --prod
```

**Hoặc thông qua Vercel Dashboard:**

1. Tạo GitHub repository mới
2. Push toàn bộ thư mục `vercel-app`
3. Vào Vercel > Add New > Project
4. Import repository
5. Framework Preset chọn `Other`
6. Deploy

## 🔑 Cấu Hình (Configuration)

Các biến cấu hình quan trọng được định nghĩa trong `app.js`:

```javascript
const SUPABASE_URL = "https://anfttfidxjghbcoyjmhy.supabase.co";
const SUPABASE_KEY = "sb_publishable_AlYPyUMWW26OO1KOWqyH4Q_xNMyzO35";
const SOURCE_FILE_BUCKET = "source-files";
const STORAGE_KEY = "bt_project_dashboard_data";
```

**Chú ý**: Trong production, các keys này nên lưu trữ an toàn trong environment variables.

## 💾 Dữ Liệu (Data Structure)

### Project Object

```javascript
{
  stt: number,                    // Thứ tự
  name: string,                   // Tên dự án
  budget: number,                 // Ngân sách (tỷ đồng)
  plan: number,                   // Kế hoạch vốn
  legal: string,                  // Tình trạng pháp lý
  progress: string,               // Tiến độ thực hiện
  disbursement: string,           // Giải ngân
  difficulty: string,             // Khó khăn
  solution: string,               // Giải pháp
  evaluation: string,             // Đánh giá
  status: string                  // Trạng thái (Đảm bảo tiến độ/Chậm tiến độ)
}
```

### Application State

```javascript
const state = {
  projects: [],                    // Danh sách dự án
  reportText: "",                  // Nội dung báo cáo
  files: [],                       // Danh sách file tải lên
  importHistory: [],               // Lịch sử import
  selectedProjectId: null,         // Dự án được chọn
  charts: {
    status: null,                  // Chart trạng thái
    budget: null                   // Chart ngân sách
  }
}
```

## 🔌 API Endpoints

### GET /api/health
Health check endpoint - kiểm tra API sẵn sàng

**Response**:
```json
{
  "ok": true,
  "service": "binh-tan-investment-dashboard",
  "message": "API ready"
}
```

### GET /api/google-sheet?url=<SHEET_URL>
Fetch dữ liệu từ Google Sheets theo định dạng CSV

**Parameters**:
- `url` (required): Public Google Sheets CSV export URL hoặc CSV link

**Response**: CSV data (text/csv)

**Error Handling**:
- 400: Missing URL hoặc invalid URL
- 400: URL không phải từ Google hoặc không phải CSV format
- 500: Lỗi fetch dữ liệu

## 🎯 Các Màn Hình Chính (Main Screens)

### 1. Login Screen
- Xác thực với email/password qua Supabase
- Hỗ trợ "Remember Me"
- Hiển thị thông tin đơn vị và kỳ báo cáo

### 2. Dashboard (Trang chủ)
- KPI cards: Tổng dự án, Tổng vốn, Kế hoạch, Cảnh báo
- Tóm tắt trạng thái: Biểu đồ pie theo trạng thái
- Tóm tắt ngân sách: Biểu đồ bar theo trạng thái
- Danh sách cảnh báo

### 3. Projects View (Danh mục dự án)
- Danh sách dự án dạng bảng
- Bộ lọc theo:
  - Trạng thái (Status filter)
  - Nhóm dự án (Group filter)
- Tìm kiếm theo tên
- Click để xem chi tiết

### 4. Project Details
- Thông tin toàn diện:
  - Mã dự án, nhóm, tên
  - Vốn, kế hoạch, đã giải ngân
  - Tiến độ thực hiện
  - Tình trạng pháp lý
  - Khó khăn & giải pháp
  - Thanh tiến độ visual

### 5. Import Data
- Tải lên Excel files (.xlsx)
- Tải lên Word documents (.docx)
- Paste Google Sheets URL
- Kéo thả files vào drop zone
- Xem lịch sử import

### 6. Reports
- Báo cáo chữ (text-based)
- Báo cáo Word (.docx export)
- Ghi chú trình bày
- Xuất báo cáo

### 7. Capital Analysis
- Theo dõi giải ngân theo từng dự án
- Tổng kế hoạch, tổng chậm, tỷ lệ khỏe mạnh

### 8. Periodic Reports
- Báo cáo định kỳ theo thời gian
- Xuất dữ liệu Excel

### 9. Settings
- Xem trạng thái storage
- Tổng số dự án hiện có
- Export tất cả dữ liệu
- Xóa dữ liệu

## 🔐 Xác Thực (Authentication)

- **Provider**: Supabase Auth
- **Method**: Email/Password
- **Session Storage**: localStorage (key: `bt_project_dashboard_auth`)
- **Roles**:
  - **Admin**: Toàn quyền (create, edit, delete, export)
  - **Viewer**: Chỉ xem

## 💾 Lưu Trữ Dữ Liệu (Data Storage)

### Local Storage (Demo)
- `bt_project_dashboard_data`: Dữ liệu projects và state
- `bt_project_dashboard_auth`: Thông tin xác thực
- `bt_project_importHistory`: Lịch sử import

### Supabase (Production)
- Lưu trữ dữ liệu persistent
- Bucket `source-files`: Lưu trữ file import (Excel, Word)
- Real-time synchronization
- Lý tưởng cho đa người dùng

## 📊 Demo Data

Ứng dụng có sẵn 2 dự án demo:

1. **Nâng cấp, mở rộng đường số 6 phường Bình Tân**
   - Ngân sách: 288 tỷ
   - Kế hoạch: 145 tỷ
   - Trạng thái: Đảm bảo tiến độ
   - Tiến độ: Đã phê duyệt dự án

2. **Đầu tư công viên, cây xanh phường Bình Hưng Hòa B**
   - Ngân sách: 141.044 tỷ
   - Kế hoạch: 1 tỷ
   - Trạng thái: Chậm tiến độ
   - Tiến độ: Tạm dừng ở bước lập quy hoạch

## 📁 Tính Năng Import

### Excel (.xlsx)
- Hỗ trợ multiple sheets
- Tự động nhận dạng header
- Xử lý định dạng số, ngày
- Sử dụng XLSX.js library

### Word (.docx)
- Sử dụng Mammoth.js
- Trích xuất text và bảng
- Giữ nguyên formatting
- Hỗ trợ thuyết minh báo cáo

### Google Sheets
- Export dạng CSV
- Fetch qua endpoint /api/google-sheet
- Hỗ trợ real-time collaboration URL
- Không cần API key

## 🎨 Styling

- **Font**: Inter (from Google Fonts)
- **Design Pattern**: Card-based dashboard
- **Responsive**: Mobile-first design
- **Charts**: Chart.js with custom colors
- **Color Scheme**: Modern, professional Vietnamese government style

## 🔍 Tìm Kiếm & Lọc

- **Full-text search** theo tên dự án
- **Filter by Status**: Đảm bảo tiến độ, Chậm tiến độ, etc
- **Filter by Group**: Phân loại theo nhóm dự án
- **Sorting**: Tự động sắp xếp theo STT

## ⚠️ Cảnh Báo & Theo Dõi

Hệ thống tự động phát hiện:
- ❌ Dự án **chậm tiến độ**
- ❌ Dự án có **khó khăn**
- 📊 Dự án **chưa giải ngân**
- 💰 Dự án **quá ngân sách**

## 🔄 Xuất & Import

### Xuất Dữ Liệu
- **Excel (CSV)**: Toàn bộ danh sách dự án
- **Word (.docx)**: Báo cáo định dạng
- **Lịch sử**: Theo dõi tất cả import

### Import Dữ Liệu
- Kéo thả file vào drop zone
- Click "Chọn File" button
- Paste URL Google Sheets
- Xem preview trước xác nhận

## 📝 Xuất Báo Cáo

- Báo cáo text-based
- Export Word format
- Định dạng hành chính
- Ghi chú trình bày

## 🧪 Testing

Kiểm tra health endpoint:
```bash
curl https://your-domain.vercel.app/api/health
```

## 🐛 Troubleshooting

### Không thể import file
- Kiểm tra format file (xlsx, docx, csv)
- Kiểm tra kích thước file
- Vercel serverless timeout (max 10s)

### Dữ liệu không đồng bộ
- Clear browser cache
- Logout và login lại
- Kiểm tra Supabase connection

### Biểu đồ không hiển thị
- Kiểm tra Chart.js library load
- Verify dữ liệu có trong state
- F12 check console errors

### Vercel Deploy lỗi
- Kiểm tra `vercel.json` configuration
- Verify Environment variables
- Check Node.js version compatibility

## 📊 Architecture

```
┌─────────────────────────────────────┐
│     Browser / Frontend              │
│  ┌─────────────────────────────┐    │
│  │   HTML/CSS/JavaScript       │    │
│  │   - Dashboard               │    │
│  │   - Projects CRUD           │    │
│  │   - Import/Export           │    │
│  │   - Charts (Chart.js)       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
           ↓ API Calls ↓
┌─────────────────────────────────────┐
│   Vercel Serverless Functions       │
│  ┌─────────────────────────────┐    │
│  │   /api/health               │    │
│  │   /api/google-sheet         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
           ↓ Data Storage ↓
┌─────────────────────────────────────┐
│   Supabase / localStorage           │
│  ┌─────────────────────────────┐    │
│  │   Projects Data             │    │
│  │   Auth Session              │    │
│  │   Import History            │    │
│  │   File Storage (source-files)│   │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## 📈 Performance Notes

- Lazy load charts
- Debounce search
- Cache API responses
- Optimize image sizes
- Use local storage for quick demo

## 🔐 Security Notes

- Supabase row-level security (RLS) enabled
- API keys stored safely
- Validate all imports
- Sanitize user input
- Use HTTPS only

## 📝 License

Private project for Ban Quản Lý Dự Án Phường Bình Tân

## 👥 Support

Contact: Ban Quản Lý Dự Án Phường Bình Tân

---

**Last Updated**: 2026-06-17
**Version**: 1.0.0
**Status**: Production Ready ✅

## Ghi Chú Phát Triển (Development Notes)

Bản này lưu dữ liệu trong `localStorage` để demo nhanh cho lãnh đạo. Khi cần dùng thật nhiều người, hãy:

1. ✅ Gắn **Supabase** hoặc **Vercel Postgres** để lưu dữ liệu tập trung
2. ✅ Cấu hình **Authentication** với email xác thực
3. ✅ Thiết lập **Row-Level Security** cho quyền truy cập
4. ✅ Enable **Real-time subscriptions** để sync dữ liệu
5. ✅ Backup định kỳ dữ liệu

Hệ thống hiện tại đã hỗ trợ Supabase (xem `app.js` - `initSupabase()` function), chỉ cần activate trong production.
