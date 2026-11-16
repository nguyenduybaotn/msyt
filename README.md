# YouPlay - Web App Nghe YouTube Chạy Nền & PiP trên iPhone (iOS)

Ứng dụng web tối ưu dành riêng cho **iPhone (iOS Safari & PWA)**, cho phép:
- 🎵 **Nghe nhạc dưới nền khi tắt màn hình** (tiết kiệm pin & data).
- 📲 **Điều khiển trên Màn hình khóa (Lock Screen)** và Dynamic Island thông qua Media Session API.
- 🪟 **Xem video cửa sổ nổi Picture-in-Picture (PiP)** để vừa xem vừa lướt mạng xã hội.
- 📱 **Hỗ trợ PWA (Add to Home Screen)** cài đặt ra màn hình chính iPhone dùng như ứng dụng native không vướng thanh địa chỉ Safari.
- 🔍 **Tìm kiếm thông minh & Dán link**: Tìm theo từ khóa bài hát hoặc dán thẳng link YouTube (`youtube.com/...` hoặc `youtu.be/...`).
- 📂 **Hàng đợi (Queue), Danh sách Yêu thích (Favorites) & Lịch sử nghe**.

---

## 🚀 Cách khởi chạy trên máy tính

1. Cài đặt các gói phụ thuộc (nếu chưa có):
```bash
npm install
```

2. Khởi chạy ứng dụng:
```bash
npm start
```
Ứng dụng sẽ chạy tại: `http://localhost:3000`

---

## 📱 Cách mở trên iPhone

### Cách 1: Cùng mạng Wi-Fi (Nhanh nhất)
1. Đảm bảo iPhone và máy tính kết nối cùng mạng Wi-Fi.
2. Kiểm tra địa chỉ IP mạng nội bộ của máy tính (ví dụ: `192.168.14.69`).
3. Mở **Safari** trên iPhone và gõ địa chỉ:
   ```
   http://192.168.14.69:3000
   ```

### Cách 2: Truy cập từ bất cứ đâu qua Cloudflare Tunnel hoặc Localtunnel / Ngrok
Nếu muốn truy cập bên ngoài qua 4G/5G hoặc HTTPS (để Safari cấp quyền PWA tốt nhất):
```bash
npx localtunnel --port 3000
```
Hoặc dùng Cloudflare Tunnel:
```bash
cloudflared tunnel --url http://localhost:3000
```
Mở đường link HTTPS được cấp trên iPhone.

---

## 💡 Mẹo sử dụng trên iPhone

1. **Thêm vào Màn hình chính (PWA)**:
   - Trên Safari iPhone, bấm vào biểu tượng **Chia sẻ** (hình mũi tên hướng lên ⎋).
   - Cuộn xuống chọn **"Thêm vào MH chính" (Add to Home Screen)**.
   - Nhấn **Thêm**. Bạn sẽ có icon YouPlay ngoài màn hình chính, mở lên toàn màn hình không có thanh URL.

2. **Chế độ phát nền khi khóa màn hình**:
   - Mặc định ở chế độ **Audio Nền**.
   - Bấm phát một bài hát, sau đó bấm nút nguồn khóa màn hình hoặc vuốt về Home Screen -> Nhạc vẫn phát bình thường!
   - Trên màn hình khóa và Dynamic Island sẽ hiển thị ảnh bìa, tên bài hát và các nút tua, chuyển bài.

3. **Chế độ xem video thu nhỏ (Picture-in-Picture)**:
   - Trong màn hình trình phát, chọn tab **"Video / PiP"**.
   - Nhấn vào nút **"Cửa sổ nổi PiP"**.
   - Vuốt về Home Screen hoặc chuyển sang app khác (Zalo, Facebook, Messenger), video sẽ tiếp tục nổi ở góc màn hình.
