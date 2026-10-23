const PDFDocument = require("pdfkit");

const COLORS = {
  ink: "#14213D",
  blue: "#2457C5",
  muted: "#64748B",
  line: "#D8E1EF",
  green: "#138A52",
  greenLight: "#E8F7EF"
};

function formatDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function createApprovalCertificate({ institutionName, request, reviewerName }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 58, bottom: 54, left: 58 },
    info: {
      Title: `Approved OD and Leave Certificate ${request._id}`,
      Author: institutionName,
      Subject: "Approved student OD and leave application"
    }
  });

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const centerX = pageWidth / 2;

  doc.lineWidth(1).strokeColor(COLORS.line).roundedRect(30, 30, pageWidth - 60, doc.page.height - 60, 12).stroke();
  doc.fillColor(COLORS.blue).font("Helvetica-Bold").fontSize(20)
    .text(institutionName, left, 58, { width: contentWidth, align: "center" });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10)
    .text("Automated Student OD and Leave Management System", left, 86, { width: contentWidth, align: "center" });

  doc.moveTo(left, 112).lineTo(pageWidth - doc.page.margins.right, 112).strokeColor(COLORS.blue).lineWidth(2).stroke();
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(22)
    .text("Official Leave / OD Approval Certificate", left, 145, { width: contentWidth, align: "center" });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10)
    .text("Application approved by an authorized faculty reviewer", left, 177, { width: contentWidth, align: "center" });

  const badgeWidth = 132;
  const badgeX = centerX - badgeWidth / 2;
  doc.roundedRect(badgeX, 210, badgeWidth, 34, 17).fill(COLORS.greenLight);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(13)
    .text("APPROVED", badgeX, 220, { width: badgeWidth, align: "center" });

  let y = 274;
  function addField(label, value, { multiline = false } = {}) {
    doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(10).text(label.toUpperCase(), left, y);
    y += 15;
    doc.fillColor(COLORS.ink).font("Helvetica").fontSize(multiline ? 11 : 12)
      .text(String(value || "-"), left, y, { width: contentWidth, lineGap: 3 });
    y = doc.y + 15;
  }

  addField("Application ID", String(request._id));
  addField("Student ID", request.studentId);
  addField("Leave type", request.type);
  addField("Duration", `From ${formatDate(request.from)} to ${formatDate(request.to)}`);
  addField("Reason", request.reason, { multiline: true });
  addField("Reviewed by", reviewerName);
  const approvedAt = request.reviewedAt
    ? `${new Date(request.reviewedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "Approval date unavailable";
  addField("Approved at (UTC)", approvedAt);

  const footerY = Math.min(Math.max(y + 8, 660), doc.page.height - 115);
  doc.roundedRect(left, footerY, contentWidth, 62, 8).fill(COLORS.greenLight);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(10)
    .text("ELECTRONIC APPROVAL RECORD", left + 16, footerY + 13);
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9)
    .text("Generated from the approved application record in the institution's OD and Leave Management System.", left + 16, footerY + 32, {
      width: contentWidth - 32
    });

  return doc;
}

module.exports = { createApprovalCertificate };
