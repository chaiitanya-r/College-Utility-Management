import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
});

export const uploadImageToCloudinary = async (base64Str) => {
  if (!base64Str) return null;

  if (base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
    return base64Str;
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Str, {
      folder: "college_management"
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error("[Cloudinary] Upload failed:", error);
    return base64Str;
  }
};
