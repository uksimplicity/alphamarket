"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  type UpdateProfileInput,
  fetchCurrentUserProfile,
  resendPhoneVerification,
  updateCurrentUserProfile,
  uploadProfilePicture,
  verifyPhoneOtp,
} from "@/components/auth/profileClient";
import { Button, ErrorState, Skeleton } from "@/components/dashboard/ui";

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  profilePicture: string;
  addressForm: UpdateProfileInput;
  addresses: Array<{ id: string; label: string; detail: string }>;
};

const ALLOWED_PROFILE_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

function isAllowedProfileImage(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const mime = file.type.toLowerCase();
  return mime.startsWith("image/") && ALLOWED_PROFILE_IMAGE_EXTENSIONS.has(ext);
}

function formatAddressDetail(input: UpdateProfileInput) {
  return [input.address, input.city, input.state, input.country, input.postalCode]
    .filter(Boolean)
    .join(", ");
}

export default function VendorProfile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<UpdateProfileInput>({
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSuccess, setAddressSuccess] = useState("");
  const [latestSavedAddress, setLatestSavedAddress] = useState("");
  const [latestSavedForm, setLatestSavedForm] = useState<UpdateProfileInput | null>(null);
  const [addressMode, setAddressMode] = useState<"add" | "edit">("edit");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [pictureSaving, setPictureSaving] = useState(false);
  const [pictureMessage, setPictureMessage] = useState("");
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [phoneResendLoading, setPhoneResendLoading] = useState(false);
  const [phoneVerifyMessage, setPhoneVerifyMessage] = useState("");
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneOtp, setNewPhoneOtp] = useState("");
  const [changePhoneLoading, setChangePhoneLoading] = useState(false);
  const [changePhoneResendLoading, setChangePhoneResendLoading] = useState(false);
  const [changePhoneMessage, setChangePhoneMessage] = useState("");
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSaving, setNewsletterSaving] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [failedProfilePictureSrc, setFailedProfilePictureSrc] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const profile = await fetchCurrentUserProfile();
      const addressDetail = formatAddressDetail({
        address: profile.address,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        postalCode: profile.postalCode,
      });
      setData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        phoneVerified: profile.phoneVerified,
        profilePicture: profile.profilePicture,
        addressForm: {
          address: profile.address,
          city: profile.city,
          state: profile.state,
          country: profile.country,
          postalCode: profile.postalCode,
        },
        addresses: [
          {
            id: "default",
            label: "Primary Address",
            detail: addressDetail || "Add an address to continue.",
          },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const addresses = useMemo(
    () => (Array.isArray(data?.addresses) ? data.addresses : []),
    [data?.addresses]
  );
  const displayedPrimaryAddress =
    latestSavedAddress || addresses[0]?.detail || "Add an address to continue.";
  const profilePicture = data?.profilePicture ?? "";
  const showProfilePicture = Boolean(profilePicture) && failedProfilePictureSrc !== profilePicture;

  const openAddressEditor = () => {
    if (!data) return;
    setAddressMode("edit");
    setAddressForm(latestSavedForm ?? data.addressForm);
    setAddressError("");
    setAddressSuccess("");
    setAddressModalOpen(true);
  };

  const openAddAddress = () => {
    setAddressMode("add");
    setAddressForm({
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    });
    setAddressError("");
    setAddressSuccess("");
    setAddressModalOpen(true);
  };

  const submitAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressSaving(true);
    setAddressError("");
    setAddressSuccess("");
    try {
      await updateCurrentUserProfile(addressForm);
      const nextDetail = formatAddressDetail(addressForm) || "Add an address to continue.";
      setLatestSavedAddress(nextDetail);
      setLatestSavedForm({ ...addressForm });
      setData((prev) =>
        prev
          ? {
              ...prev,
              addressForm: { ...addressForm },
              addresses: [
                {
                  id: prev.addresses[0]?.id ?? "default",
                  label: prev.addresses[0]?.label ?? "Primary Address",
                  detail: nextDetail,
                },
              ],
            }
          : prev
      );
      await loadProfile();
      setAddressSuccess("Address updated successfully.");
      setAddressModalOpen(false);
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : "Failed to update address.");
    } finally {
      setAddressSaving(false);
    }
  };

  const saveProfilePicture = async () => {
    if (!profilePictureFile) {
      setPictureMessage("Please choose an image file first.");
      return;
    }
    if (!isAllowedProfileImage(profilePictureFile)) {
      setPictureMessage("Only .jpg, .jpeg, .png, .webp, and .gif images are allowed.");
      return;
    }
    setPictureSaving(true);
    setPictureMessage("");
    try {
      const uploadedUrl = await uploadProfilePicture(profilePictureFile);
      await updateCurrentUserProfile({ profilePicture: uploadedUrl });
      setData((prev) => (prev ? { ...prev, profilePicture: uploadedUrl } : prev));
      setPictureMessage("Profile picture updated.");
      setProfilePictureFile(null);
      await loadProfile();
    } catch (err) {
      setPictureMessage(err instanceof Error ? err.message : "Failed to update profile picture.");
    } finally {
      setPictureSaving(false);
    }
  };

  const openPhoneVerification = () => {
    setPhoneOtp("");
    setPhoneVerifyMessage("");
    setPhoneVerifyOpen(true);
  };

  const submitPhoneVerification = async () => {
    if (!data) return;
    if (!phoneOtp.trim()) {
      setPhoneVerifyMessage("Enter the OTP sent to your phone.");
      return;
    }
    setPhoneVerifyLoading(true);
    setPhoneVerifyMessage("");
    try {
      await verifyPhoneOtp(data.phone, phoneOtp.trim(), data.email);
      setData((prev) => (prev ? { ...prev, phoneVerified: true } : prev));
      setPhoneVerifyMessage("Phone number verified successfully.");
      setPhoneVerifyOpen(false);
      await loadProfile();
    } catch (err) {
      setPhoneVerifyMessage(
        err instanceof Error ? err.message : "Failed to verify phone number."
      );
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const resendPhoneOtp = async () => {
    if (!data) return;
    setPhoneResendLoading(true);
    setPhoneVerifyMessage("");
    try {
      await resendPhoneVerification(data.phone, data.email);
      setPhoneVerifyMessage("OTP resent successfully.");
    } catch (err) {
      setPhoneVerifyMessage(err instanceof Error ? err.message : "Failed to resend OTP.");
    } finally {
      setPhoneResendLoading(false);
    }
  };

  const openChangePhone = () => {
    setNewPhone("");
    setNewPhoneOtp("");
    setChangePhoneMessage("");
    setChangePhoneOpen(true);
  };

  const sendNewPhoneOtp = async () => {
    if (!data) return;
    if (!newPhone.trim()) {
      setChangePhoneMessage("Enter the new phone number first.");
      return;
    }
    setChangePhoneResendLoading(true);
    setChangePhoneMessage("");
    try {
      await resendPhoneVerification(newPhone.trim(), data.email);
      setChangePhoneMessage("OTP sent to the new phone number.");
    } catch (err) {
      setChangePhoneMessage(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setChangePhoneResendLoading(false);
    }
  };

  const verifyAndSaveNewPhone = async () => {
    if (!data) return;
    if (!newPhone.trim()) {
      setChangePhoneMessage("Enter a new phone number.");
      return;
    }
    if (!newPhoneOtp.trim()) {
      setChangePhoneMessage("Enter OTP to verify this number.");
      return;
    }

    setChangePhoneLoading(true);
    setChangePhoneMessage("");
    try {
      await verifyPhoneOtp(newPhone.trim(), newPhoneOtp.trim(), data.email);
      await updateCurrentUserProfile({ phone: newPhone.trim() });
      setData((prev) =>
        prev
          ? {
              ...prev,
              phone: newPhone.trim(),
              phoneVerified: true,
            }
          : prev
      );
      setChangePhoneMessage("Phone number changed and verified.");
      setChangePhoneOpen(false);
      await loadProfile();
    } catch (err) {
      setChangePhoneMessage(err instanceof Error ? err.message : "Failed to change phone number.");
    } finally {
      setChangePhoneLoading(false);
    }
  };

  const openNewsletterEditor = () => {
    setNewsletterEmail(data?.email ?? "");
    setNewsletterMessage("");
    setNewsletterOpen(true);
  };

  const saveNewsletterEmail = async () => {
    const email = newsletterEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterMessage("Enter a valid email address.");
      return;
    }
    setNewsletterSaving(true);
    setNewsletterMessage("");
    try {
      setNewsletterMessage("Newsletter email saved successfully.");
      setNewsletterOpen(false);
    } finally {
      setNewsletterSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error || "Failed to load profile."} onRetry={loadProfile} />;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">
          Account Overview
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Account Details
            </div>
            <div className="space-y-2 px-4 py-4 text-sm text-slate-700">
              <div className="mb-3 flex items-center gap-3">
                {showProfilePicture ? (
                  <img
                    src={profilePicture}
                    alt={`${data.name} profile`}
                    className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover object-center"
                    onError={() => setFailedProfilePictureSrc(profilePicture)}
                  />
                ) : (
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                    {data.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                    onChange={(event) => setProfilePictureFile(event.target.files?.[0] ?? null)}
                  />
                  {profilePictureFile ? (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Selected: {profilePictureFile.name}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-white disabled:opacity-60"
                  onClick={saveProfilePicture}
                  disabled={pictureSaving}
                >
                  {pictureSaving ? "Uploading..." : "Upload"}
                </button>
              </div>
              {pictureMessage ? <div className="text-xs text-emerald-600">{pictureMessage}</div> : null}
              <div className="font-semibold text-slate-900">{data.name}</div>
              <div>{data.email}</div>
              <div className="flex items-center gap-2">
                <span>{data.phone}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    data.phoneVerified
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {data.phoneVerified ? "Verified" : "Unverified"}
                </span>
                {!data.phoneVerified ? (
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50"
                    onClick={openPhoneVerification}
                  >
                    Verify
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Address Book
              <div className="flex items-center gap-2">
                <Button className="h-8 px-3 text-xs" variant="ghost" onClick={openAddAddress}>
                  Add New Address
                </Button>
                <Button className="h-8 px-3 text-xs" variant="ghost" onClick={openAddressEditor}>
                  Edit
                </Button>
              </div>
            </div>
            <div className="space-y-2 px-4 py-4 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Your default shipping address:
              </div>
              <div className="font-semibold text-slate-900">
                {addresses[0]?.label ?? "No default address"}
              </div>
              <div>{displayedPrimaryAddress}</div>
              <div className="flex items-center justify-between gap-2">
                <span>{data.phone}</span>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={openChangePhone}
                >
                  Change Number
                </button>
              </div>
              <div className="text-[11px] text-slate-500">
                New phone number must be verified before it is saved.
              </div>
              {addressSuccess ? <div className="text-xs text-emerald-600">{addressSuccess}</div> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Alpha Store Credit
            </div>
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-slate-700">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M4 6h16v12H4V6zm3 3h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <div className="font-semibold text-slate-900">Alpha store credit balance (verified):</div>
                <div>N 0</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Newsletter Preferences
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
              <div>
                Manage your email communications to stay updated with the latest news and offers.
              </div>
              <Button className="h-8 px-3 text-xs" variant="ghost" onClick={openNewsletterEditor}>
                Edit newsletter preferences
              </Button>
              {newsletterMessage ? (
                <div className="text-xs text-emerald-600">{newsletterMessage}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {addressModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 px-4">
          <form
            onSubmit={submitAddress}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <div className="mb-4 text-lg font-semibold text-slate-900">
              {addressMode === "add" ? "Add New Address" : "Edit Address"}
            </div>
            <div className="grid gap-3">
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                placeholder="Street address"
                value={addressForm.address}
                onChange={(event) =>
                  setAddressForm((prev) => ({ ...prev, address: event.target.value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                  placeholder="City"
                  value={addressForm.city}
                  onChange={(event) =>
                    setAddressForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                />
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                  placeholder="State"
                  value={addressForm.state}
                  onChange={(event) =>
                    setAddressForm((prev) => ({ ...prev, state: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                  placeholder="Country"
                  value={addressForm.country}
                  onChange={(event) =>
                    setAddressForm((prev) => ({ ...prev, country: event.target.value }))
                  }
                />
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                  placeholder="Postal code"
                  value={addressForm.postalCode}
                  onChange={(event) =>
                    setAddressForm((prev) => ({ ...prev, postalCode: event.target.value }))
                  }
                />
              </div>
              {addressError ? <div className="text-sm text-red-600">{addressError}</div> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                onClick={() => setAddressModalOpen(false)}
                disabled={addressSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={addressSaving}
              >
                {addressSaving ? "Saving..." : "Save address"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {phoneVerifyOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="mb-2 text-lg font-semibold text-slate-900">Verify Phone Number</div>
            <p className="mb-4 text-sm text-slate-600">Enter the OTP sent to {data.phone}.</p>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              placeholder="Enter OTP"
              value={phoneOtp}
              onChange={(event) => setPhoneOtp(event.target.value)}
            />
            {phoneVerifyMessage ? (
              <div className="mt-2 text-sm text-slate-700">{phoneVerifyMessage}</div>
            ) : null}
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700"
                onClick={resendPhoneOtp}
                disabled={phoneResendLoading}
              >
                {phoneResendLoading ? "Resending..." : "Resend OTP"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  onClick={() => setPhoneVerifyOpen(false)}
                  disabled={phoneVerifyLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={submitPhoneVerification}
                  disabled={phoneVerifyLoading}
                >
                  {phoneVerifyLoading ? "Verifying..." : "Verify"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {changePhoneOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="mb-2 text-lg font-semibold text-slate-900">Change Phone Number</div>
            <p className="mb-4 text-sm text-slate-600">
              For security, the new number must be verified before it is saved.
            </p>
            <div className="grid gap-3">
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                placeholder="New phone number"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
                placeholder="OTP"
                value={newPhoneOtp}
                onChange={(event) => setNewPhoneOtp(event.target.value)}
              />
              {changePhoneMessage ? (
                <div className="text-sm text-slate-700">{changePhoneMessage}</div>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700"
                onClick={sendNewPhoneOtp}
                disabled={changePhoneResendLoading}
              >
                {changePhoneResendLoading ? "Sending..." : "Send OTP"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  onClick={() => setChangePhoneOpen(false)}
                  disabled={changePhoneLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={verifyAndSaveNewPhone}
                  disabled={changePhoneLoading}
                >
                  {changePhoneLoading ? "Saving..." : "Verify & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {newsletterOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="mb-2 text-lg font-semibold text-slate-900">Newsletter Email</div>
            <p className="mb-4 text-sm text-slate-600">
              Enter the email you want to use for newsletter updates.
            </p>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
              placeholder="you@example.com"
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
            />
            {newsletterMessage ? (
              <div className="mt-2 text-sm text-slate-700">{newsletterMessage}</div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                onClick={() => setNewsletterOpen(false)}
                disabled={newsletterSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                onClick={saveNewsletterEmail}
                disabled={newsletterSaving}
              >
                {newsletterSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
