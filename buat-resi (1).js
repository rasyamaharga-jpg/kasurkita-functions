// Netlify Function - Buat Resi Biteship
exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options'      : 'nosniff'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Body tidak valid' }) }; }

  const { adminPass, pesanan, courierCode, courierService, destinationAreaId } = body;

  if (!adminPass || adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return { statusCode: 403, headers, body: JSON.stringify({ status: 'error', message: 'Akses ditolak' }) };
  }

  if (!pesanan || !courierCode || !courierService || !destinationAreaId) {
    return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Data tidak lengkap' }) };
  }

  try {
    const response = await fetch('https://api.biteship.com/v1/orders', {
      method : 'POST',
      headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        shipper_contact_name     : 'KasurKita',
        shipper_contact_phone    : '628561516488',
        shipper_contact_email    : 'kasurkita@email.com',
        shipper_organization     : 'KasurKita',
        origin_contact_name      : 'KasurKita',
        origin_contact_phone     : '628561516488',
        origin_address           : 'Jl. Pramuka RT4/RW15 Godean',
        origin_area_id           : process.env.ORIGIN_AREA_ID,
        origin_postal_code       : 57554,
        destination_contact_name : String(pesanan.nama).slice(0, 100),
        destination_contact_phone: String(pesanan.noWA).replace(/\D/g, '').slice(0, 15),
        destination_address      : String(pesanan.alamat).slice(0, 255),
        destination_area_id      : destinationAreaId,
        destination_postal_code  : 0,
        courier_company          : courierCode,
        courier_type             : courierService,
        delivery_type            : 'now',
        order_note               : `ID: ${String(pesanan.idPesanan).slice(0, 50)}`,
        items: [{
          name       : `Sprei ${String(pesanan.idVarian).slice(0, 50)}`,
          description: `Motif: ${String(pesanan.idMotif).slice(0, 50)}`,
          value      : Math.max(1000, parseInt(pesanan.totalHarga) || 100000),
          weight     : Math.min(50000, Math.max(100, parseInt(pesanan.berat) || 1000)),
          quantity   : Math.min(100, Math.max(1, parseInt(pesanan.jumlah) || 1))
        }]
      })
    });

    const data = await response.json();
    if (!data.success) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: data.error || 'Gagal buat resi' }) };

    const noResi = data.courier?.waybill_id || data.id;
    const kurir  = `${courierCode.toUpperCase()} - ${courierService}`;

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', noResi, kurir, orderId: data.id }) };

  } catch (err) {
    console.error('[buat-resi]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Terjadi kesalahan, coba lagi.' }) };
  }
};
