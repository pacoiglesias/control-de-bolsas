import { fromInputDate, toInputDate } from './format';

export function resolveInvoiceDates(issueValue: string, dueValue: string, creditDays: number) {
  const parse = (value: string) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromInputDate(value) : null;
    if (!date || !Number.isFinite(date.getTime()) || toInputDate(date) !== value) throw new Error('Revisa las fechas de la factura y su vencimiento.');
    return date;
  };
  const issue = parse(issueValue);
  const due = dueValue ? parse(dueValue) : new Date(issue);
  if (!dueValue) due.setDate(due.getDate() + Math.max(0, creditDays));
  if (due.getTime() < issue.getTime()) throw new Error('El vencimiento no puede ser anterior a la factura.');
  return { issue, due };
}
