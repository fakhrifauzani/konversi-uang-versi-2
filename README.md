# Konversi Uang

Aplikasi statis untuk mengonversi mata uang fiat dan crypto. Aplikasi tidak memakai PHP atau database SQL.

## Deploy ke Vercel

1. Import repository ini ke Vercel, atau jalankan `vercel` dari folder proyek.
2. Gunakan preset **Other** dan biarkan Build Command serta Output Directory kosong.
3. Deploy. Tidak ada environment variable atau database yang perlu disiapkan.

Folder `api/` berisi Vercel Functions untuk mengambil kurs dan data grafik. Halaman dan aset lainnya disajikan sebagai file statis.

Riwayat konversi disimpan di `localStorage` browser, maksimal 100 entri. Riwayat hanya tersedia pada browser dan perangkat yang sama; menghapus data situs di browser juga menghapus riwayat tersebut.
