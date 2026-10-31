type RecordData = Record<string, unknown>;

export type RiderRecord = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  availability: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlate: string;
  licenseNumber: string;
  licenseExpiry: string;
  identityNumber: string;
  submittedAt: string;
  documents: Array<{ label: string; url: string }>;
};

function record(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
}

function read(sources: RecordData[], keys: string[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
  }
  return "";
}

export function safeRiderDocumentUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const url = value.trim();
  // Relative file links must stay on this origin, including after URL parsing.
  if (/^\/(?!\/)/.test(url) && !/[\\\u0000-\u0020]/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function labelFor(key: string): string {
  if (/^Document \d+$/.test(key)) return key;
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/\b(url|image|file|document)\b/gi, "").trim() || "Verification document";
}

export function parseRider(value: unknown): RiderRecord {
  const root = record(value);
  const rider = record(root.rider);
  const profile = record(root.profile ?? rider.profile ?? root.rider_profile ?? root.riderProfile);
  const user = record(root.user ?? rider.user ?? profile.user);
  const contact = [user, record(user.profile), profile, rider, root];
  const vehicle = [record(root.vehicle ?? rider.vehicle ?? profile.vehicle), rider, profile, root];
  const sources = [root, rider, profile, user];
  const names = contact.map(source => read([source], ["name", "full_name", "fullName"]) ||
    [read([source], ["first_name", "firstName"]), read([source], ["last_name", "lastName"])].filter(Boolean).join(" "));
  const documents: RiderRecord["documents"] = [];
  function addDocument(label: string, value: unknown) {
    const entry = record(value);
    const url = safeRiderDocumentUrl(typeof value === "string" ? value : read([entry], ["url", "file_url", "fileUrl", "document_url", "documentUrl", "image_url", "imageUrl", "download_url", "downloadUrl"]));
    if (url && !documents.some(document => document.url === url)) {
      documents.push({label: read([entry], ["label", "name", "type", "document_type"]) || labelFor(label), url});
    }
  }
  for (const source of [...sources, ...vehicle]) {
    for (const key of ["license_document_url", "license_document", "license_image", "license_image_url", "driver_license_url", "drivers_license_url", "identity_document_url", "id_document_url", "id_card_url", "vehicle_registration_url", "vehicle_document_url", "insurance_document_url", "profile_picture", "profile_photo", "passport_photo"]) {
      addDocument(key, source[key]);
    }
    const uploaded = source.documents ?? source.verification_documents;
    if (Array.isArray(uploaded)) uploaded.forEach((entry, index) => addDocument(`Document ${index + 1}`, entry));
    else Object.entries(record(uploaded)).forEach(([key, entry]) => addDocument(key, entry));
  }
  const id = read([rider, root, profile], ["rider_id", "riderId", "id", "uuid"]);
  return {
    id,
    userId: read([root, rider, profile], ["user_id", "userId"]) || read([user], ["id", "uuid"]),
    name: names.find(Boolean) || "",
    email: read(contact, ["email", "email_address"]),
    phone: read(contact, ["phone", "phone_number", "phoneNumber", "mobile", "telephone"]),
    address: read(contact, ["address", "residential_address", "home_address"]),
    availability: read([rider, root, profile], ["availability_status", "availability", "status"]),
    vehicleType: read(vehicle, ["vehicle_type", "vehicleType", "type"]),
    vehicleModel: read(vehicle, ["vehicle_model", "vehicleModel", "model"]),
    vehiclePlate: read(vehicle, ["vehicle_plate_number", "plate_number", "registration_number", "license_plate", "vehicle_number", "vehicleNumber", "plateNumber"]),
    licenseNumber: read(sources, ["license_number", "driver_license_number", "drivers_license_number"]),
    licenseExpiry: read(sources, ["license_expiry", "license_expiry_date", "license_expires_at"]),
    identityNumber: read(sources, ["nin", "national_id", "national_id_number", "identity_number"]),
    submittedAt: read([rider, root, profile], ["submitted_at", "created_at", "registered_at"]),
    documents,
  };
}

export function riderRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const source = record(payload);
  for (const key of ["riders", "items", "results", "rows", "data"]) {
    if (source[key] !== undefined) {
      const rows = riderRows(source[key]);
      if (rows.length || Array.isArray(source[key])) return rows;
    }
  }
  return [];
}

export function mergeRiderDetails(summary: RiderRecord, payload: unknown): RiderRecord {
  const source = record(payload);
  const detail = parseRider(source.data ?? payload);
  if (summary.id && detail.id && summary.id !== detail.id) return summary;
  // The queue's identifier is the authoritative target of the verification action.
  const merged = {...summary};
  for (const key of Object.keys(detail) as Array<keyof RiderRecord>) {
    if (key !== "id" && key !== "documents" && detail[key]) merged[key] = detail[key];
  }
  merged.documents = [...summary.documents, ...detail.documents.filter(document => !summary.documents.some(existing => existing.url === document.url))];
  return merged;
}
