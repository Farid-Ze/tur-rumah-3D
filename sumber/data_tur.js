export const FLOORPLAN_BOUNDS = {
  minX: -6.40,
  maxX: 0.40,
  minZ: -14.40,
  maxZ: 0.60,
  width: 6.80,
  depth: 15.00,
};

// Coordinates in Three.js Y-up (Blender X, Z, -Y)
// Matches the 9 native SketchUp Scenes embedded in Rumah_Render_2_Rev.skp
export const TOUR_STOPS = [
  {
    id: '01_Fasad_Carport',
    number: '01',
    shortLabel: 'Fasad',
    title: 'Fasad Depan & Carport',
    description: 'Tampak depan rumah modern minimalis tropis dengan kanopi carport skylight kaca & kisi kayu oak.',
    eye: [-2.50, 1.65, 2.50],
    target: [-2.60, 1.80, -5.50],
    fov: 58,
    dollhouse: false,
    dwellMs: 5500,
  },
  {
    id: '02_Teras_Depan',
    number: '02',
    shortLabel: 'Teras',
    title: 'Teras & Pintu Utama',
    description: 'Area teras depan dengan kisi kayu vertikal hangat & pintu utama walnut yang terbuka ke ruang keluarga.',
    eye: [-2.48, 1.65, -4.90],
    target: [-2.15, 1.45, -8.20],
    fov: 68,
    dollhouse: false,
    dwellMs: 4800,
  },
  {
    id: '03_Ruang_Tamu',
    number: '03',
    shortLabel: 'R. Tamu',
    title: 'Ruang Tamu & Keluarga',
    description: 'Ruang tamu lega dengan panel kisi kayu TV di dinding penuh, sofa linen lembut, meja kopi oak, & partisi glass block.',
    eye: [-2.10, 1.65, -8.70],
    target: [-1.35, 1.15, -6.95],
    fov: 70,
    dollhouse: false,
    dwellMs: 5500,
  },
  {
    id: '04_Dapur_Dining',
    number: '04',
    shortLabel: 'Dapur',
    title: 'Dapur & Meja Island',
    description: 'Kitchen set kabinet oak hangat, backsplash keramik kilap dengan LED bawah kabinet, & meja island menghadap taman.',
    eye: [-1.62, 1.56, -10.35],
    target: [-1.42, 1.38, -13.75],
    fov: 76,
    dollhouse: false,
    dwellMs: 5500,
  },
  {
    id: '05_Inner_Courtyard',
    number: '05',
    shortLabel: 'Taman',
    title: 'Inner Courtyard & Laundry',
    description: 'Taman dalam ruang terbuka langsung ke langit dengan pergola cahaya alami, tanaman hijau, & area cuci.',
    eye: [-3.30, 1.65, -12.20],
    target: [-4.80, 1.10, -13.50],
    fov: 65,
    dollhouse: false,
    dwellMs: 5500,
  },
  {
    id: '06_Kamar_Utama',
    number: '06',
    shortLabel: 'K. Utama',
    title: 'Kamar Tidur Utama',
    description: 'Kamar utama menghadap taman depan dengan ranjang double, meja nakas, & lemari pakaian pintu geser.',
    eye: [-3.60, 1.65, -7.35],
    target: [-4.85, 0.90, -5.75],
    fov: 65,
    dollhouse: false,
    dwellMs: 5200,
  },
  {
    id: '07_Kamar_Mandi',
    number: '07',
    shortLabel: 'K. Mandi',
    title: 'Kamar Mandi Modern',
    description: 'Kamar mandi bernuansa batu abu dengan shower kaca tempered, kloset monobloc, wastafel kabinet oak, & cermin.',
    eye: [-4.30, 1.65, -8.75],
    target: [-5.60, 1.10, -8.40],
    fov: 68,
    dollhouse: false,
    dwellMs: 5000,
  },
  {
    id: '08_Kamar_2',
    number: '08',
    shortLabel: 'Kamar 2',
    title: 'Kamar Tidur 2 / Kerja',
    description: 'Kamar anak atau ruang kerja yang nyaman dengan single bed, meja belajar lengkap kursi ergonomis & rak dinding.',
    eye: [-3.65, 1.65, -9.75],
    target: [-5.00, 0.95, -11.20],
    fov: 65,
    dollhouse: false,
    dwellMs: 5200,
  },
  {
    id: '09_Maket_3D',
    number: '09',
    shortLabel: 'Maket 3D',
    title: 'Tampak Atas Maket 3D',
    description: 'Potongan perspektif aksonometri dengan atap terbuka untuk melihat keseluruhan zonasi & alur sirkulasi ruangan.',
    eye: [8.50, 13.50, 4.50],
    target: [-3.00, 1.10, -7.20],
    fov: 45,
    dollhouse: true,
    dwellMs: 6500,
  },
];

export function detectRoomLabel(x, z) {
  if (z > 0.0) return 'Jalan Depan';
  if (z > -4.5) return 'Carport Depan';
  if (z > -6.1 && x > -3.05) return 'Teras Utama';
  if (x <= -3.1 && z >= -7.75 && z <= -5.2) return 'Kamar Tidur Utama';
  if (x <= -4.1 && z >= -9.25 && z < -7.75) return 'Kamar Mandi';
  if (x <= -3.1 && z >= -12.0 && z < -9.25) return 'Kamar Tidur 2';
  if (x <= -3.05 && z < -12.0) return 'Inner Courtyard';
  if (x > -4.1 && x <= -3.1 && z >= -9.3 && z < -7.75) return 'Koridor Kamar';
  if (x > -3.1 && z >= -10.0) return 'Ruang Tamu';
  if (x > -3.1 && z < -10.0) return 'Dapur & Ruang Makan';
  return 'Area Rumah';
}
