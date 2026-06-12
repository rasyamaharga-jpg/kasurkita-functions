export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  // Bersihkan trailing slash
  const baseUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, '') : null;
  const fullUrl = `${baseUrl}/rest/v1/produk`;
  
  // Kembalikan info debug
  return res.status(200).json({
    debug: true,
    rawSupabaseUrl: supabaseUrl,
    baseUrl: baseUrl,
    fullUrl: fullUrl,
    hasKey: !!supabaseKey,
    keyPrefix: supabaseKey ? supabaseKey.substring(0, 10) : null
  });
}
