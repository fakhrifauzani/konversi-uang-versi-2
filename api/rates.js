const cryptoIds = ['bitcoin', 'ethereum', 'tether', 'binancecoin', 'usd-coin'];

async function fetchJson(url, timeoutMs = 4000) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return response.json();
}

function normalizeFiatRates(response) {
    if (!response || !response.rates || typeof response.rates !== 'object' || Array.isArray(response.rates)) return null;
    const entries = Object.entries(response.rates);
    if (entries.length > 500) return null;

    const rates = { USD: 1 };
    for (const [rawCode, rawRate] of entries) {
        const code = rawCode.toUpperCase();
        const rate = Number(rawRate);
        if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) rates[code] = rate;
    }
    return {
        data: {
            base: 'USD',
            date: typeof response.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(response.date) ? response.date : '',
            rates,
        },
        fetched_at: Math.floor(Date.now() / 1000),
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.setHeader('Cache-Control', 'no-store');
        res.status(405).json({ success: false, error: 'Metode permintaan tidak diizinkan.' });
        return;
    }

    const query = req.query || {};
    const queryKeys = Object.keys(query);
    if (queryKeys.some((key) => key !== 'refresh') || (query.refresh !== undefined && query.refresh !== '1')) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(400).json({ success: false, error: 'Parameter permintaan tidak dikenal.' });
        return;
    }

    const ids = encodeURIComponent(cryptoIds.join(','));
    const [cryptoResult, fiatResult] = await Promise.allSettled([
        fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`),
        fetchJson('https://api.exchangerate.fun/latest?base=USD'),
    ]);

    let crypto = null;
    if (cryptoResult.status === 'fulfilled') {
        const data = cryptoResult.value;
        const complete = cryptoIds.every((id) => Number.isFinite(Number(data?.[id]?.usd)) && Number(data[id].usd) > 0);
        if (complete) {
            const cleanData = {};
            for (const id of cryptoIds) {
                cleanData[id] = { usd: Number(data[id].usd) };
                const timestamp = Number(data[id].last_updated_at);
                if (Number.isFinite(timestamp) && timestamp > 0) cleanData[id].last_updated_at = timestamp;
            }
            const timestamps = cryptoIds
                .map((id) => Number(cleanData[id].last_updated_at))
                .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
            crypto = {
                data: cleanData,
                fetched_at: Math.floor(Date.now() / 1000),
                rate_updated_at: timestamps.length ? Math.min(...timestamps) : Math.floor(Date.now() / 1000),
                source: 'CoinGecko',
            };
        }
    }

    let fiat = fiatResult.status === 'fulfilled' ? normalizeFiatRates(fiatResult.value) : null;
    if (fiat) {
        fiat.source = 'ExchangeRate.fun';
    } else {
        try {
            const fallback = await fetchJson('https://api.frankfurter.app/latest?from=USD', 3000);
            fiat = normalizeFiatRates(fallback);
            if (fiat) fiat.source = 'Frankfurter (cadangan harian)';
        } catch (error) {
            // Keep serving whichever provider succeeded.
        }
    }

    if (!crypto && !fiat) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(503).json({ success: false, error: 'Kurs sedang tidak tersedia. Coba lagi sebentar.' });
        return;
    }

    res.status(200).json({ success: true, crypto, fiat });
};
