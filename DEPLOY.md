# Hướng dẫn deploy Vercel

## 1. Chạy thử local

```bash
cd vercel-app
npm install
npm run dev
```

Mở link Vercel CLI hiện ra, thường là:

```text
http://localhost:3000
```

## 2. Deploy nhanh bằng terminal

Đăng nhập Vercel:

```bash
vercel login
```

Deploy thử preview:

```bash
npm run preview
```

Deploy bản chính thức:

```bash
npm run deploy
```

## 3. Cách nên dùng lâu dài: GitHub tự deploy

Tạo repository mới trên GitHub, ví dụ:

```text
binh-tan-investment-dashboard
```

Sau đó chạy:

```bash
cd vercel-app
git init
git add .
git commit -m "Initial Vercel dashboard"
git branch -M main
git remote add origin https://github.com/<ten-github-cua-ban>/binh-tan-investment-dashboard.git
git push -u origin main
```

Vào Vercel:

1. Add New > Project.
2. Import repository vừa tạo.
3. Framework Preset: Other.
4. Root Directory: để trống nếu repo chỉ chứa code này, hoặc chọn `vercel-app` nếu repo chứa cả thư mục cha.
5. Deploy.

Từ lần sau sửa code xong chỉ cần:

```bash
git add .
git commit -m "Update dashboard"
git push
```

Vercel sẽ tự deploy.

## 4. Nếu muốn deploy trực tiếp không qua GitHub

```bash
npm run deploy
```

Cách này nhanh, nhưng dùng GitHub vẫn tốt hơn vì có lịch sử code và tự deploy sau mỗi lần push.
