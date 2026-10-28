document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'konversi-uang-history-v1';
    const MAX_HISTORY = 100;
    const cryptoCoins = [
        ['bitcoin', 'Bitcoin'],
        ['ethereum', 'Ethereum'],
        ['tether', 'Tether'],
        ['binancecoin', 'Binance Coin'],
        ['usd-coin', 'USD Coin'],
    ];
    const fallbackCurrencies = {
        AUD: 'Australian dollar', BRL: 'Brazilian real', CAD: 'Canadian dollar', CHF: 'Swiss franc',
        CNY: 'Chinese yuan', EUR: 'Euro', GBP: 'British pound', HKD: 'Hong Kong dollar',
        IDR: 'Indonesian rupiah', INR: 'Indian rupee', JPY: 'Japanese yen', KRW: 'South Korean won',
        MYR: 'Malaysian ringgit', NZD: 'New Zealand dollar', PHP: 'Philippine peso', SGD: 'Singapore dollar',
        THB: 'Thai baht', USD: 'United States dollar', VND: 'Vietnamese dong',
    };

    const form = document.getElementById('convertForm');
    const amount = document.getElementById('amount');
    const from = document.getElementById('from');
    const to = document.getElementById('to');
    const submitButton = document.getElementById('submitBtn');
    const swapButton = document.getElementById('swapBtn');
    const message = document.getElementById('message');
    const preview = document.getElementById('conversionPreview');
    const tableBody = document.querySelector('#historyTable tbody');
    const emptyHistory = document.getElementById('emptyHistory');
    const refreshButton = document.getElementById('refreshRates');
    const clearAllButton = document.getElementById('clearAll');
    const exportButton = document.getElementById('exportCsv');
    const chartCoin = document.getElementById('chartCoin');
    const chartDays = document.getElementById('chartDays');
    const chartCanvas = document.getElementById('priceChart');

    let latestCryptoRates = {};
    let latestFiatRates = {};
    let history = readHistory();

    function readHistory() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(stored) ? stored.filter((row) => row && row.id).slice(0, MAX_HISTORY) : [];
        } catch (error) {
            return [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
            return true;
        } catch (error) {
            showNotice('Riwayat tidak dapat disimpan di browser ini.', 'error');
            return false;
        }
    }

    function showNotice(text, type = 'success') {
        const notice = document.getElementById('pageNotice');
        if (!notice) return;
        notice.textContent = text;
        notice.className = `notice notice-${type}`;
        window.setTimeout(() => notice.classList.add('is-hidden'), 5000);
    }

    function fmtNumber(value, min = 2, max = 8) {
        const number = Number(value);
        return Number.isFinite(number)
            ? number.toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max })
            : '—';
    }

    function setMessage(text, type = '') {
        if (!message) return;
        message.textContent = text;
        message.className = `message${type ? ` message-${type}` : ''}`;
    }

    function setCurrencyOptions(currencies) {
        const selectedFrom = from.value;
        const selectedTo = to.value;
        const fiatOptions = Object.entries(currencies)
            .filter(([code]) => /^[A-Z]{3}$/.test(code))
            .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

        for (const select of [from, to]) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Pilih mata uang';
            const fiatGroup = document.createElement('optgroup');
            fiatGroup.label = 'Fiat';
            for (const [code, name] of fiatOptions) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${code} · ${name}`;
                fiatGroup.appendChild(option);
            }
            const cryptoGroup = document.createElement('optgroup');
            cryptoGroup.label = 'Crypto';
            for (const [id, name] of cryptoCoins) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${id.toUpperCase()} · ${name}`;
                cryptoGroup.appendChild(option);
            }
            select.replaceChildren(placeholder, fiatGroup, cryptoGroup);
        }

        if (selectedFrom) from.value = selectedFrom;
        if (selectedTo) to.value = selectedTo;
    }

    async function loadCurrencies() {
        try {
            const response = await fetch('/api/currencies', { cache: 'force-cache' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error('Currency list unavailable');
            setCurrencyOptions(payload.currencies || fallbackCurrencies);
        } catch (error) {
            setCurrencyOptions(fallbackCurrencies);
        }
        updatePreview();
    }

    function getQuote(value, fromCode, toCode) {
        const cryptoIds = cryptoCoins.map(([id]) => id);
        const fromCrypto = cryptoIds.includes(fromCode);
        const toCrypto = cryptoIds.includes(toCode);
        let result;

        if (fromCrypto && toCrypto) {
            const fromUsd = Number(latestCryptoRates[fromCode]?.usd);
            const toUsd = Number(latestCryptoRates[toCode]?.usd);
            if (!(fromUsd > 0) || !(toUsd > 0)) return null;
            result = value * fromUsd / toUsd;
        } else if (fromCrypto) {
            const coinUsd = Number(latestCryptoRates[fromCode]?.usd);
            const targetRate = Number(latestFiatRates[toCode]);
            if (!(coinUsd > 0) || !(targetRate > 0)) return null;
            result = value * coinUsd * targetRate;
        } else if (toCrypto) {
            const fromRate = Number(latestFiatRates[fromCode]);
            const coinUsd = Number(latestCryptoRates[toCode]?.usd);
            if (!(fromRate > 0) || !(coinUsd > 0)) return null;
            result = value / fromRate / coinUsd;
        } else {
            const fromRate = Number(latestFiatRates[fromCode]);
            const toRate = Number(latestFiatRates[toCode]);
            if (!(fromRate > 0) || !(toRate > 0)) return null;
            result = value * toRate / fromRate;
        }

        return Number.isFinite(result) ? result : null;
    }

    function updatePreview() {
        if (!preview) return;
        const value = Number(amount.value);
        if (!amount.value || !Number.isFinite(value) || value <= 0 || !from.value || !to.value) {
            preview.textContent = '';
            preview.classList.remove('has-value');
            return;
        }
        if (from.value === to.value) {
            preview.textContent = 'Pilih dua mata uang yang berbeda.';
            preview.classList.remove('has-value');
            return;
        }

        const result = getQuote(value, from.value, to.value);
        if (result === null) {
            preview.textContent = 'Memuat kurs terbaru…';
            preview.classList.remove('has-value');
            return;
        }
        preview.textContent = `${fmtNumber(value)} ${from.value.toUpperCase()} = ${fmtNumber(result)} ${to.value.toUpperCase()}`;
        preview.classList.add('has-value');
    }

    function addCell(row, value) {
        const td = document.createElement('td');
        td.textContent = value;
        row.appendChild(td);
        return td;
    }

    function renderHistory() {
        if (!tableBody) return;
        tableBody.replaceChildren();
        for (const item of history.slice(0, MAX_HISTORY)) {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            addCell(row, item.waktu || '');
            addCell(row, fmtNumber(item.jumlah));
            addCell(row, `${String(item.dari || '').toUpperCase()} ${item.simbol_dari || ''}`.trim());
            addCell(row, `${String(item.ke || '').toUpperCase()} ${item.simbol_ke || ''}`.trim());
            addCell(row, fmtNumber(item.hasil_numeric));
            const action = addCell(row, '');
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'button button-row-delete delete-btn';
            deleteButton.dataset.id = item.id;
            deleteButton.textContent = 'Hapus';
            action.appendChild(deleteButton);
            tableBody.appendChild(row);
        }
        if (emptyHistory) emptyHistory.classList.toggle('is-hidden', history.length > 0);
    }

    function formatTime(timestamp, stale = false) {
        if (!timestamp) return '—';
        const date = new Date(Number(timestamp) * 1000);
        if (!Number.isFinite(date.getTime())) return '—';
        const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (stale) {
            const day = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            return `tersimpan ${day} ${time}`;
        }
        return time;
    }

    async function updateRates(force = false) {
        if (refreshButton) refreshButton.disabled = true;
        try {
            const endpoint = force ? '/api/rates?refresh=1' : '/api/rates';
            const response = await fetch(endpoint, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Kurs tidak dapat diperbarui.');

            if (payload.crypto) {
                latestCryptoRates = payload.crypto.data || {};
                document.querySelectorAll('.crypto-list .price[data-id]').forEach((price) => {
                    const quote = latestCryptoRates[price.dataset.id];
                    if (quote && Number.isFinite(Number(quote.usd))) price.textContent = `$${fmtNumber(quote.usd, 2, 2)}`;
                });
                const updated = formatTime(payload.crypto.rate_updated_at || payload.crypto.fetched_at, Boolean(payload.crypto.stale));
                const cryptoUpdatedAt = document.getElementById('cryptoUpdatedAt');
                const ratesUpdatedAt = document.getElementById('ratesUpdatedAt');
                if (cryptoUpdatedAt) cryptoUpdatedAt.textContent = updated;
                if (ratesUpdatedAt) ratesUpdatedAt.textContent = updated;
            }

            if (payload.fiat) {
                latestFiatRates = payload.fiat.data?.rates || {};
                const fiatSource = document.getElementById('fiatSource');
                const fiatUpdatedAt = document.getElementById('fiatUpdatedAt');
                const isHourly = payload.fiat.source === 'ExchangeRate.fun';
                if (fiatSource) {
                    fiatSource.textContent = payload.fiat.source || 'Kurs fiat';
                    fiatSource.href = isHourly ? 'https://exchangerate.fun/' : 'https://frankfurter.dev/';
                }
                if (fiatUpdatedAt) {
                    const date = payload.fiat.data?.date || formatTime(payload.fiat.fetched_at);
                    const freshness = payload.fiat.stale ? 'data tersimpan' : `diperbarui per ${isHourly ? 'jam' : 'hari'}`;
                    fiatUpdatedAt.textContent = `kurs ${date} · ${freshness}`;
                }
            }
            updatePreview();
        } catch (error) {
            if (force) showNotice(error.message || 'Kurs gagal diperbarui.', 'error');
        } finally {
            if (refreshButton) refreshButton.disabled = false;
        }
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            setMessage('');
            const value = Number(amount.value);
            if (!amount.value || !Number.isFinite(value) || value <= 0) {
                setMessage('Masukkan jumlah yang lebih besar dari 0.', 'error');
                amount.focus();
                return;
            }
            if (!from.value || !to.value) {
                setMessage('Pilih mata uang asal dan tujuan.', 'error');
                return;
            }
            if (from.value === to.value) {
                setMessage('Pilih dua mata uang yang berbeda.', 'error');
                return;
            }

            const result = getQuote(value, from.value, to.value);
            if (result === null) {
                setMessage('Kurs belum tersedia. Coba perbarui kurs.', 'error');
                return;
            }

            const symbols = {
                usd: '$', idr: 'Rp', eur: '€', jpy: '¥', gbp: '£',
                bitcoin: '₿', ethereum: 'Ξ', tether: '₮', binancecoin: 'BNB', 'usd-coin': 'USDC',
            };
            const item = {
                id: (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                waktu: new Date().toLocaleString('id-ID'),
                jumlah: value,
                dari: from.value,
                ke: to.value,
                simbol_dari: symbols[from.value.toLowerCase()] || '',
                simbol_ke: symbols[to.value.toLowerCase()] || '',
                hasil_numeric: result,
            };
            history = [item, ...history].slice(0, MAX_HISTORY);
            const persisted = saveHistory();
            renderHistory();
            setMessage(`${fmtNumber(value)} ${item.dari.toUpperCase()} = ${fmtNumber(result)} ${item.ke.toUpperCase()}`, 'success');
            if (!persisted) showNotice('Konversi berhasil, tetapi riwayat browser tidak tersimpan.', 'error');
        });
    }

    if (swapButton) {
        swapButton.addEventListener('click', () => {
            [from.value, to.value] = [to.value, from.value];
            from.focus();
            updatePreview();
        });
    }
    if (amount) amount.addEventListener('input', updatePreview);
    if (from) from.addEventListener('change', updatePreview);
    if (to) to.addEventListener('change', updatePreview);
    if (refreshButton) refreshButton.addEventListener('click', () => updateRates(true));

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('.delete-btn');
            if (!button) return;
            history = history.filter((item) => String(item.id) !== button.dataset.id);
            saveHistory();
            renderHistory();
            setMessage('Riwayat berhasil dihapus.', 'success');
        });
    }

    if (clearAllButton) {
        clearAllButton.addEventListener('click', () => {
            if (!history.length) return;
            if (!window.confirm('Hapus seluruh riwayat konversi dari browser ini?')) return;
            history = [];
            saveHistory();
            renderHistory();
            setMessage('Seluruh riwayat berhasil dihapus.', 'success');
        });
    }

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            const rows = [
                ['waktu', 'jumlah', 'dari', 'simbol_dari', 'ke', 'simbol_ke', 'hasil'],
                ...history.map((item) => [item.waktu, item.jumlah, item.dari, item.simbol_dari, item.ke, item.simbol_ke, item.hasil_numeric]),
            ];
            const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
            const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `riwayat-konversi-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    let chart = null;
    if (chartCanvas && window.Chart) {
        chart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#315b50',
                    backgroundColor: 'rgba(49, 91, 80, 0.08)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 8,
                    fill: true,
                    tension: 0.3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 5, maxRotation: 0 } },
                    y: { beginAtZero: false, border: { display: false }, grid: { color: '#edf0ed' } },
                },
            },
        });
    }

    async function loadChart() {
        if (!chart || !chartCoin || !chartDays) return;
        try {
            const params = new URLSearchParams({ id: chartCoin.value, days: chartDays.value });
            const response = await fetch(`/api/history?${params}`, { cache: 'force-cache' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Grafik tidak tersedia.');
            const prices = payload.prices || [];
            chart.data.labels = prices.map(([timestamp]) => {
                const date = new Date(Number(timestamp));
                return chartDays.value === '1'
                    ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });
            chart.data.datasets[0].data = prices.map(([, price]) => price);
            chart.update();
        } catch (error) {
            console.warn('Grafik tidak dapat dimuat:', error.message);
        }
    }

    if (chartCoin) chartCoin.addEventListener('change', loadChart);
    if (chartDays) chartDays.addEventListener('change', loadChart);

    renderHistory();
    loadCurrencies();
    updateRates();
    loadChart();
    window.setInterval(() => updateRates(), 60000);
});
