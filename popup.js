const STORAGE_KEY = "jobApplicationProfile";

const form = document.getElementById("profile-form");
const experienceList = document.getElementById("experience-list");
const educationList = document.getElementById("education-list");
const experienceTemplate = document.getElementById("experience-template");
const educationTemplate = document.getElementById("education-template");
const saveButton = document.getElementById("save-profile");
const autofillButton = document.getElementById("autofill-page");
const clearButton = document.getElementById("clear-profile");
const addExperienceButton = document.getElementById("add-experience");
const addEducationButton = document.getElementById("add-education");
const statusMessage = document.getElementById("status-message");

const BASIC_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "address",
  "city",
  "state",
  "country",
  "phone",
  "email",
  "linkedinUrl",
  "githubUrl",
  "portfolioUrl",
  "jobTitle"
];

initializePopup().catch((error) => {
  console.error(error);
  setStatus("The extension could not load your saved profile.", "error");
});

async function initializePopup() {
  bindEvents();
  const profile = await loadProfile();
  renderProfile(profile);
}

function bindEvents() {
  addExperienceButton.addEventListener("click", () => {
    appendEntryCard(experienceList, "experience", createEmptyExperience());
  });

  addEducationButton.addEventListener("click", () => {
    appendEntryCard(educationList, "education", createEmptyEducation());
  });

  saveButton.addEventListener("click", saveProfileFromForm);
  autofillButton.addEventListener("click", autofillCurrentPage);
  clearButton.addEventListener("click", clearStoredProfile);

  experienceList.addEventListener("click", handleEntryListClick);
  educationList.addEventListener("click", handleEntryListClick);
}

function handleEntryListClick(event) {
  if (!event.target.classList.contains("remove-button")) {
    return;
  }

  const entryCard = event.target.closest(".entry-card");
  const entryList = entryCard?.parentElement;
  if (!entryCard || !entryList) {
    return;
  }

  entryCard.remove();

  if (!entryList.children.length) {
    if (entryList === experienceList) {
      appendEntryCard(experienceList, "experience", createEmptyExperience());
    } else {
      appendEntryCard(educationList, "education", createEmptyEducation());
    }
  }
}

function renderProfile(profile) {
  BASIC_FIELDS.forEach((fieldName) => {
    const input = form.elements.namedItem(fieldName);
    if (input) {
      input.value = profile[fieldName] || "";
    }
  });

  renderEntries(experienceList, "experience", profile.experiences, createEmptyExperience);
  renderEntries(educationList, "education", profile.education, createEmptyEducation);
}

function renderEntries(container, type, entries, createFallback) {
  container.innerHTML = "";
  const normalizedEntries = Array.isArray(entries) && entries.length ? entries : [createFallback()];
  normalizedEntries.forEach((entry) => appendEntryCard(container, type, entry));
}

function appendEntryCard(container, type, data) {
  const template = type === "experience" ? experienceTemplate : educationTemplate;
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".entry-card");

  Object.entries(data).forEach(([fieldName, value]) => {
    const input = card.querySelector(`[data-field="${fieldName}"]`);
    if (input) {
      input.value = value || "";
    }
  });

  container.appendChild(fragment);
}

async function loadProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeProfile(result[STORAGE_KEY]);
}

function normalizeProfile(profile) {
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  const normalized = {};

  BASIC_FIELDS.forEach((fieldName) => {
    normalized[fieldName] = String(safeProfile[fieldName] || "").trim();
  });

  if (!normalized.firstName || !normalized.lastName) {
    const { firstName, lastName } = splitFullName(normalized.fullName);
    normalized.firstName = normalized.firstName || firstName;
    normalized.lastName = normalized.lastName || lastName;
  }

  if (!normalized.fullName) {
    normalized.fullName = [normalized.firstName, normalized.lastName].filter(Boolean).join(" ").trim();
  }

  normalized.experiences = normalizeEntryArray(
    safeProfile.experiences,
    createEmptyExperience,
    ["company", "jobTitle", "address", "startDate", "endDate"]
  );
  normalized.education = normalizeEntryArray(
    safeProfile.education,
    createEmptyEducation,
    ["school", "degree", "startDate", "endDate"]
  );

  return normalized;
}

function normalizeEntryArray(entries, createFallback, fields) {
  const list = Array.isArray(entries) ? entries : [];
  const normalizedEntries = list
    .map((entry) => {
      const normalizedEntry = {};
      fields.forEach((fieldName) => {
        normalizedEntry[fieldName] = String(entry?.[fieldName] || "").trim();
      });
      return normalizedEntry;
    })
    .filter((entry) => Object.values(entry).some(Boolean));

  return normalizedEntries.length ? normalizedEntries : [createFallback()];
}

function collectProfileFromForm() {
  const profile = {};

  BASIC_FIELDS.forEach((fieldName) => {
    const input = form.elements.namedItem(fieldName);
    profile[fieldName] = input ? input.value.trim() : "";
  });

  if (!profile.fullName) {
    profile.fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  }

  const derivedNameParts = splitFullName(profile.fullName);
  profile.firstName = profile.firstName || derivedNameParts.firstName;
  profile.lastName = profile.lastName || derivedNameParts.lastName;

  profile.experiences = collectEntryData(experienceList, [
    "company",
    "jobTitle",
    "address",
    "startDate",
    "endDate"
  ]);
  profile.education = collectEntryData(educationList, [
    "school",
    "degree",
    "startDate",
    "endDate"
  ]);

  return normalizeProfile(profile);
}

function collectEntryData(container, fields) {
  return Array.from(container.querySelectorAll(".entry-card"))
    .map((card) => {
      const entry = {};
      fields.forEach((fieldName) => {
        const input = card.querySelector(`[data-field="${fieldName}"]`);
        entry[fieldName] = input ? input.value.trim() : "";
      });
      return entry;
    })
    .filter((entry) => Object.values(entry).some(Boolean));
}

async function saveProfileFromForm() {
  const profile = collectProfileFromForm();
  setButtonsBusy(true, "save");

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: profile });
    renderProfile(profile);
    setStatus("Profile saved. You can now autofill matching job application fields.", "success");
  } catch (error) {
    console.error(error);
    setStatus("The profile could not be saved.", "error");
  } finally {
    setButtonsBusy(false);
  }
}

async function autofillCurrentPage() {
  const profile = collectProfileFromForm();
  setButtonsBusy(true, "autofill");

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: profile });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab was found.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["autofill.js"]
    });

    setStatus("Autofill ran on the current page. Review the form before submitting.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Autofill could not run on this page.", "error");
  } finally {
    setButtonsBusy(false);
  }
}

async function clearStoredProfile() {
  setButtonsBusy(true, "clear");

  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    renderProfile(createDefaultProfile());
    setStatus("Stored profile data cleared.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Stored data could not be cleared.", "error");
  } finally {
    setButtonsBusy(false);
  }
}

function createDefaultProfile() {
  return {
    firstName: "",
    lastName: "",
    fullName: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    jobTitle: "",
    experiences: [createEmptyExperience()],
    education: [createEmptyEducation()]
  };
}

function createEmptyExperience() {
  return {
    company: "",
    jobTitle: "",
    address: "",
    startDate: "",
    endDate: ""
  };
}

function createEmptyEducation() {
  return {
    school: "",
    degree: "",
    startDate: "",
    endDate: ""
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

function setButtonsBusy(isBusy, action = "") {
  saveButton.disabled = isBusy;
  autofillButton.disabled = isBusy;
  clearButton.disabled = isBusy;

  saveButton.textContent = isBusy && action === "save" ? "Saving..." : "Save Profile";
  autofillButton.textContent =
    isBusy && action === "autofill" ? "Autofilling..." : "Autofill Current Page";
  clearButton.textContent = isBusy && action === "clear" ? "Clearing..." : "Clear Stored Data";
}

function setStatus(message, variant) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";
  if (variant) {
    statusMessage.classList.add(variant);
  }
}
