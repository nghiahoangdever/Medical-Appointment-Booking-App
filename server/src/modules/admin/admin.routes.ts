import { Router } from 'express';
import { Role } from '../../domain/enums';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { RoomController } from '../rooms/room.controller';
import { roomService } from '../rooms/room.service';
import { RosterController } from '../roster/roster.controller';
import { rosterService } from '../roster/roster.service';
import { ShiftController } from '../shifts/shift.controller';
import { shiftService } from '../shifts/shift.service';
import { SpecialtyController } from '../specialties/specialty.controller';
import { specialtyService } from '../specialties/specialty.service';
import { StaffController } from '../staff/staff.controller';
import { staffService } from '../staff/staff.service';

const specialties = new SpecialtyController(specialtyService);
const rooms = new RoomController(roomService);
const staff = new StaffController(staffService);
const shifts = new ShiftController(shiftService);
const roster = new RosterController(rosterService);

/** Admin management (UC-A1..A7), mounted at /api/admin. Every route requires the ADMIN role. */
export const adminRouter = Router();

adminRouter.use(authenticate, requireRole(Role.ADMIN));

// UC-A1 Specialties
adminRouter.get('/specialties', specialties.listAll);
adminRouter.post('/specialties', specialties.create);
adminRouter.patch('/specialties/:id', specialties.update);
adminRouter.post('/specialties/:id/activate', specialties.activate);
adminRouter.post('/specialties/:id/deactivate', specialties.deactivate);

// UC-A2 Rooms
adminRouter.get('/rooms', rooms.list);
adminRouter.post('/rooms', rooms.create);
adminRouter.patch('/rooms/:id', rooms.update);
adminRouter.post('/rooms/:id/activate', rooms.activate);
adminRouter.post('/rooms/:id/deactivate', rooms.deactivate);

// UC-A3 Doctors (id = Doctor.id)
adminRouter.get('/doctors', staff.listDoctors);
adminRouter.post('/doctors', staff.createDoctor);
adminRouter.patch('/doctors/:id', staff.updateDoctor);
adminRouter.post('/doctors/:id/activate', staff.activateDoctor);
adminRouter.post('/doctors/:id/deactivate', staff.deactivateDoctor);

// UC-A4 Receptionists (id = User.id)
adminRouter.get('/receptionists', staff.listReceptionists);
adminRouter.post('/receptionists', staff.createReceptionist);
adminRouter.patch('/receptionists/:id', staff.updateReceptionist);
adminRouter.post('/receptionists/:id/activate', staff.activateReceptionist);
adminRouter.post('/receptionists/:id/deactivate', staff.deactivateReceptionist);

// UC-A5 Shift times (list: GET /api/shifts)
adminRouter.patch('/shifts/:id', shifts.updateTimes);

// UC-A6 / UC-A7 Weekly roster
adminRouter.get('/roster', roster.week);
adminRouter.post('/roster/copy-previous-week', roster.copyPreviousWeek);
adminRouter.post('/roster-entries', roster.create);
adminRouter.patch('/roster-entries/:id', roster.update);
adminRouter.delete('/roster-entries/:id', roster.remove);
