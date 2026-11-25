import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { upload } from '../../middleware/multer';
import { validate } from '../../middleware/validate';
import {
  createClientPaymentSchema,
  updateClientPaymentSchema,
} from '../../validators/validators';
import {
  addClientPayment,
  deleteClientPayment,
  getClientMonthlyLedger,
  getClientPayments,
  getMonthPayments,
  updateClientPayment,
} from './clientPaymentControllers';

const router = Router();

router.use(isAuthenticatedUser);

// Specific sub-routes first
router.get('/clients/:clientId/payments/ledger', getClientMonthlyLedger);
router.get('/clients/:clientId/payments/month/:monthYear', getMonthPayments);

// Base collection routes
router
  .route('/clients/:clientId/payments')
  .post(upload.single('file'), validate(createClientPaymentSchema), addClientPayment)
  .get(getClientPayments);

// Single payment record routes
router
  .route('/client-payments/:id')
  .put(upload.single('file'), validate(updateClientPaymentSchema), updateClientPayment)
  .patch(upload.single('file'), validate(updateClientPaymentSchema), updateClientPayment)
  .delete(deleteClientPayment);

export default router;