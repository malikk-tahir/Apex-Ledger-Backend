import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

export const uploadBufferToCloudinary = (fileBuffer: Buffer, folderName: string = 'apex_uploads'): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};