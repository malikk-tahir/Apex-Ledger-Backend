import ErrorHandler from '../utils/errorHandler';


interface DateQuery {
  startDate?: string | Date;
  endDate?: string | Date;
}

interface DateFilterQuery {
  $gte?: Date;
  $lte?: Date;
}



const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/; // e.g., "2026-10"
const TIME_ZONE = 'Asia/Karachi';

/** Formats a date into "YYYY-MM" using Pakistan time */
const toMonthKey = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
};

/** Generates an unbroken array of months from start to end, e.g., ("2026-08", "2026-10") => ['2026-08', '2026-09', '2026-10'] */
const monthRange = (start: string, end: string): string[] => {
  const months: string[] = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};


const getDateFilter = (query: DateQuery): DateFilterQuery => {
  const { startDate, endDate } = query;
  const dateFilter: DateFilterQuery = {};

  if (startDate) {
    const parsedStartDate = new Date(startDate);
    if (Number.isNaN(parsedStartDate.getTime())) {
      throw new ErrorHandler('Invalid startDate format', 400);
    }
    dateFilter.$gte = parsedStartDate;
  }

  if (endDate) {
    const endDateStr = endDate instanceof Date ? endDate.toISOString() : endDate;
    const parsedEndDate = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
        ? `${endDateStr}T23:59:59.999Z`
        : endDateStr
    );
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new ErrorHandler('Invalid endDate format', 400);
    }
    dateFilter.$lte = parsedEndDate;
  }

  if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
    throw new ErrorHandler('startDate must be before or equal to endDate', 400);
  }

  return dateFilter;
};

export { MONTH_REGEX, toMonthKey, monthRange, getDateFilter };