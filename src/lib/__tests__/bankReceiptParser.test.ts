import { describe, it, expect } from 'vitest';
import { parseBankTransferReceipt } from '../bankReceiptParser';

describe('parseBankTransferReceipt', () => {
  it('parsea fielmente el comprobante de pago interbancario de BBVA Net Cash enviado por el usuario', () => {
    const ocrText = `
    Fecha y hora de consulta 31/08/2026 7:54:30 PM Contrato 00027758
    Nombre del Cliente GRUPO TEXTIL PROVIDENCIA SA DE CV
    BBVA Net Cash - Pagos Interbancarios
    Operación autorizada
    Transferencia en proceso de validación y aplicación.
    Datos del firmante
    Usuario: ANRI69 Poder: 50%
    Datos de la operación
    Tipo de operación: Pago Interbancario
    Descripción: PAGO Importe de la operación: 106,720.17 MXP
    Cuenta de retiro: 0102400200 Cuenta de depósito: 030650900035267969
    Divisa de la cuenta: MXP Divisa de la cuenta: MXP
    Titular de la cuenta: GRUPO TEXTIL PROVIDENCIA SA DE CV Titular de la cuenta: ELEMENTAL DENIM SA DE CV
    Nombre banco destino: BAJIO Fecha valor: 01/09/2026
    Fecha de creación: 31/08/2026 Fecha de aplicación: 31/08/2026
    Concepto de pago: PAGO Referencia numérica: 010
    Instrumento de seguridad: ASD 6550868985 Hora de captura en el canal: 19:54:27
    Datos de confirmación de la transferencia
    Folio interbancario: 0000892965 Clave de rastreo: 002601002609010000892965
    Folio de firma: 0064008513 Folio único: I401202608311954270070306099
    Estado operación
    Porcentaje Firmado: 100% Estado: Operado
    `;

    const result = parseBankTransferReceipt(ocrText);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(106720.17);
    expect(result?.paymentDate).toBe('31/08/2026');
    expect(result?.bankSource).toBe('BBVA');
    expect(result?.bankDest).toBe('BAJIO');
    expect(result?.accountSource).toBe('0102400200');
    expect(result?.accountDest).toBe('030650900035267969');
    expect(result?.claveRastreo).toBe('002601002609010000892965');
    expect(result?.folioFirma).toBe('0064008513');
    expect(result?.folioInterbancario).toBe('0000892965');
    expect(result?.folioUnico).toBe('I401202608311954270070306099');
    expect(result?.status).toBe('Operado');
  });
});
