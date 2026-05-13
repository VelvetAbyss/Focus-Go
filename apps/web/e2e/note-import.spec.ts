import { expect, test } from '@playwright/test'
import { Document, HeadingLevel, Packer, Paragraph } from 'docx'

const makeDocxBuffer = async () => {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Word Lecture',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph('Derivative rules from the mock exam.'),
        ],
      },
    ],
  })
  return await Packer.toBuffer(document)
}

test('imports markdown and docx notes while keeping unsupported files visible', async ({ page }) => {
  await page.goto('/note')

  const importButton = page.getByRole('button', { name: /^Import$/i }).first()
  await importButton.waitFor({ timeout: 10000 })
  await importButton.click()

  await page.getByLabel('Choose note files').setInputFiles([
    {
      name: 'calculus-review.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Calculus Review\n\n- Limits\n- Integrals'),
    },
    {
      name: 'word-lecture.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await makeDocxBuffer(),
    },
    {
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    },
  ])

  await expect(page.getByText('scan.pdf')).toBeVisible()
  await expect(page.getByText('Unsupported')).toBeVisible()

  await page.getByRole('button', { name: /^Import 2$/ }).click()

  await expect(page.getByText('Calculus Review').first()).toBeVisible()
  await expect(page.getByText('Word Lecture').first()).toBeVisible()
  await expect(page.getByText('scan.pdf')).toBeVisible()
  await expect(page.getByText('Unsupported')).toBeVisible()
})
