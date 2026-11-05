import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), 'src/config/.env');
dotenv.config({ path: envPath });

import { dbConnected } from '../config/database';
import User from '../modules/user/userModel';

const seedUser = async (): Promise<void> => {
  try {
    await dbConnected();

    const userEmail = process.env.USER_EMAIL;
    const existingUser = await User.findOne({ email: userEmail });

    if (existingUser) {
      console.log(
        `User with email "${userEmail}" already exists. Skipping seed.`
      );
      process.exit(0);
    }

    const newUser = await User.create({
      name: process.env.USER_NAME,
      email: userEmail,
      mobile_no: process.env.USER_MOBILE_NO,
      password: process.env.USER_PASSWORD,
    });

    console.log('User account created successfully:');
    console.log({
      name: newUser.name,
      email: newUser.email,
      phone: newUser.mobile_no,
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding user account:', error);
    process.exit(1);
  }
};

seedUser();