# Hướng dẫn Deploy lên Vercel

## Cách 1: Deploy qua GitHub (Khuyến nghị)

### Bước 1: Đẩy code lên GitHub

1. Tạo repository mới trên GitHub (https://github.com/new)
2. Mở terminal trong thư mục dự án và chạy:

```bash
# Khởi tạo git (nếu chưa có)
git init

# Thêm tất cả file
git add .

# Commit
git commit -m "Initial commit"

# Thêm remote GitHub (thay YOUR_USERNAME và YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Đẩy code lên
git branch -M main
git push -u origin main
```

### Bước 2: Deploy lên Vercel

1. Truy cập https://vercel.com
2. Đăng nhập bằng GitHub
3. Click "Add New Project"
4. Chọn repository vừa tạo
5. Vercel sẽ tự động detect Vite, click "Deploy"
6. Đợi vài phút, bạn sẽ có link như: `https://your-project.vercel.app`

## Cách 2: Deploy trực tiếp bằng Vercel CLI

1. Cài đặt Vercel CLI:
```bash
npm i -g vercel
```

2. Trong thư mục dự án, chạy:
```bash
vercel
```

3. Làm theo hướng dẫn:
   - Login vào Vercel
   - Chọn project name
   - Deploy

## Cách 3: Deploy lên Netlify (Thay thế)

1. Truy cập https://netlify.com
2. Đăng nhập bằng GitHub
3. Click "Add new site" → "Import an existing project"
4. Chọn repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy site"

## Lưu ý

- Sau khi deploy, bạn có thể truy cập từ điện thoại bằng link được cung cấp
- Dữ liệu vẫn lưu trong LocalStorage của trình duyệt (mỗi thiết bị có dữ liệu riêng)
- Nếu muốn dữ liệu đồng bộ giữa các thiết bị, cần thêm backend database

