const allowedCoins = new Set(['bitcoin', 'ethereum', 'tether', 'binancecoin', 'usd-coin']);
const allowedDays = new Set([1, 7, 30]);

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    const days = Number(req.query?.days || 7);
    if (!allowedCoins.has(id) || !allowedDays.has(days)) {
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
        if (!Array.isArray(data.prices)) throw new Error('Invalid chart response');
        res.status(200).json({ success: true, prices: data.prices });
    } catch (error) {
        res.status(503).json({ success: false, error: 'Data grafik sedang tidak tersedia.' });
    }
};
