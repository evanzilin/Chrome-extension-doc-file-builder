const textarea = document.getElementById("resume-input");
const docButton = document.getElementById("generate-doc");
const pdfButton = document.getElementById("generate-pdf");
const statusMessage = document.getElementById("status-message");

const SECTION_TITLES = {
  summary: "Summary",
  profile: "Summary",
  objective: "Summary",
  "professional summary": "Summary",
  "Professional Summary": "Summary",
  experience: "Experience",
  "work experience": "Experience",
  "professional experience": "Experience",
  "employment history": "Experience",
  education: "Education",
  skills: "Skills",
  "technical skills": "Skills",
  "core competencies": "Skills",
  projects: "Projects",
  certifications: "Certifications",
  certification: "Certifications",
  achievements: "Achievements",
  awards: "Achievements",
  languages: "Languages",
  volunteer: "Volunteer Experience",
  volunteering: "Volunteer Experience",
  interests: "Interests",
  references: "References"
};

docButton.addEventListener("click", () => handleGenerate("doc"));
pdfButton.addEventListener("click", () => handleGenerate("pdf"));

async function handleGenerate(format) {
  const rawText = textarea.value.trim();

  if (!rawText) {
    setStatus("Paste your resume text before generating a file.", "error");
    textarea.focus();
    return;
  }

  setButtonsBusy(true, format);
  setStatus(
    format === "doc"
      ? "Structuring your resume and preparing the DOC file..."
      : "Structuring your resume and preparing the PDF file...",
    ""
  );

  try {
    const resume = parseResume(rawText);
    const filename = buildFilename(resume.name, format);

    if (format === "doc") {
      const docBlob = buildDocBlob(resume);
      await downloadBlob(docBlob, filename);
      setStatus("Your DOC resume file is ready to download.", "success");
    } else {
      const pdfBlob = await buildPdfBlob(resume);
      await downloadBlob(pdfBlob, filename);
      setStatus("Your PDF resume file is ready to download.", "success");
    }
  } catch (error) {
    console.error(error);
    setStatus("The resume file could not be generated. Please try again.", "error");
  } finally {
    setButtonsBusy(false);
  }
}

function setButtonsBusy(isBusy, format = "doc") {
  docButton.disabled = isBusy;
  pdfButton.disabled = isBusy;
  docButton.textContent =
    isBusy && format === "doc" ? "Generating DOC..." : "Generate the DOC file";
  pdfButton.textContent =
    isBusy && format === "pdf" ? "Generating PDF..." : "Generate the PDF file";
}

function setStatus(message, variant) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";
  if (variant) {
    statusMessage.classList.add(variant);
  }
}

function parseResume(rawText) {
  const lines = rawText
    .replace(/\r/g, "")
    .replace(/\u2022/g, "-")
    .split("\n")
    .map((line) => line.trim());

  const introLines = [];
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (!line) {
      if (currentSection && currentSection.blocks[currentSection.blocks.length - 1].length) {
        currentSection.blocks.push([]);
      } else if (!currentSection && introLines[introLines.length - 1] !== "") {
        introLines.push("");
      }
      continue;
    }

    const sectionTitle = getSectionTitle(line);
    if (sectionTitle) {
      currentSection = { title: sectionTitle, blocks: [[]] };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.blocks[currentSection.blocks.length - 1].push(line);
    } else {
      introLines.push(line);
    }
  }

  const cleanedSections = sections
    .map((section) => ({
      title: section.title,
      blocks: section.blocks.filter((block) => block.length)
    }))
    .filter((section) => section.blocks.length);

  const introNonEmpty = introLines.filter(Boolean);
  const name = pickName(introNonEmpty);
  const title = pickTitle(introNonEmpty, name);
  const contacts = extractContacts(introNonEmpty);
  const summarySection = cleanedSections.find((section) => section.title === "Summary");
  const summary = summarySection
    ? summarySection.blocks.flat().map(stripBullet).join(" ")
    : buildSummary(introLines, name, title, contacts);
  const contentSections = cleanedSections.filter((section) => section.title !== "Summary");

  if (!contentSections.length) {
    const detailLines = introNonEmpty.filter(
      (line) => line !== name && line !== title && !isLikelyContactLine(line)
    );

    if (detailLines.length) {
      contentSections.push({
        title: "Resume Details",
        blocks: buildBlocksFromLines(detailLines)
      });
    }
  }

  return {
    name: name || "Professional Resume",
    title,
    contacts,
    summary,
    sections: contentSections
  };
}

function getSectionTitle(line) {
  const normalized = line
    .toLowerCase()
    .replace(/[:\-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return SECTION_TITLES[normalized] || null;
}

function pickName(lines) {
  if (lines.length && !isLikelyContactLine(lines[0]) && !getSectionTitle(lines[0])) {
    return lines[0];
  }

  return (
    lines.find(
      (line) =>
        !isLikelyContactLine(line) &&
        !getSectionTitle(line) &&
        countWords(line) <= 6 &&
        !/[.!?]$/.test(line)
    ) || ""
  );
}

function pickTitle(lines, name) {
  const nameIndex = lines.indexOf(name);

  if (nameIndex >= 0) {
    for (let index = nameIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (
        line &&
        !isLikelyContactLine(line) &&
        !getSectionTitle(line) &&
        countWords(line) <= 10 &&
        !/[.!?]$/.test(line)
      ) {
        return line;
      }
    }
  }

  return (
    lines.find(
      (line) =>
        line !== name &&
        !isLikelyContactLine(line) &&
        !getSectionTitle(line) &&
        countWords(line) <= 10 &&
        !/[.!?]$/.test(line)
    ) || ""
  );
}

function extractContacts(lines) {
  const contacts = [];

  for (const line of lines) {
    if (!isLikelyContactLine(line)) {
      continue;
    }

    const parts = line
      .split(/\s+\|\s+|,\s(?=https?:\/\/|www\.|linkedin|github|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})| \/ /)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (!contacts.includes(part)) {
        contacts.push(part);
      }
    }
  }

  return contacts;
}

function buildSummary(introLines, name, title, contacts) {
  const summaryParts = introLines
    .filter(Boolean)
    .filter((line) => line !== name && line !== title && !contacts.includes(line))
    .filter((line) => !isLikelyContactLine(line));

  return summaryParts.join(" ");
}

function buildBlocksFromLines(lines) {
  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    if (!line) {
      if (currentBlock.length) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function isLikelyContactLine(line) {
  const normalized = line.toLowerCase();
  return (
    /@/.test(line) ||
    /linkedin|github|portfolio|behance|dribbble|www\.|https?:\/\//.test(normalized) ||
    /(\+\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/.test(line) ||
    normalized.includes("|")
  );
}

function countWords(line) {
  return line.trim().split(/\s+/).filter(Boolean).length;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripBullet(line) {
  return line.replace(/^[-*]\s*/, "").trim();
}

function isBulletLine(line) {
  return /^[-*]\s+/.test(line);
}

function buildResumeMarkup(resume) {
  const summaryMarkup = resume.summary
    ? `
      <section class="resume-section">
        <h2>Summary</h2>
        <p>${escapeHtml(resume.summary)}</p>
      </section>
    `
    : "";

  const sectionMarkup = resume.sections
    .map((section) => {
      if (section.title === "Skills") {
        return `
          <section class="resume-section">
            <h2>${escapeHtml(section.title)}</h2>
            ${section.blocks.map(renderSkillBlock).join("")}
          </section>
        `;
      }

      return `
        <section class="resume-section">
          <h2>${escapeHtml(section.title)}</h2>
          ${section.blocks.map(renderStandardBlock).join("")}
        </section>
      `;
    })
    .join("");

  return `
    <article class="resume-doc">
      <header class="resume-header">
        <h1>${escapeHtml(resume.name)}</h1>
        ${resume.title ? `<p class="resume-title">${escapeHtml(resume.title)}</p>` : ""}
        ${
          resume.contacts.length
            ? `<p class="resume-contacts">${resume.contacts.map(escapeHtml).join(" &bull; ")}</p>`
            : ""
        }
      </header>
      ${summaryMarkup}
      ${sectionMarkup}
    </article>
  `;
}

function renderStandardBlock(block) {
  const bulletLines = block.filter(isBulletLine);
  const textLines = block.filter((line) => !isBulletLine(line));
  const heading = textLines.length > 1 || bulletLines.length ? textLines[0] : "";
  const remainingTextLines = heading ? textLines.slice(1) : textLines;
  const singleLineMarkup =
    !heading && textLines.length === 1
      ? `<p>${escapeHtml(stripBullet(textLines[0]))}</p>`
      : "";

  return `
    <div class="resume-entry">
      ${heading ? `<div class="entry-heading">${escapeHtml(stripBullet(heading))}</div>` : ""}
      ${heading
        ? remainingTextLines
            .map((line) => `<p>${escapeHtml(stripBullet(line))}</p>`)
            .join("")
        : ""}
      ${
        bulletLines.length
          ? `<ul>${bulletLines
              .map((line) => `<li>${escapeHtml(stripBullet(line))}</li>`)
              .join("")}</ul>`
          : ""
      }
      ${singleLineMarkup}
    </div>
  `;
}

function renderSkillBlock(block) {
  const lines = block.map((line) => stripBullet(line)).filter(Boolean);
  if (!lines.length) {
    return "";
  }

  return `
    <div class="skill-list">
      ${lines.map(renderSkillLineMarkup).join("")}
    </div>
  `;
}

function renderSkillLineMarkup(line) {
  const { label, value } = splitSkillLabel(line);
  if (label) {
    return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
  }

  return `<p>${escapeHtml(line)}</p>`;
}

function splitSkillLabel(line) {
  const cleanLine = stripBullet(line);
  const colonIndex = cleanLine.indexOf(":");

  if (colonIndex <= 0) {
    return { label: "", value: cleanLine };
  }

  const label = cleanLine.slice(0, colonIndex).trim();
  const value = cleanLine.slice(colonIndex + 1).trim();

  if (!label || !value || countWords(label) > 4) {
    return { label: "", value: cleanLine };
  }

  return { label, value };
}

function getDocumentStyles() {
  return `
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background: #ffffff;
    }

    .resume-doc {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      padding: 28px 22px;
    }

    .resume-header {
      border-bottom: 1px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 18px;
      text-align: center;
    }

    .resume-header h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
      color: #000000;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .resume-title,
    .resume-contacts {
      margin: 6px 0 0;
      font-size: 11px;
      line-height: 1.5;
      color: #000000;
    }

    .resume-section {
      margin-top: 14px;
    }

    .resume-section h2 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 2px;
    }

    .resume-entry {
      margin-bottom: 10px;
    }

    .entry-heading {
      margin-bottom: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #000000;
    }

    p,
    li {
      margin: 0 0 4px;
      font-size: 11px;
      line-height: 1.45;
      color: #000000;
    }

    ul {
      margin: 4px 0 0 18px;
      padding: 0;
    }

    .skill-list p {
      margin-bottom: 4px;
    }
  `;
}

function buildDocBlob(resume) {
  const html = `
    <!DOCTYPE html>
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
    >
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(resume.name)}</title>
        <style>
          @page {
            size: A4;
            margin: 0.7in;
          }

          ${getDocumentStyles()}
        </style>
      </head>
      <body>
        ${buildResumeMarkup(resume)}
      </body>
    </html>
  `;

  return new Blob(["\ufeff", html], { type: "application/msword" });
}

async function buildPdfBlob(resume) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF is not available in the popup.");
  }

  const pdf = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (spaceNeeded) => {
    if (y + spaceNeeded > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text, options = {}) => {
    const cleanText = normalizePdfText(text);
    if (!cleanText) {
      return;
    }

    const fontSize = options.fontSize || 10;
    const lineHeight = options.lineHeight || fontSize + 4;
    const x = options.x || margin;
    const width = options.width || maxWidth;
    const fontStyle = options.fontStyle || "normal";
    const color = options.color || [52, 64, 84];
    const spacingAfter = options.spacingAfter || 0;

    pdf.setFont("helvetica", fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);

    const wrapped = pdf.splitTextToSize(cleanText, width);
    ensureSpace(wrapped.length * lineHeight + spacingAfter);
    pdf.text(wrapped, x, y);
    y += wrapped.length * lineHeight + spacingAfter;
  };

  const drawDivider = () => {
    ensureSpace(12);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 12;
  };

  writeWrapped(resume.name, {
    fontSize: 21,
    fontStyle: "bold",
    lineHeight: 24,
    color: [0, 0, 0],
    spacingAfter: 4
  });

  if (resume.title) {
    writeWrapped(resume.title, {
      fontSize: 10,
      lineHeight: 13,
      color: [0, 0, 0],
      spacingAfter: 3
    });
  }

  if (resume.contacts.length) {
    writeWrapped(resume.contacts.join(" | "), {
      fontSize: 9.5,
      lineHeight: 12,
      color: [0, 0, 0],
      spacingAfter: 6
    });
  }

  drawDivider();

  if (resume.summary) {
    writeWrapped("SUMMARY", {
      fontSize: 11,
      fontStyle: "bold",
      lineHeight: 14,
      color: [0, 0, 0],
      spacingAfter: 4
    });
    writeWrapped(resume.summary, {
      fontSize: 9.5,
      lineHeight: 13,
      color: [0, 0, 0],
      spacingAfter: 8
    });
  }

  for (const section of resume.sections) {
    writeWrapped(section.title.toUpperCase(), {
      fontSize: 11,
      fontStyle: "bold",
      lineHeight: 14,
      color: [0, 0, 0],
      spacingAfter: 4
    });

    if (section.title === "Skills") {
      for (const block of section.blocks) {
        for (const line of block) {
          writeSkillPdfLine(pdf, stripBullet(line), {
            margin,
            maxWidth,
            lineHeight: 13,
            fontSize: 9.5,
            yState: () => y,
            setY: (nextY) => {
              y = nextY;
            },
            ensureSpace
          });
        }
      }
      y += 6;
      continue;
    }

    for (const block of section.blocks) {
      const bulletLines = block.filter(isBulletLine);
      const textLines = block.filter((line) => !isBulletLine(line));
      const heading = textLines.length > 1 || bulletLines.length ? textLines[0] : "";
      const remainingTextLines = heading ? textLines.slice(1) : textLines;

      if (heading) {
        writeWrapped(stripBullet(heading), {
          fontSize: 10,
          fontStyle: "bold",
          lineHeight: 13,
          color: [0, 0, 0],
          spacingAfter: 2
        });
      }

      for (const line of remainingTextLines) {
        writeWrapped(stripBullet(line), {
          fontSize: 9.5,
          lineHeight: 13,
          color: [0, 0, 0],
          spacingAfter: 2
        });
      }

      if (!heading && textLines.length === 1) {
        writeWrapped(stripBullet(textLines[0]), {
          fontSize: 9.5,
          lineHeight: 13,
          color: [0, 0, 0],
          spacingAfter: 2
        });
      }

      for (const bulletLine of bulletLines) {
        ensureSpace(14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(0, 0, 0);
        pdf.text("-", margin + 2, y);
        const wrapped = pdf.splitTextToSize(stripBullet(bulletLine), maxWidth - 20);
        pdf.text(wrapped, margin + 14, y);
        y += wrapped.length * 13 + 2;
      }

      y += 4;
    }
  }

  return pdf.output("blob");
}

function writeSkillPdfLine(pdf, line, options) {
  const { label, value } = splitSkillLabel(line);
  const fontSize = options.fontSize || 9.5;
  const lineHeight = options.lineHeight || 13;
  const margin = options.margin || 48;
  const maxWidth = options.maxWidth || 480;
  const ensureSpace = options.ensureSpace;
  let y = options.yState();

  if (!label) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(0, 0, 0);
    const wrapped = pdf.splitTextToSize(line, maxWidth);
    ensureSpace(wrapped.length * lineHeight + 2);
    y = options.yState();
    pdf.text(wrapped, margin, y);
    options.setY(y + wrapped.length * lineHeight + 2);
    return;
  }

  const labelText = `${label}:`;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontSize);
  const labelWidth = pdf.getTextWidth(labelText) + 4;
  const remainingWidth = Math.max(80, maxWidth - labelWidth);
  const valueLines = pdf.splitTextToSize(value, remainingWidth);

  ensureSpace(valueLines.length * lineHeight + 2);
  y = options.yState();

  pdf.setTextColor(0, 0, 0);
  pdf.text(labelText, margin, y);

  pdf.setFont("helvetica", "normal");
  pdf.text(valueLines[0], margin + labelWidth, y);

  for (let index = 1; index < valueLines.length; index += 1) {
    y += lineHeight;
    pdf.text(valueLines[index], margin, y);
  }

  options.setY(y + lineHeight + 2);
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFilename(name, format) {
  const safeName = String(name || "resume")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeName || "resume"}.${format}`;
}

async function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    if (typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download) {
      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: objectUrl,
            filename,
            saveAs: true
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            resolve(downloadId);
          }
        );
      });
      return;
    }

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}
