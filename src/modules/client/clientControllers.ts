import { RequestHandler } from 'express';
import HandleAsyncError from '../../middleware/handleAsyncError';
import ErrorHandler from '../../utils/errorHandler';
import Client from './clientModel';
import ApiFeatures from '../../utils/apiFeatures';

export const createClient: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const {
      companyName,
      ownerName,
      category,
      contact,
      address,
      type,
      services,
      monthlyContractAmount,
      date,
    } = req.body;

    // Retainer clients require a monthly contract amount
    if (type === 'retainer' && (!monthlyContractAmount || monthlyContractAmount <= 0)) {
      return next(new ErrorHandler('Retainer clients require a valid monthly contract amount', 400));
    }

    const clientData: any = {
      companyName,
      ownerName,
      category,
      contact,
      address,
      type,
      services,
    };

    // Only set contract amount if it's a retainer and provided
    if (type === 'retainer' && monthlyContractAmount !== undefined) {
      clientData.monthlyContractAmount = monthlyContractAmount;
    }

    // Only assign date if provided, otherwise let Mongoose default handle it
    if (date) {
      clientData.date = date;
    }

    const newClient = await Client.create(clientData);

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: newClient,
    });
  }
);

// 2. Get All Clients (with Pagination & Search/Filter)
export const getAllClients: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const resultPerPage = 10;

    const countApiFeatures = new ApiFeatures(Client.find(), req.query)
      .search()
      .filter();

    const totalCount = await countApiFeatures.query.countDocuments();

    const apiFeatures = new ApiFeatures(Client.find(), req.query)
      .search()
      .filter()
      .pagination(resultPerPage);

    const clients = await apiFeatures.query.sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / resultPerPage),
      currentPage: Number(req.query.page) || 1,
      resultsPerPage: resultPerPage,
      data: clients,
    });
  }
);

// 3. Get Single Client by ID
export const getClientById: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    res.status(200).json({
      success: true,
      data: client,
    });
  }
);

// 4. Update Client
export const updateClient: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;
    const {
      companyName,
      ownerName,
      category,
      contact,
      address,
      type,
      services,
      monthlyContractAmount,
      date,
    } = req.body;

    // Find existing client first
    const client = await Client.findById(id);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    // Determine client type
    const clientType = type || client.type;
    const contractAmount = monthlyContractAmount !== undefined ? monthlyContractAmount : client.monthlyContractAmount;

    // Conditional validation for retainer clients
    if (clientType === 'retainer' && (!contractAmount || contractAmount <= 0)) {
      return next(new ErrorHandler('Retainer clients require a valid monthly contract amount', 400));
    }

    // Prepare update payload
    const updateData: any = {
      companyName,
      ownerName,
      category,
      contact,
      address,
      type,
      services,
      date,
    };

    // If switching to one_time, clear out contract amount; otherwise update it if given
    if (clientType === 'one_time') {
      updateData.monthlyContractAmount = null;
    } else if (monthlyContractAmount !== undefined) {
      updateData.monthlyContractAmount = monthlyContractAmount;
    }

    const updatedClient = await Client.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: updatedClient,
    });
  }
);

// 5. Delete Client
// export const deleteClient: RequestHandler = HandleAsyncError(
//   async (req, res, next) => {
//     const client = await Client.findById(req.params.id);

//     if (!client) {
//       return next(new ErrorHandler('Client not found', 404));
//     }

//     await client.deleteOne();

//     res.status(200).json({
//       success: true,
//       message: 'Client deleted successfully',
//     });
//   }
// );