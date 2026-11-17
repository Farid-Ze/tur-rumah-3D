# Tur Virtual 3D — Rumah Minimalis 1 Lantai

Proyek visualisasi arsitektur **Rumah Minimalis 1 Lantai** yang terdiri dari model **SketchUp** tunggal siap buka (`Rumah_Minimalis_3D.skp`) serta aplikasi web **Tur Virtual 3D Interaktif** bergaya *Realita*, *SketchUp*, dan *Monokrom*.

## Struktur Folder & File

```
├── index.html                  # Halaman utama Tur Virtual 3D
├── Rumah_Minimalis_3D.skp      # Model 3D SketchUp tunggal (siap buka di SketchUp)
├── Buka_Tur_3D.bat             # Pintasan Windows untuk menjalankan tur 3D lokal
├── server_lokal.py             # Server HTTP lokal untuk membuka tur 3D di browser
├── aset/
│   ├── model_rumah.glb         # Model 3D PBR teroptimasi untuk WebGL
│   ├── kolider_rumah.glb       # Mesh kolider navigasi orang pertama
│   └── denah_lantai.png        # Denah ortografis untuk minimap interaktif
├── gaya/
│   └── tampilan.css            # Antarmuka minimalis obsidian glassmorphic
├── pustaka/                    # Modul vendor Three.js (GLTF, Orbit, Octree, Capsule)
└── sumber/
    ├── utama.js                # Inisialisasi aplikasi & loop animasi
    ├── data_tur.js             # Daftar 9 titik kamera tur & deteksi zona ruangan
    ├── inti/
    │   └── Penampil3D.js       # Renderer Three.js, pencahayaan & mode tampilan
    ├── kontrol/
    │   ├── KontrolPemain.js    # Navigasi jalan bebas (WASD + kolisi kapsul)
    │   └── KontrolMaket.js     # Kontrol orbit untuk mode Maket 3D
    └── antarmuka/
        └── PengontrolUI.js     # Penghubung event UI, minimap, & tur otomatis
```

## Cara Membuka Model SketchUp

Buka langsung file `Rumah_Minimalis_3D.skp` di **SketchUp** untuk meninjau struktur layer/grup arsitektur serta `9` Scene tur yang sudah tersimpan.

## Cara Menjalankan Tur Virtual 3D

1. Jalankan `Buka_Tur_3D.bat` (Windows) atau jalankan di terminal:
   ```bash
   python server_lokal.py --port 8080
   ```
2. Buka browser ke `http://127.0.0.1:8080/index.html`.
3. Gunakan **Tur** (`Tab 1–9`), **Jelajah** (`WASD` / `Panah` + `Shift` lari, atau klik denah untuk teleportasi), atau **Maket** (`M` potong atap + putar orbit).
