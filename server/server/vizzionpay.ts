const API_BASE = 'https://app.vizzionpay.com/api/v1';
const PUBLIC_KEY = process.env.VIZZION_PAY_PUBLIC!;
const SECRET_KEY = process.env.VIZZION_PAY_SECRET!;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

const headers = {
  'Content-Type': 'application/json',
  'x-public-key': PUBLIC_KEY,
  'x-secret-key': SECRET_KEY,
};

export async function createPixPayment(amount: number, description: string, userId: number) {
  const identifier = `madame_${userId}_${generateId()}`;

  const body = {
    identifier,
    amount,
    client: {
      name: `User ${userId}`,
      email: `user${userId}@madamestore.com`,
      phone: '11999999999',
      document: '12345678909',
    },
  };

  const res = await fetch(`${API_BASE}/gateway/pix/receive`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.text();
    console.error('VizzionPay error:', errorData);
    throw new Error(`VizzionPay error: ${res.status}`);
  }

  const data = await res.json();
  return data;
}

export async function checkPaymentStatus(transactionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/gateway/transactions?id=${transactionId}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    if (data.status === 'COMPLETED') return 'approved';
    if (data.status === 'PENDING') return 'pending';
    if (data.status === 'FAILED' || data.status === 'REFUNDED' || data.status === 'CHARGED_BACK') return 'cancelled';
    return data.status?.toLowerCase() || null;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return null;
  }
}
