# Resume DOC Builder Chrome Extension

This Chrome extension lets you paste plain-text resume content into a centered textarea, then download a cleaner resume file as either a Word `.doc` file or a `.pdf`.

## Features

- Middle-aligned popup UI with a large textarea for resume text
- Primary button named `Generate the DOC file`
- Secondary PDF export button
- Resume parsing for common sections like Summary, Experience, Education, and Skills
- Download support through the Chrome `downloads` API

## Load the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `resume_extension`

## Best input format

The parser works best when your text includes clear section headings, for example:

```text
John Doe
Senior Software Engineer
john@example.com | +1 555 010 1010 | linkedin.com/in/johndoe

SUMMARY
Results-driven engineer with 8+ years of experience...

EXPERIENCE
Senior Software Engineer | Example Corp | 2021 - Present
- Led product delivery for enterprise tools
- Improved API response times by 38%

EDUCATION
B.S. in Computer Science | State University
```
