function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function stripAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

/** CRC-16/CCITT-FALSE, as required by the EMVCo BR Code spec. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
}

/** Builds a static EMVCo "Pix Copia e Cola" payload with the amount pre-filled. */
export function buildPixPayload({ key, merchantName, merchantCity, amount, txId }: PixPayloadInput): string {
  const name = stripAccents(merchantName).toUpperCase().slice(0, 25) || "AUPALE";
  const city = stripAccents(merchantCity).toUpperCase().slice(0, 15) || "SAO PAULO";
  const identifier = (txId || "***").slice(0, 25);

  const merchantAccountInfo = emv("00", "br.gov.bcb.pix") + emv("01", key);
  const additionalData = emv("05", identifier);

  const payloadWithoutCrc =
    emv("00", "01") +
    emv("26", merchantAccountInfo) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount.toFixed(2)) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    emv("62", additionalData) +
    "6304";

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}
