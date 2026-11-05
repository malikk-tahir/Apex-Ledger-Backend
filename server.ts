import dotenv from 'dotenv';
dotenv.config({ path: './src/config/.env' });

import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

import app from './src/app';
import { dbConnected } from './src/config/database';
import { startSalaryCron } from './src/modules/employeeSalary/employeeSalaryCron';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await dbConnected();
    startSalaryCron();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();