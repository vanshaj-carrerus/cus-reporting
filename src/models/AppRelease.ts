import { Schema, model, models } from "mongoose";

export const APP_VERSION_MAX_LENGTH = 20;
export const APP_UPDATE_URL_MAX_LENGTH = 500;
export const APP_UPDATE_MESSAGE_MAX_LENGTH = 200;

// A single document: the newest version of the employee app, and where to get it.
const appReleaseSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "default" },
  // e.g. "1.2.0". Empty = nobody is asked to update.
  latestVersion: { type: String, default: "", maxlength: APP_VERSION_MAX_LENGTH },
  // Where employees download it (Play Store, a direct APK link, ...).
  updateUrl: { type: String, default: "", maxlength: APP_UPDATE_URL_MAX_LENGTH },
  message: { type: String, default: "", maxlength: APP_UPDATE_MESSAGE_MAX_LENGTH },
});

export const AppRelease = models.AppRelease ?? model("AppRelease", appReleaseSchema);
