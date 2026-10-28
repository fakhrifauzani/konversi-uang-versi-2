const allowedCoins = new Set(['bitcoin', 'ethereum', 'tether', 'binancecoin', 'usd-coin']);
const allowedDays = new Set([1, 7, 30]);

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.setHeader('Cache-Control', 'no-store');
        res.status(405).json({ success: false, error: 'Metode permintaan tidak diizinkan.' });
        return;
    }
    if (Object.keys(req.query || {}).some((key) => key !== 'id' && key !== 'days')) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(400).json({ success: false, error: 'Parameter permintaan tidak dikenal.' });
        return;
    }

    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    const rawDays = req.query?.days === undefined ? '7' : req.query.days;
    const days = typeof rawDays === 'string' ? Number(rawDays) : NaN;
    if (!allowedCoins.has(id) || !allowedDays.has(days)) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(422).json({ success: false, error: 'Pilihan grafik tidak valid.' });
        return;
    }

    try {
        const upstream = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
        });
        if (!upstream.ok) throw new Error(`Provider returned ${upstream.status}`);
        const data = await upstream.json();
        if (!Array.isArray(data?.prices)) throw new Error('Invalid chart response');

        const prices = data.prices
            .filter((point) => Array.isArray(point) && point.length >= 2)
            .map(([timestamp, price]) => [Number(timestamp), Number(price)])
            .filter(([timestamp, price]) => Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(price) && price > 0)
            .slice(-1000);
        if (!prices.length) throw new Error('Empty chart response');
        res.status(200).json({ success: true, prices });
    } catch (error) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(503).json({ success: false, error: 'Data grafik sedang tidak tersedia.' });
    }
};
