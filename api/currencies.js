const fallbackCurrencies = {
    AUD: 'Australian dollar',
    BRL: 'Brazilian real',
    CAD: 'Canadian dollar',
    CHF: 'Swiss franc',
    CNY: 'Chinese yuan',
    EUR: 'Euro',
    GBP: 'British pound',
    HKD: 'Hong Kong dollar',
    IDR: 'Indonesian rupiah',
    INR: 'Indian rupee',
    JPY: 'Japanese yen',
    KRW: 'South Korean won',
    MYR: 'Malaysian ringgit',
    NZD: 'New Zealand dollar',
    PHP: 'Philippine peso',
    SGD: 'Singapore dollar',
    THB: 'Thai baht',
    USD: 'United States dollar',
    VND: 'Vietnamese dong',
};

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.setHeader('Cache-Control', 'no-store');
        res.status(405).json({ success: false, error: 'Metode permintaan tidak diizinkan.' });
        return;
    }
    if (Object.keys(req.query || {}).length > 0) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(400).json({ success: false, error: 'Parameter permintaan tidak dikenal.' });
        return;
    }

    try {
        const response = await fetch('https://api.frankfurter.app/currencies', {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error(`Provider returned ${response.status}`);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid currency list');

        const currencies = {};
        for (const [rawCode, rawName] of Object.entries(payload).slice(0, 500)) {
            const code = rawCode.toUpperCase();
            if (/^[A-Z]{3}$/.test(code) && typeof rawName === 'string') {
                currencies[code] = rawName.slice(0, 100);
            }
        }
        if (!Object.keys(currencies).length) throw new Error('Empty currency list');
        res.status(200).json({ success: true, currencies });
    } catch (error) {
        res.status(200).json({ success: true, currencies: fallbackCurrencies, fallback: true });
    }
};
