import { Router } from 'express';
import { isAuthenticatedUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { loginUserSchema } from '../../validators/validators';
import { getCurrentUser, loginUser, logout } from './userControllers';

const router = Router();

router.post('/login', validate(loginUserSchema), loginUser);
router.use(isAuthenticatedUser);
router.post('/logout', logout);
router.get('/me', getCurrentUser);

export default router;
