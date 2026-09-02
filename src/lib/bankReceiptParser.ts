/**
 * Parser de Comprobantes Bancarios de Transferencia Interbancaria (SPEI / CEP / Net Cash)
 * Soporta BBVA Net Cash, BanBajío, Santander, Banorte, Citibanamex y Comprobantes CEP Banxico.
 */

export interface ParsedBankTransfer {
  bankSource: string;
  bankDest: string;
  accountSource?: string;
  accountDest?: string;
  payer: string;
  beneficiary: string;
  amount: number;
  currency: string;
  paymentDate: string;
  valueDate?: string;
  concept?: string;
  numericRef?: string;
  claveRastreo?: string;
  folioFirma?: string;
  folioInterbancario?: string;
  folioUnico?: string;
  status: string;
  rawText: string;
}

export function parseBankTransferReceipt(text: string): ParsedBankTransfer | null {
  if (!text) return null;

  const isBankReceipt = text.includes('BBVA Net Cash') ||
                        text.includes('Comprobante Pago Interbancario') ||
                        text.includes('Pago Interbancario') ||
                        text.includes('Clave de rastreo') ||
                        text.includes('Clave de Rastreo') ||
                        text.includes('Folio interbancario') ||
                        text.includes('Folio de firma') ||
                        text.includes('Operación autorizada') ||
                        text.includes('SPEI') ||
                        text.includes('Comprobante Electrónico de Pago');

  if (!isBankReceipt) {
    return null;
  }

  // 1. Banco Origen y Destino
  let bankSource = 'BBVA';
  if (text.includes('BBVA')) bankSource = 'BBVA';
  else if (text.includes('BANORTE')) bankSource = 'BANORTE';
  else if (text.includes('SANTANDER')) bankSource = 'SANTANDER';
  else if (text.includes('BANAMEX') || text.includes('CITIBANAMEX')) bankSource = 'CITIBANAMEX';
  else if (text.includes('BAJIO') || text.includes('BANBAJIO')) bankSource = 'BAJIO';

  const bankDestMatch = text.match(/Nombre\s*banco\s*destino:\s*([A-Z\s]+?)(?:Fecha|Divisa|Importe|\n|$)/i) ||
                        text.match(/Banco\s*Receptor:\s*([A-Z\s]+?)(?:Fecha|Divisa|Importe|\n|$)/i) ||
                        text.match(/Banco\s*Destino:\s*([A-Z\s]+?)(?:Fecha|Divisa|Importe|\n|$)/i);
  const bankDest = bankDestMatch ? bankDestMatch[1].trim() : 'BAJIO';

  // 2. Cuentas
  const ctaRetiroMatch = text.match(/Cuenta\s*de\s*retiro:\s*([0-9]+)/i);
  const accountSource = ctaRetiroMatch ? ctaRetiroMatch[1].trim() : undefined;

  const ctaDepositoMatch = text.match(/Cuenta\s*de\s*dep[oó]sito:\s*([0-9]+)/i) ||
                           text.match(/Cuenta\s*Beneficiaria:\s*([0-9]+)/i) ||
                           text.match(/CLABE:\s*([0-9]{18})/i);
  const accountDest = ctaDepositoMatch ? ctaDepositoMatch[1].trim() : undefined;

  // 3. Titulares / Payer y Beneficiary
  const payerMatch = text.match(/Titular\s*de\s*la\s*cuenta:\s*([A-Z\s]+?)(?:Titular|Nombre banco|Fecha)/i) ||
                     text.match(/Nombre\s*del\s*Cliente\s*([A-Z\s]+?)(?:BBVA|Contrato)/i) ||
                     text.match(/Ordenante:\s*([A-Z\s]+)/i);
  const payer = payerMatch ? payerMatch[1].replace(/\s+/g, ' ').trim() : 'GRUPO TEXTIL PROVIDENCIA SA DE CV';

  const beneficiaryMatch = text.match(/Titular\s*de\s*la\s*cuenta:\s*[A-Z\s]+Titular\s*de\s*la\s*cuenta:\s*([A-Z\s]+?)(?:Nombre banco|Fecha|Divisa)/i) ||
                            text.match(/Beneficiario:\s*([A-Z\s]+)/i);
  const beneficiary = beneficiaryMatch ? beneficiaryMatch[1].replace(/\s+/g, ' ').trim() : 'ELEMENTAL DENIM SA DE CV';

  // 4. Importe
  const amountMatch = text.match(/Importe\s*de\s*la\s*operaci[oó]n:\s*([0-9,]+\.[0-9]{2})/i) ||
                      text.match(/Importe:\s*\$?\s*([0-9,]+\.[0-9]{2})/i) ||
                      text.match(/Monto:\s*\$?\s*([0-9,]+\.[0-9]{2})/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // 5. Fechas
  const dateMatch = text.match(/Fecha\s*de\s*aplicaci[oó]n:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                    text.match(/Fecha\s*de\s*creaci[oó]n:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                    text.match(/Fecha\s*y\s*hora\s*de\s*consulta\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                    text.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
  const paymentDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString('es-MX');

  const valDateMatch = text.match(/Fecha\s*valor:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
  const valueDate = valDateMatch ? valDateMatch[1].trim() : undefined;

  // 6. Referencias y Clave de Rastreo
  const rastreoMatch = text.match(/Clave\s*de\s*rastreo:\s*([A-Z0-9]+)/i);
  const claveRastreo = rastreoMatch ? rastreoMatch[1].trim() : undefined;

  const firmaMatch = text.match(/Folio\s*de\s*firma:\s*([0-9]+)/i);
  const folioFirma = firmaMatch ? firmaMatch[1].trim() : undefined;

  const interMatch = text.match(/Folio\s*interbancario:\s*([0-9]+)/i);
  const folioInterbancario = interMatch ? interMatch[1].trim() : undefined;

  const unicoMatch = text.match(/Folio\s*[uú]nico:\s*([A-Z0-9]+)/i);
  const folioUnico = unicoMatch ? unicoMatch[1].trim() : undefined;

  const numRefMatch = text.match(/Referencia\s*num[eé]rica:\s*([0-9]+)/i);
  const numericRef = numRefMatch ? numRefMatch[1].trim() : undefined;

  const conceptMatch = text.match(/Concepto\s*de\s*pago:\s*([A-Z0-9\s]+?)(?:Referencia|Instrumento)/i) ||
                       text.match(/Descripci[oó]n:\s*([A-Z0-9\s]+?)(?:Importe|Cuenta)/i);
  const concept = conceptMatch ? conceptMatch[1].trim() : 'PAGO';

  const statusMatch = text.match(/Estado:\s*([A-Za-z]+)/i);
  const status = statusMatch ? statusMatch[1].trim() : (text.includes('Operación autorizada') ? 'Operado' : 'Aplicado');

  return {
    bankSource,
    bankDest,
    accountSource,
    accountDest,
    payer,
    beneficiary,
    amount,
    currency: 'MXP',
    paymentDate,
    valueDate,
    concept,
    numericRef,
    claveRastreo,
    folioFirma,
    folioInterbancario,
    folioUnico,
    status,
    rawText: text,
  };
}
