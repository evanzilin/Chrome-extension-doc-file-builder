(async function runAutofill() {
  const STORAGE_KEY = "jobApplicationProfile";
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = normalizeProfile(result[STORAGE_KEY]);

  if (!profile) {
    return;
  }

  const elements = collectFillableElements();
  const metadata = elements.map((element) => ({
    element,
    text: buildElementSignature(element)
  }));

  autofillBasics(profile, metadata);
  autofillExperience(profile.experiences || [], metadata);
  autofillEducation(profile.education || [], metadata);
})();

function collectFillableElements() {
  return Array.from(
    document.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='textbox']")
  ).filter((element) => isElementFillable(element));
}

function isElementFillable(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element instanceof HTMLInputElement) {
    const blockedTypes = new Set(["hidden", "file", "submit", "button", "reset", "radio", "checkbox"]);
    if (blockedTypes.has(element.type)) {
      return false;
    }
  }

  const style = window.getComputedStyle(element);
  return !element.disabled && style.display !== "none" && style.visibility !== "hidden";
}

function buildElementSignature(element) {
  const parts = [
    element.id,
    element.getAttribute("name"),
    element.getAttribute("placeholder"),
    element.getAttribute("aria-label"),
    element.getAttribute("autocomplete"),
    getAssociatedLabelText(element),
    getNearbyText(element)
  ];

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getAssociatedLabelText(element) {
  const labels = [];

  if (typeof element.labels !== "undefined" && element.labels) {
    Array.from(element.labels).forEach((label) => labels.push(label.textContent || ""));
  }

  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    ariaLabelledBy.split(/\s+/).forEach((id) => {
      const label = document.getElementById(id);
      if (label) {
        labels.push(label.textContent || "");
      }
    });
  }

  const wrapperLabel = element.closest("label");
  if (wrapperLabel) {
    labels.push(wrapperLabel.textContent || "");
  }

  return labels.join(" ").trim();
}

function getNearbyText(element) {
  const container = element.closest("label, fieldset, [role='group'], .field, .form-group, .question, .application-question");
  return container ? (container.textContent || "").trim() : "";
}

function autofillBasics(profile, metadata) {
  const firstName = profile.firstName;
  const lastName = profile.lastName;

  const basicMappings = [
    {
      value: profile.fullName,
      matchers: ["full name", "legal name", "your name", "applicant name", "candidate name"]
    },
    {
      value: firstName,
      matchers: ["first name", "given name", "forename"]
    },
    {
      value: lastName,
      matchers: ["last name", "family name", "surname"]
    },
    {
      value: profile.address,
      matchers: ["address", "street address", "mailing address", "location"]
    },
    {
      value: profile.city,
      matchers: ["city", "town", "municipality"]
    },
    {
      value: profile.state,
      matchers: ["state", "state/province", "province", "region", "us state"]
    },
    {
      value: profile.country,
      matchers: ["country", "country/region", "nation"]
    },
    {
      value: profile.phone,
      matchers: ["phone", "phone number", "mobile", "telephone", "contact number"]
    },
    {
      value: profile.email,
      matchers: ["email", "e-mail", "email address", "personal email", "personal e-mail"],
      canonicalKey: "email"
    },
    {
      value: profile.linkedinUrl,
      matchers: ["linkedin", "linkedin url", "linkedin profile"]
    },
    {
      value: profile.githubUrl,
      matchers: ["github", "github url", "github profile"]
    },
    {
      value: profile.portfolioUrl,
      matchers: ["portfolio", "website", "personal website", "portfolio url", "personal site"]
    },
    {
      value: profile.jobTitle,
      matchers: ["job title", "current title", "title", "professional headline", "headline"]
    }
  ];

  basicMappings.forEach((mapping) =>
    fillSingleMatch(metadata, mapping.matchers, mapping.value, mapping.canonicalKey || "")
  );
}

function autofillExperience(experiences, metadata) {
  fillSequentialMatches(metadata, ["company", "employer", "company name", "employer name"], experiences, "company");
  fillSequentialMatches(metadata, ["job title", "role", "position", "title"], experiences, "jobTitle");
  fillSequentialMatches(
    metadata,
    ["address", "location", "work location", "office location", "employer address"],
    experiences,
    "address"
  );
  fillSequentialMatches(metadata, ["start date", "from date", "date started"], experiences, "startDate");
  fillSequentialMatches(metadata, ["end date", "to date", "date ended"], experiences, "endDate");
}

function autofillEducation(education, metadata) {
  fillSequentialMatches(metadata, ["school", "university", "college", "institution"], education, "school");
  fillSequentialMatches(metadata, ["degree", "qualification", "major", "field of study"], education, "degree");
  fillSequentialMatches(metadata, ["start date", "from date", "date started"], education, "startDate", "education");
  fillSequentialMatches(metadata, ["end date", "to date", "date ended", "graduation date"], education, "endDate", "education");
}

function fillSingleMatch(metadata, matchers, value, canonicalKey = "") {
  if (!value) {
    return;
  }

  const candidate = metadata.find((item) => {
    if (item.element.dataset.autofillAssigned === "true") {
      return false;
    }

    if (!matchesAny(item.text, matchers) || !matchesCanonicalField(item.text, canonicalKey || matchers[0])) {
      return false;
    }

    return !isSectionSpecificField(item.text);
  });

  if (candidate) {
    setElementValue(candidate.element, value);
    candidate.element.dataset.autofillAssigned = "true";
  }
}

function fillSequentialMatches(metadata, matchers, entries, fieldName, sectionHint = "") {
  const filteredEntries = Array.isArray(entries) ? entries.filter((entry) => entry[fieldName]) : [];
  if (!filteredEntries.length) {
    return;
  }

  const matches = metadata.filter((item) => {
    if (!matchesAny(item.text, matchers)) {
      return false;
    }

    if (!sectionHint) {
      return true;
    }

    return item.text.includes(sectionHint);
  });

  matches.slice(0, filteredEntries.length).forEach((item, index) => {
    setElementValue(item.element, filteredEntries[index][fieldName]);
  });
}

function matchesAny(text, matchers) {
  return matchers.some((matcher) => text.includes(matcher));
}

function isSectionSpecificField(text) {
  return /experience|employment|education|school|university|college/.test(text);
}

function matchesCanonicalField(text, canonicalKey) {
  const emailTerms = ["email", "e-mail", "email address", "personal email", "personal e-mail"];
  const normalizedKey = String(canonicalKey || "").toLowerCase();

  if (normalizedKey === "email") {
    return emailTerms.some((term) => text.includes(term));
  }

  return true;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();
  const fullName = String(profile.fullName || [firstName, lastName].filter(Boolean).join(" ")).trim();
  const splitName = splitFullName(fullName);

  return {
    ...profile,
    firstName: firstName || splitName.firstName,
    lastName: lastName || splitName.lastName,
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" ").trim()
  };
}

function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

function setElementValue(element, value) {
  if (!value) {
    return;
  }

  const normalizedValue = String(value);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const nativeSetter = Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(element, normalizedValue);
    } else {
      element.value = normalizedValue;
    }
  } else if (element.isContentEditable || element.getAttribute("role") === "textbox") {
    element.textContent = normalizedValue;
  } else {
    return;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}
