import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { upload } from '../../middleware/multer';
import { validate } from '../../middleware/validate';
import { createTransactionSchema, updateTransactionSchema } from '../../validators/validators';
import {
  addTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactionSummary,
  getTransactions,
  updateTransaction,
} from './officeExpenseControllers';

const router = Router();

router.use(isAuthenticatedUser);
router.route('/')
  .post(upload.single('file'), validate(createTransactionSchema), addTransaction)
  .get(getTransactions);
router.get('/summary', getTransactionSummary);
router.route('/:id')
  .get(getTransactionById)
  .put(upload.single('file'), validate(updateTransactionSchema), updateTransaction)
  .patch(upload.single('file'), validate(updateTransactionSchema), updateTransaction)
  .delete(deleteTransaction);

export default router;
