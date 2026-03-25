import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

function black(text) {
  return new TextRun({ text, color: '000000', size: 22, font: 'Calibri' });
}

function redMustache(text) {
  return new TextRun({ text, color: 'FF0000', size: 22, font: 'Calibri' });
}

/**
 * Build a sample offer letter DOCX with black static copy and red {{placeholders}}.
 * @returns {Promise<Buffer>}
 */
export async function buildSampleOfferLetterDocxBuffer() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [black('GLUCK GLOBAL')],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [black('(Private Sample Letterhead)')],
            spacing: { after: 400 },
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [black('Date: '), redMustache('{{letter_date}}')],
          }),
          new Paragraph({
            children: [black('Dear '), redMustache('{{employee_full_name}}'), black(',')],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              black(
                'We are pleased to extend the following offer of employment for the position of '
              ),
              redMustache('{{job_title}}'),
              black(' in the '),
              redMustache('{{department}}'),
              black(' department, effective '),
              redMustache('{{joining_date}}'),
              black('.'),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              black('Reporting manager: '),
              redMustache('{{reporting_manager}}'),
              black('.'),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              black('Compensation: '),
              redMustache('{{salary_formatted}}'),
              black(' ('),
              redMustache('{{salary_type}}'),
              black(').'),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              black('Work location / contact address on file: '),
              redMustache('{{employee_address}}'),
              black('.'),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              black(
                'This letter is subject to background verification and company policies. Please confirm acceptance by signing below.'
              ),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [black('Sincerely,')],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [black('For Gluck Global')],
            spacing: { after: 600 },
          }),
          new Paragraph({
            children: [black('Candidate acceptance: ______________________  Date: ____________')],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
