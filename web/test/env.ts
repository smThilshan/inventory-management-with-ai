// next/jest does not load .env.local in tests; give lib/api a deterministic base URL.
process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
