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

    try {
        const response = await fetch('https://api.frankfurter.app/currencies', {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error(`Provider returned ${response.status}`);
        const currencies = await response.json();
        if (!currencies || typeof currencies !== 'object' || Array.isArray(currencies)) throw new Error('Invalid currency list');
        res.status(200).json({ success: true, currencies });
    } catch (error) {
        res.status(200).json({ success: true, currencies: fallbackCurrencies, fallback: true });
    }
};
