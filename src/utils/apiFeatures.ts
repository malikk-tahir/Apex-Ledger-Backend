import { Query } from 'mongoose';

export default class ApiFeatures<T> {
  query: Query<T[], T>;
  queryStr: Record<string, any>;

  constructor(query: Query<T[], T>, queryStr: Record<string, any>) {
    this.query = query;
    this.queryStr = queryStr;
  }

  search(): this {
    const keyword = this.queryStr.keyword
      ? {
          companyName: {
            $regex: this.queryStr.keyword,
            $options: 'i',
          },
        }
      : {};

    this.query = this.query.find({ ...keyword });
    return this;
  }

  filter(): this {
    const queryCopy = { ...this.queryStr };
    const removeFields = ['keyword', 'page', 'limit'];
    removeFields.forEach((field) => delete queryCopy[field]);

    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  pagination(resultPerPage: number): this {
    const currentPage = Number(this.queryStr.page) || 1;
    const skip = resultPerPage * (currentPage - 1);

    this.query = this.query.skip(skip).limit(resultPerPage);
    return this;
  }
}