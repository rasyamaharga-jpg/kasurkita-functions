const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const { idPesanan } = req.query;
  if (!idPesanan) return res.status(400).json({ status: 'error', message: 'idPesanan wajib diisi' });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${encodeURIComponent(idPesanan)}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    if (!data.length) {
      return res.status(404).json({ status: 'error', message: `Pesanan '${idPesanan}' tidak ditemukan` });
    }
    const p = data[0];
    res.status(200).json({
      status: 'success',
      idPesanan: p.id_pesanan,
      tanggal: p.tanggal,
      nama: p.nama_pembeli,
      idVarian: p.id_varian,
      idMotif: p.id_motif,
      jumlah: p.jumlah_beli,
      totalHarga: p.total_harga,
      kotaTujuan: p.kota_tujuan,
      statusPesanan: p.status,
      noResi: p.no_resi || '',
      kurir: p.kurir || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Gagal cek status' });
  }
}
