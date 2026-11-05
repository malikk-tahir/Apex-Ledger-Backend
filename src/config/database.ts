import mongoose from "mongoose";

export const dbConnected = async (): Promise<mongoose.Mongoose> => {
    const dbUri = process.env.DB_URI;

    if (!dbUri) {
    throw new Error("DB_URI is not defined in environment variables.");
    }
    return await mongoose.connect(dbUri);
};
