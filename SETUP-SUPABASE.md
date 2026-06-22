# 🚀 HƯỚNG DẪN SETUP SUPABASE (CHỈ 5 PHÚT)

## 📋 NHANH GỌNLỆ: DÙNG SUPABASE ĐỂ LƯU TRỮ LÂUDÀI

Nếu dữ liệu > 2MB hoặc cần multi-user, làm theo hướng dẫn này.

---

## BƯỚC 1: Tạo Tài Khoản Supabase (1 phút)

1. Vào https://supabase.com
2. Click **"Start your project"** → **"Create a new project"**
3. Đăng ký với GitHub hoặc Email
4. Tạo organization (vd: "Ban-Quan-Ly-Du-An")
5. Chọn **Free Plan** (đủ dùng)

---

## BƯỚC 2: Tạo Bảng trong Supabase (2 phút)

1. Vào **SQL Editor** (menu trái)
2. Click **"New Query"**
3. Copy & Paste code dưới, rồi **RUN**:

```sql
-- Tạo bảng lưu dữ liệu dashboard
CREATE TABLE dashboard_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE dashboard_state ENABLE ROW LEVEL SECURITY;

-- Tạo index để tối ưu tìm kiếm
CREATE INDEX idx_dashboard_updated_at ON dashboard_state(updated_at DESC);
CREATE INDEX idx_dashboard_updated_by ON dashboard_state(updated_by);

-- Policy: User chỉ thấy dữ liệu của chính mình
CREATE POLICY "User sees own state"
  ON dashboard_state
  FOR SELECT
  USING (updated_by = auth.uid());

CREATE POLICY "User updates own state"
  ON dashboard_state
  FOR UPDATE
  USING (updated_by = auth.uid());

CREATE POLICY "User inserts own state"
  ON dashboard_state
  FOR INSERT
  WITH CHECK (updated_by = auth.uid());

-- Tạo bảng lịch sử import (optional)
CREATE TABLE import_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT,
  file_type TEXT,
  row_count INT,
  project_count INT,
  status TEXT,
  error_message TEXT,
  import_date TIMESTAMP DEFAULT now(),
  data JSONB
);

-- Enable RLS cho import_history
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own history"
  ON import_history
  FOR SELECT
  USING (user_id = auth.uid());
```

✅ Nhấn **Ctrl+Enter** hoặc click **Run** nếu thấy thông báo thành công, OK!

---

## BƯỚC 3: Cấu Hình Authentication (1 phút)

1. Vào **Authentication** (menu trái)
2. Click **Providers**
3. Bật **Email/Password**:
   - Click toggle để bật
   - Để mặc định settings
   - Click **Save**

---

## BƯỚC 4: Lấy Credentials (30 giây)

1. Vào **Settings** → **API**
2. Copy hai giá trị này:

```
SUPABASE_URL: (dòng "Project URL")
SUPABASE_KEY: (dòng "anon public" - NOT secret key!)
```

**⚠️ QUAN TRỌNG:** Copy **anon public key**, KHÔNG phải secret key!

---

## BƯỚC 5: Cập Nhật Code (1 phút)

Mở `app.js`, tìm dòng:

```javascript
const SUPABASE_URL = "https://anfttfidxjghbcoyjmhy.supabase.co";
const SUPABASE_KEY = "sb_publishable_AlYPyUMWW26OO1KOWqyH4Q_xNMyzO35";
```

Thay thế bằng:
```javascript
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";  // Paste SUPABASE_URL
const SUPABASE_KEY = "eyJhbGc...YOUR_ANON_KEY";              // Paste SUPABASE_KEY
```

---

## BƯỚC 6: Deploy & Test (1 phút)

1. Save file `app.js`
2. Upload lên Vercel:
   ```bash
   cd vercel-app
   git add .
   git commit -m "setup: Enable Supabase storage"
   git push
   ```

3. Hoặc deploy direct:
   ```bash
   npm run deploy
   ```

4. Refresh browser, thử login:
   - **Email**: test@example.com
   - **Password**: Test123@

---

## 🧪 TEST SUPABASE

### 1. Tạo User
```
Email: yourname@example.com
Password: SecurePass123@
```

### 2. Import data
- Upload Excel file
- Click "Save" → dữ liệu sẽ tự động lưu lên Supabase

### 3. Kiểm tra dữ liệu
1. Vào Supabase **Table Editor**
2. Click table **"dashboard_state"**
3. Xem dữ liệu mới được lưu

---

## ✅ KIỂM TRA HOẠT ĐỘNG

Nếu thấy:
- ✅ Login/Logout hoạt động → **Supabase Auth OK**
- ✅ Import data, refresh page dữ liệu vẫn còn → **Supabase Storage OK**
- ✅ Console log không có lỗi → **All Good!**

---

## 🐛 TROUBLESHOOTING

### Lỗi: "Could not connect to Supabase"
**Nguyên nhân**: Sai URL hoặc Key
**Cách sửa**: 
- Double-check SUPABASE_URL và SUPABASE_KEY
- Đảm bảo copy đúng "anon public key", không phải "secret key"

### Lỗi: "User not found"
**Nguyên nhân**: Chưa sign up user
**Cách sửa**:
- Vào Supabase > Authentication > Users
- Click **"Create a new user"**
- Nhập email & password
- Try login lại

### Lỗi: "Permission denied"
**Nguyên nhân**: Row-Level Security (RLS) policy sai
**Cách sửa**:
- Kiểm tra policy trong SQL ở bước 2
- Verify `updated_by = auth.uid()` đúng

### Dữ liệu không sync
**Nguyên nhân**: 
- Offline không có internet
- RLS policy chặn access
**Cách sửa**:
- Kiểm tra console (F12)
- Verify xem có lỗi gì không

---

## 🎯 TÍNH NĂNG BỔ SUNG (Optional)

### Real-time Sync (Auto-update khi ai đó edit)
```javascript
// Thêm vào trong app.js
async function subscribeToRealtimeUpdates() {
  if (!supabaseClient) return;
  
  supabaseClient
    .on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'dashboard_state' 
      }, 
      payload => {
        console.log('Real-time update:', payload);
        restoreState(); // Auto-reload
      }
    )
    .subscribe();
}

// Call sau khi login
subscribeToRealtimeUpdates();
```

### Auto-save (Save tự động mỗi 30 giây)
```javascript
// Thêm vào trong app.js
setInterval(() => {
  if (currentSession) {
    saveRemoteState();
    console.log('Auto-saved at', new Date().toLocaleTimeString());
  }
}, 30000);
```

---

## 📊 PLAN SUPABASE

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Database** | 500MB | 8GB | Custom |
| **Bandwidth** | 2GB | 50GB | Custom |
| **Auth Users** | Unlimited | Unlimited | Unlimited |
| **RLS** | ✅ | ✅ | ✅ |
| **Real-time** | ✅ | ✅ | ✅ |
| **Cost** | $0 | $25/mo | Custom |

**Free plan đủ dùng cho team ≤ 100 người**

---

## 🎓 DOCS THAM KHẢO

- Supabase Docs: https://supabase.com/docs
- Auth Quickstart: https://supabase.com/docs/guides/auth
- Real-time: https://supabase.com/docs/guides/real-time

---

**⏱️ Tổng cộng: ~5 phút setup**

✅ **Xong!** Giờ web của bạn có thể:**
- ✅ Lưu dữ liệu **lâu dài** trên server
- ✅ **Multi-user**: Nhiều người dùng cùng lúc
- ✅ **Backup tự động** từ Supabase
- ✅ **Sync real-time** (optional)
- ✅ **Offline-first** (localStorage + Supabase)

---

**Chúc bạn thành công! 🚀**
