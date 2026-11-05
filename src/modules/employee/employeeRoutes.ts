import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from '../../validators/validators';
import {
  createEmployee,
  getAllEmployees,
  getSingleEmployee,
  setEmployeeStatus,
  updateEmployee,
} from './employeeControllers';

const router = Router();

router.use(isAuthenticatedUser);
router.route('/')
  .post(validate(createEmployeeSchema), createEmployee)
  .get(getAllEmployees);
router.patch('/:id/status', validate(updateEmployeeStatusSchema), setEmployeeStatus);
router.route('/:id')
  .get(getSingleEmployee)
  .put(validate(updateEmployeeSchema), updateEmployee)
  .patch(validate(updateEmployeeSchema), updateEmployee);

export default router;
