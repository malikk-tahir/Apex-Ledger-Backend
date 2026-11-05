import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createClientSchema, updateClientSchema } from '../../validators/validators';
import {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
} from './clientControllers';

const router = Router();

router.use(isAuthenticatedUser);
router.route('/')
  .post(validate(createClientSchema), createClient)
  .get(getAllClients);
router.route('/:id')
  .get(getClientById)
  .put(validate(updateClientSchema), updateClient)
  .patch(validate(updateClientSchema), updateClient);

export default router;
