
export const CURRENCIES = [
    { code: 'BRL', name: 'Real Brasileiro', locale: 'pt-BR' },
    { code: 'USD', name: 'Dólar Americano', locale: 'en-US' },
    { code: 'EUR', name: 'Euro', locale: 'de-DE' },
    { code: 'GBP', name: 'Libra Esterlina', locale: 'en-GB' },
    { code: 'JPY', name: 'Iene Japonês', locale: 'ja-JP' },
    { code: 'AUD', name: 'Dólar Australiano', locale: 'en-AU' },
    { code: 'CAD', name: 'Dólar Canadense', locale: 'en-CA' },
    { code: 'CHF', name: 'Franco Suíço', locale: 'de-CH' },
    { code: 'CNY', name: 'Yuan Chinês', locale: 'zh-CN' },
    { code: 'SEK', name: 'Coroa Sueca', locale: 'sv-SE' },
    { code: 'NZD', name: 'Dólar Neozelandês', locale: 'en-NZ' },
    { code: 'MXN', name: 'Peso Mexicano', locale: 'es-MX' },
    { code: 'SGD', name: 'Dólar de Singapura', locale: 'en-SG' },
    { code: 'HKD', name: 'Dólar de Hong Kong', locale: 'zh-HK' },
    { code: 'NOK', name: 'Coroa Norueguesa', locale: 'nb-NO' },
    { code: 'KRW', name: 'Won Sul-Coreano', locale: 'ko-KR' },
    { code: 'TRY', name: 'Lira Turca', locale: 'tr-TR' },
    { code: 'RUB', name: 'Rublo Russo', locale: 'ru-RU' },
    { code: 'INR', name: 'Rupia Indiana', locale: 'hi-IN' },
    { code: 'ZAR', name: 'Rand Sul-Africano', locale: 'en-ZA' },
    { code: 'DKK', name: 'Coroa Dinamarquesa', locale: 'da-DK' },
    { code: 'PLN', name: 'Złoty Polonês', locale: 'pl-PL' },
    { code: 'THB', name: 'Baht Tailandês', locale: 'th-TH' },
    { code: 'IDR', name: 'Rupia Indonésia', locale: 'id-ID' },
    { code: 'HUF', name: 'Florim Húngaro', locale: 'hu-HU' },
    { code: 'CZK', name: 'Coroa Checa', locale: 'cs-CZ' },
    { code: 'ILS', name: 'Shekel Israelense', locale: 'he-IL' }
];

// Fallback rates (Base BRL) - approximate values
const MOCK_RATES: Record<string, number> = {
    'BRL': 1,
    'USD': 5.85,
    'EUR': 6.15,
    'GBP': 7.35,
    'JPY': 0.038,
    'AUD': 3.80,
    'CAD': 4.15,
    'CHF': 6.50,
    'CNY': 0.80,
    'SEK': 0.53,
    'NZD': 3.45,
    'MXN': 0.28,
    'SGD': 4.30,
    'HKD': 0.75,
    'NOK': 0.52,
    'KRW': 0.0041,
    'TRY': 0.17,
    'RUB': 0.058,
    'INR': 0.068,
    'ZAR': 0.32,
    'DKK': 0.82,
    'PLN': 1.45,
    'THB': 0.17,
    'IDR': 0.00037,
    'HUF': 0.015,
    'CZK': 0.24,
    'ILS': 1.60
};

export const fetchExchangeRates = async (): Promise<Record<string, number>> => {
    try {
        // Try to fetch from a free API if possible, or fallback
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/BRL');
        if (response.ok) {
            const data = await response.json();
            // API returns based on BRL, so USD would be 0.17. We want BRL based on USD (how much 1 USD is in BRL).
            // Actually, if base is BRL, data.rates.USD = 0.17.
            // We want to convert FROM Foreign TO BRL.
            // If I have 10 USD.
            // Rate BRL->USD is 0.17.
            // 10 USD / 0.17 = 58.8 BRL.
            // Let's store rates as "Multiplier to get BRL".
            // If API gives BRL base:
            // Rate for USD is 0.17. Multiplier is 1/0.17.
            const rates: Record<string, number> = {};
            Object.keys(data.rates).forEach(key => {
                rates[key] = 1 / data.rates[key];
            });
            return rates;
        }
        return MOCK_RATES;
    } catch (e) {
        console.warn("Failed to fetch rates, using fallback", e);
        return MOCK_RATES;
    }
};

export const convertToBRL = (amount: number, currency: string, rates: Record<string, number>): number => {
    const rate = rates[currency] || MOCK_RATES[currency] || 1;
    return amount * rate;
};

export const formatCurrency = (amount: number, currency: string) => {
    const locale = CURRENCIES.find(c => c.code === currency)?.locale || 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
};
