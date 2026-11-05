import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { upload } from '../../middleware/multer';
import { validate } from '../../middleware/validate';
import { generateSalariesSchema, paySalarySchema } from '../../validators/validators';
import {
  deleteSalary,
  generateSalaries,
  getSalaries,
  getEmployeeSalaries,
  paySalary,
  undoSalaryPayment,
} from './employeeSalaryControllers';

const router = Router();

router.use(isAuthenticatedUser);
router.post('/generate', validate(generateSalariesSchema), generateSalaries);
router.get('/', getSalaries);
router.patch('/:id/pay', upload.single('file'), validate(paySalarySchema), paySalary);
router.patch('/:id/undo', undoSalaryPayment);
router.route('/:id')
  .get(getEmployeeSalaries)
  .delete(deleteSalary);

export default router;
