import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./utils";
import { PAYMENT_METHODS } from "./constants";
import type { PaymentTotals } from "./cash";

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

interface DayRow {
  date: string;
  openedAt: string;
  closedAt: string | null;
  entries: number;
  exits: number;
  total: number;
}

interface AccountingReportInput {
  periodLabel: string;
  totalEntries: number;
  totalExits: number;
  totalCommissionsPaid: number;
  netResult: number;
  paymentTotals: PaymentTotals;
  days: DayRow[];
  generatedAt: Date;
}

export function generateAccountingReportPdf(input: AccountingReportInput) {
  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(16);
  doc.text("AUPALE — Salão de Beleza", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Relatório Contábil - ${input.periodLabel}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Resumo", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Forma de pagamento / Item", "Total"]],
    body: [
      ...PAYMENT_METHODS.map((m) => [m.label, formatCurrency(input.paymentTotals[m.value].total)]),
      ["Total de entradas", formatCurrency(input.totalEntries)],
      ["Total de saídas", formatCurrency(input.totalExits)],
      ["Comissões pagas", formatCurrency(input.totalCommissionsPaid)],
      ["Resultado líquido", formatCurrency(input.netResult)],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [74, 55, 40] },
  });

  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text("Movimento diário", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Data", "Abertura", "Fechamento", "Entradas", "Saídas", "Resultado"]],
    body: input.days.map((d) => [
      d.date,
      d.openedAt,
      d.closedAt ?? "-",
      formatCurrency(d.entries),
      formatCurrency(d.exits),
      formatCurrency(d.total),
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [74, 55, 40] },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Gerado em ${input.generatedAt.toLocaleString("pt-BR")}`, 14, pageHeight - 10);

  const fileSuffix = input.periodLabel
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`relatorio-contabil-${fileSuffix}.pdf`);
}

interface CommissionPaymentRow {
  date: string;
  collaboratorName: string;
  servicesCount: number;
  amount: number;
  paymentMethodLabel: string;
}

interface CommissionPaymentsReportInput {
  periodLabel: string;
  collaboratorLabel: string;
  rows: CommissionPaymentRow[];
  totalAmount: number;
  generatedAt: Date;
}

export function generateCommissionPaymentsReportPdf(input: CommissionPaymentsReportInput) {
  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(16);
  doc.text("AUPALE — Relatório de Pagamentos de Comissões", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Período: ${input.periodLabel}`, 14, y);
  y += 6;
  doc.text(`Colaboradora: ${input.collaboratorLabel}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Data", "Colaboradora", "Atendimentos", "Valor", "Forma Pgto"]],
    body: input.rows.map((r) => [
      r.date,
      r.collaboratorName,
      String(r.servicesCount),
      formatCurrency(r.amount),
      r.paymentMethodLabel,
    ]),
    foot: [["", "", "", formatCurrency(input.totalAmount), "Total"]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [74, 55, 40] },
    footStyles: { fillColor: [230, 230, 230], textColor: [20, 20, 20], fontStyle: "bold" },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Gerado em ${input.generatedAt.toLocaleString("pt-BR")}`, 14, pageHeight - 10);

  doc.save("relatorio-pagamentos-comissoes.pdf");
}

interface StockRow {
  name: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
  lowStock: boolean;
}

interface StockReportInput {
  rows: StockRow[];
  generatedAt: Date;
}

export function generateStockReportPdf(input: StockReportInput) {
  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(16);
  doc.text("AUPALE — Relatório de Estoque", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Total de produtos: ${input.rows.length}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Produto", "Marca", "Estoque", "Mínimo", "Preço"]],
    body: input.rows.map((r) => [r.name, r.brand, String(r.stock), String(r.minStock), formatCurrency(r.price)]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [74, 55, 40] },
    didParseCell: (data) => {
      if (data.section === "body" && input.rows[data.row.index]?.lowStock) {
        data.cell.styles.textColor = [180, 40, 40];
      }
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Gerado em ${input.generatedAt.toLocaleString("pt-BR")}`, 14, pageHeight - 10);

  doc.save("relatorio-estoque.pdf");
}
