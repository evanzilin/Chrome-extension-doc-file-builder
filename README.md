# Job Application Autofill Chrome Extension

This Chrome extension stores your job application profile in the popup and autofills matching fields on the current page.

## Features

- Save one reusable applicant profile locally
- Fill common fields like full name, address, phone, email, LinkedIn, GitHub, portfolio, and job title
- Store multiple experience entries with company, role, start date, and end date
- Store multiple education entries with school, degree, start date, and end date
- Autofill common job application inputs on the active tab

## Load the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `resume_extension`

## How to use

1. Open the extension popup
2. Enter your applicant information
3. Click **Save Profile**
4. Open a job application page
5. Click **Autofill Current Page**

## Notes

- The extension stores data in Chrome local extension storage.
- Autofill uses field matching heuristics based on labels, names, placeholders, and nearby text.
- Review the application form after autofill, because job sites use different field structures and custom components.
