import cron from 'node-cron';
import { generateSalaryRecords, getCurrentSalaryMonth } from './employeeSalaryService';

const runSalaryGeneration = async () => {
  try {
    const salaryMonth = getCurrentSalaryMonth();
    const { createdCount, skippedCount } = await generateSalaryRecords(salaryMonth);
    console.log(`[salary cron] ${salaryMonth}: ${createdCount} created, ${skippedCount} already existed`);
  } catch (error) {
    console.error('[salary cron] failed:', error);
  }
};

export const startSalaryCron = () => {
  // Runs at 00:05 every day in Pakistan timezone
  cron.schedule('5 0 * * *', runSalaryGeneration, { timezone: 'Asia/Karachi' });
  runSalaryGeneration(); // Catch-up run on server startup
};