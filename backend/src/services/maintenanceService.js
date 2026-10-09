import { MaintenanceTicket } from "../models/MaintenanceTicket.js";
import {
  assertMaintenanceActionable,
  canRejectMaintenance,
  assertWorkerCanUpdateProgress
} from "../workflows/maintenanceWorkflow.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { sendEmail } from "../utils/emailService.js";
import { canteenRequisitionStatusTemplate } from "../utils/emailTemplates.js";
import bcrypt from "bcryptjs";
import { escapeRegex } from "../utils/escapeRegex.js";
import { resolveActorProfile } from "../utils/authorization.js";
import { uploadImageToCloudinary } from "../utils/cloudinary.js";
import {
  normalizeDepartment,
  departmentMatches,
  resolveUserDepartment
} from "../utils/department.js";

const findDeptHod = async (orgId, department) => {
  if (!department) return null;
  const hods = await User.find({ organizationId: orgId, role: "hod" }).lean();
  return hods.find((h) => departmentMatches(h.department, department)) || null;
};

const findWorkshopHod = async (orgId) =>
  User.findOne({ organizationId: orgId, role: "workshop_hod" }).lean();

const findRegistrar = async (orgId) =>
  User.findOne({ organizationId: orgId, role: "registrar" }).lean();

const findDirector = async (orgId) =>
  User.findOne({ organizationId: orgId, role: "director" }).lean();

const findWorkerById = async (orgId, workerId) => {
  if (!workerId) return null;
  return User.findOne({ _id: workerId, organizationId: orgId, role: "worker" }).lean();
};

const canAccessTicket = (ticket, user, resolvedDepartment) => {
  const role = user.role;
  if (role === "super_admin" || role === "org_admin") return true;
  if (role === "faculty") return ticket.requesterId === user.sub;
  if (role === "hod") {
    const dept = resolvedDepartment || user.department;
    if (!dept) return false;
    const ticketDept = ticket.department || ticket.requesterDepartment;
    return departmentMatches(ticketDept, dept);
  }
  if (role === "workshop_hod") return true;
  if (role === "worker") return ticket.assignedWorkerId && String(ticket.assignedWorkerId) === String(user.sub);
  return false;
};

const sendWorkflowEmail = async ({ orgId, ticket, toUser, actor, heading, introLine, highlightLine }) => {
  if (!toUser?.email) return;
  const organization = await Organization.findById(orgId).lean();
  const html = canteenRequisitionStatusTemplate(
    ticket,
    toUser,
    actor,
    { heading, introLine, highlightLine },
    organization
  );
  sendEmail({
    to: toUser.email,
    subject: heading,
    html
  }).catch((emailError) => {
    console.error("[Maintenance] Error sending workflow email in background:", emailError);
  });
};

const notifyStakeholders = async ({ orgId, ticket, actor, heading, introLine, highlightLine }) => {
  try {
    const recipients = [];
    const requester = await User.findById(ticket.requesterId).lean();
    if (requester) recipients.push(requester);

    const deptHod = await findDeptHod(orgId, ticket.department || ticket.requesterDepartment);
    if (deptHod) recipients.push(deptHod);

    const workshop = await findWorkshopHod(orgId);
    if (workshop) recipients.push(workshop);

    const seen = new Set();
    const uniqueRecipients = recipients.filter((u) => {
      const key = String(u?._id || u?.email || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await Promise.all(
      uniqueRecipients.map((toUser) =>
        sendWorkflowEmail({ orgId, ticket, toUser, actor, heading, introLine, highlightLine })
      )
    );
  } catch (e) {
    console.error("[Maintenance] Stakeholder email error:", e);
  }
};

const generateWorkerEmail = ({ orgId, name }) => {
  const orgPart = String(orgId || "").slice(-6).toLowerCase();
  const namePart = String(name || "worker")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  const timePart = Date.now().toString().slice(-6);
  return `${namePart || "worker"}.${orgPart}.${timePart}@campus.worker.local`;
};

const generateTempPassword = () =>
  Math.random().toString(36).slice(-5) + Math.random().toString(36).slice(-5).toUpperCase();

export const listWorkers = async ({ orgId, user }) => {
  if (!["workshop_hod", "org_admin", "super_admin"].includes(user.role)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
  return User.find({ organizationId: orgId, role: "worker" })
    .select("_id name email phone role department")
    .sort({ createdAt: -1 })
    .lean();
};

export const createWorker = async ({ orgId, user, payload }) => {
  if (!["workshop_hod", "org_admin", "super_admin"].includes(user.role)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const name = String(payload?.name || "").trim();
  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "").trim();
  const department = String(payload?.department || "").trim() || "Workshop";

  if (!name || !phone || !email || !password) {
    const error = new Error("Name, phone, email, and password are required");
    error.status = 400;
    throw error;
  }

  const org = await Organization.findById(orgId).lean();
  if (!org) {
    const error = new Error("Invalid organization");
    error.status = 400;
    throw error;
  }

  const exists = await User.findOne({ organizationId: orgId, email }).lean();
  if (exists) {
    const error = new Error("User with this email already exists in this organization");
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await User.create({
    name,
    email,
    passwordHash,
    role: "worker",
    organizationId: orgId,
    phone,
    department
  });

  return {
    id: created._id,
    name: created.name,
    email: created.email,
    role: created.role,
    department: created.department,
    phone: created.phone
  };
};

export const updateWorker = async ({ orgId, workerId, user, payload }) => {
  if (!["workshop_hod", "org_admin", "super_admin"].includes(user.role)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const targetWorker = await User.findOne({
    _id: workerId,
    organizationId: orgId,
    role: "worker"
  });

  if (!targetWorker) {
    const error = new Error("Worker not found");
    error.status = 404;
    throw error;
  }

  const { name, phone, department, email, password } = payload || {};
  if (name) targetWorker.name = String(name).trim();
  if (phone !== undefined) targetWorker.phone = String(phone).trim();
  if (department !== undefined) targetWorker.department = String(department).trim();

  if (email && email.toLowerCase() !== targetWorker.email.toLowerCase()) {
    const existing = await User.findOne({
      organizationId: orgId,
      email: email.toLowerCase(),
      _id: { $ne: workerId }
    });
    if (existing) {
      const error = new Error("Email already exists in this organization");
      error.status = 400;
      throw error;
    }
    targetWorker.email = email.toLowerCase().trim();
  }

  if (password && String(password).trim().length > 0) {
    targetWorker.passwordHash = await bcrypt.hash(String(password).trim(), 10);
  }

  await targetWorker.save();

  return {
    id: targetWorker._id,
    name: targetWorker.name,
    email: targetWorker.email,
    role: targetWorker.role,
    department: targetWorker.department,
    phone: targetWorker.phone
  };
};

export const deleteWorker = async ({ orgId, workerId, user }) => {
  if (!["workshop_hod", "org_admin", "super_admin"].includes(user.role)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const targetWorker = await User.findOne({
    _id: workerId,
    organizationId: orgId,
    role: "worker"
  });

  if (!targetWorker) {
    const error = new Error("Worker not found or is not a worker");
    error.status = 404;
    throw error;
  }

  await User.deleteOne({
    _id: workerId,
    organizationId: orgId
  });

  await MaintenanceTicket.updateMany(
    {
      organizationId: orgId,
      assignedWorkerId: String(workerId),
      status: { $in: ["ASSIGNED_TO_WORKER", "PAUSED", "BACK_TO_WORKSHOP_AFTER_APPROVALS"] }
    },
    {
      $set: {
        status: "PENDING_WORKSHOP_HOD",
        assignedWorkerId: null,
        assignedWorkerName: null
      }
    }
  );

  return { success: true, message: "Worker removed successfully" };
};

export const createTicket = async ({ orgId, payload, user }) => {
  const CREATOR_ROLES = ["faculty", "hod", "org_admin", "super_admin"];
  if (!CREATOR_ROLES.includes(user.role)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const { department, issueCategory, problemTitle, actualProblem, itemsToRepair } = payload;

  if (!department || !department.trim()) {
    const error = new Error("Department is required");
    error.status = 400;
    throw error;
  }
  if (!issueCategory || !["minor", "major"].includes(issueCategory)) {
    const error = new Error("Issue category must be minor or major");
    error.status = 400;
    throw error;
  }
  if (!problemTitle || !problemTitle.trim()) {
    const error = new Error("Problem title is required");
    error.status = 400;
    throw error;
  }
  if (!actualProblem || !actualProblem.trim()) {
    const error = new Error("Actual problem is required");
    error.status = 400;
    throw error;
  }

  const normalizedItems =
    Array.isArray(itemsToRepair) && itemsToRepair.length
      ? itemsToRepair
          .map((it) => ({
            name: String(it?.name || "").trim(),
            quantity: Number(it?.quantity || 0)
          }))
          .filter((it) => it.name && it.quantity > 0)
      : [];

  const requester = await resolveActorProfile(user, orgId);
  if (!requester) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const status = "PENDING_WORKSHOP_HOD";

  const ticket = await MaintenanceTicket.create({
    organizationId: orgId,
    requesterId: String(requester._id || user.sub),
    requesterName: requester.name || user.email,
    requesterEmail: user.email || requester.email,
    requesterDepartment: requester.department || "",
    department: department.trim(),
    issueCategory,
    problemTitle: problemTitle.trim(),
    actualProblem: actualProblem.trim(),
    itemsToRepair: normalizedItems,
    status,
    purchaseRequired: false,
    actionLogs: [
      {
        stepOrder: 1,
        role: user.role || "faculty",
        actorId: user.sub,
        actorName: requester.name || user.email,
        action: "submit",
        fromStatus: "NEW",
        toStatus: "PENDING_WORKSHOP_HOD",
        remarks: "Submitted to Workshop Maintenance for review & technician assignment",
        timestamp: new Date()
      }
    ]
  });

  (async () => {
    try {
      const actor = requester || { name: user.email, email: user.email };
      await sendWorkflowEmail({
        orgId,
        ticket,
        toUser: requester,
        actor,
        heading: "College Utility | Maintenance Ticket Submitted",
        introLine: "Your maintenance ticket has been submitted to the workshop team.",
        highlightLine: "Ticket is awaiting workshop review and technician assignment."
      });

      const workshopHod = await findWorkshopHod(orgId);
      if (workshopHod) {
        await sendWorkflowEmail({
          orgId,
          ticket,
          toUser: workshopHod,
          actor,
          heading: "College Utility | Maintenance Ticket Awaiting Workshop Review",
          introLine: "A new maintenance ticket has been submitted and is awaiting workshop review.",
          highlightLine: "Please log in to review and assign a technician."
        });
      }

      const deptHod = await findDeptHod(orgId, ticket.department);
      if (deptHod) {
        await sendWorkflowEmail({
          orgId,
          ticket,
          toUser: deptHod,
          actor,
          heading: "College Utility | New Department Maintenance Ticket",
          introLine: `A maintenance ticket has been raised for ${ticket.department} and routed to Workshop.`,
          highlightLine: `Ticket: ${ticket.problemTitle}`
        });
      }
    } catch (e) {
      console.error("[Maintenance] Error sending creation emails in background:", e);
    }
  })();

  return ticket.toObject ? ticket.toObject() : ticket;
};

const buildListQuery = (orgId, user, resolvedDepartment = "") => {
  const base = { organizationId: orgId };
  const role = user.role;
  const userId = user?.sub || user?.id;
  if (role === "super_admin" || role === "org_admin") return base;
  if (role === "faculty") return { ...base, requesterId: userId };
  if (role === "hod") {
    const dept = String(resolvedDepartment || "").trim();
    if (dept) {
      return {
        ...base,
        department: { $regex: escapeRegex(dept), $options: "i" }
      };
    }
    return { ...base, department: "__no_department__" };
  }
  if (role === "workshop_hod") return base;
  if (role === "worker") return { ...base, assignedWorkerId: userId };
  return { ...base, requesterId: userId };
};

export const listTickets = async ({ orgId, user, status }) => {
  const resolvedDepartment = await resolveUserDepartment(orgId, user);
  let tickets = [];
  if (user.role === "hod") {
    const allInOrg = await MaintenanceTicket.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .lean();
    const filtered = allInOrg.filter((t) => canAccessTicket(t, user, resolvedDepartment));
    if (status && status !== "all") {
      tickets = filtered.filter((t) => t.status === status);
    } else {
      tickets = filtered;
    }
  } else {
    const q = buildListQuery(orgId, user, resolvedDepartment);
    if (status && status !== "all") q.status = status;
    tickets = await MaintenanceTicket.find(q).sort({ createdAt: -1 }).lean();
  }

  const canSeeComments = ["workshop_hod", "worker", "hod"].includes(user.role);
  if (!canSeeComments) {
    tickets.forEach((t) => {
      if (t.comments) t.comments = [];
    });
  }
  return tickets;
};

export const getTicket = async ({ orgId, ticketId, user }) => {
  const ticket = await MaintenanceTicket.findOne({ _id: ticketId, organizationId: orgId }).lean();
  if (!ticket) {
    const error = new Error("Ticket not found");
    error.status = 404;
    throw error;
  }
  const resolvedDepartment = await resolveUserDepartment(orgId, user);
  if (!canAccessTicket(ticket, user, resolvedDepartment)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const canSeeComments = ["workshop_hod", "worker", "hod"].includes(user.role);
  if (!canSeeComments && ticket.comments) {
    ticket.comments = [];
  }

  return ticket;
};

export const addTicketComment = async ({ orgId, ticketId, content, attachmentUrl, attachmentName, attachmentType, user }) => {
  const ticket = await MaintenanceTicket.findOne({ _id: ticketId, organizationId: orgId });
  if (!ticket) {
    const error = new Error("Ticket not found");
    error.status = 404;
    throw error;
  }

  if (user.role !== "workshop_hod" && user.role !== "worker") {
    const error = new Error("Forbidden: Requesters cannot access the chat");
    error.status = 403;
    throw error;
  }

  if (user.role === "worker" && String(ticket.assignedWorkerId) !== String(user.sub)) {
    const error = new Error("Forbidden: This ticket is not assigned to you");
    error.status = 403;
    throw error;
  }

  if ((!content || !String(content).trim()) && !attachmentUrl) {
    const error = new Error("content or attachment is required");
    error.status = 400;
    throw error;
  }

  const actor = await User.findById(user.sub).lean();

  let uploadedUrl = attachmentUrl || null;
  if (attachmentUrl && attachmentUrl.startsWith("data:image/")) {
    uploadedUrl = await uploadImageToCloudinary(attachmentUrl);
  }

  ticket.comments.push({
    authorId: user.sub,
    authorName: actor?.name || user.email,
    authorRole: user.role,
    content: content ? String(content).trim() : "",
    attachmentUrl: uploadedUrl,
    attachmentName: attachmentName || null,
    attachmentType: attachmentType || null,
    createdAt: new Date()
  });
  await ticket.save();
  return ticket.toObject ? ticket.toObject() : ticket;
};

const pushLog = (ticket, { user, action, fromStatus, toStatus, remarks, actorName }) => {
  ticket.actionLogs = ticket.actionLogs || [];
  ticket.actionLogs.push({
    stepOrder: ticket.actionLogs.length + 1,
    role: user.role,
    actorId: user.sub,
    actorName: actorName || user.email,
    action,
    fromStatus,
    toStatus,
    remarks,
    timestamp: new Date()
  });
};

export const actOnTicket = async ({ orgId, ticketId, action, payload, user }) => {
  const ticket = await MaintenanceTicket.findOne({ _id: ticketId, organizationId: orgId });
  if (!ticket) {
    const error = new Error("Ticket not found");
    error.status = 404;
    throw error;
  }

  const role = user.role;
  const current = ticket.status;
  const actor = (await resolveActorProfile(user, orgId)) || { name: user.email, email: user.email };
  const actorName = actor?.name || user.email;

  assertMaintenanceActionable(current);

  const reject = async () => {
    if (!canRejectMaintenance(role, current)) {
      const error = new Error("You cannot reject this ticket at its current stage");
      error.status = 409;
      throw error;
    }
    const fromStatus = ticket.status;
    ticket.status = "REJECTED";
    pushLog(ticket, { user, action: "reject", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
    await ticket.save();

    notifyStakeholders({
      orgId,
      ticket: ticket.toObject ? ticket.toObject() : ticket,
      actor: actor || { name: user.email, email: user.email },
      heading: "College Utility | Maintenance Ticket Rejected",
      introLine: "This maintenance ticket has been rejected in the approval workflow.",
      highlightLine: payload?.remarks ? `Remarks: ${payload.remarks}` : "Please review ticket details for context."
    }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));

    return ticket.toObject ? ticket.toObject() : ticket;
  };

  if (action === "reject") {
    if (!["hod", "workshop_hod"].includes(role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
    return reject();
  }

  if (action === "approve") {
    if (role === "hod" && (current === "PENDING_DEPT_HOD" || current === "PENDING_WORKSHOP_HOD")) {
      const fromStatus = current;
      ticket.status = "PENDING_WORKSHOP_HOD";
      pushLog(ticket, { user, action: "approve", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
      await ticket.save();

      try {
        const requester = await User.findById(ticket.requesterId).lean();
        if (requester) {
          sendWorkflowEmail({
            orgId,
            ticket: ticket.toObject ? ticket.toObject() : ticket,
            toUser: requester,
            actor: actor || { name: user.email, email: user.email },
            heading: "College Utility | Maintenance Ticket Approved by Department HOD",
            introLine: "Your maintenance ticket has been approved by the Department HOD.",
            highlightLine: "It has been forwarded to the Workshop HOD for review."
          }).catch(e => console.error("[Maintenance] Email requester error:", e));
        }
        const workshop = await findWorkshopHod(orgId);
        if (workshop) {
          sendWorkflowEmail({
            orgId,
            ticket: ticket.toObject ? ticket.toObject() : ticket,
            toUser: workshop,
            actor: actor || { name: user.email, email: user.email },
            heading: "College Utility | Maintenance Ticket Awaiting Workshop Review",
            introLine: "A maintenance ticket is awaiting your workshop review.",
            highlightLine: "Please log in to review and proceed."
          }).catch(e => console.error("[Maintenance] Email workshop HOD error:", e));
        }
      } catch (e) {
        console.error("[Maintenance] Email error:", e);
      }
      return ticket.toObject ? ticket.toObject() : ticket;
    }

    if (role === "workshop_hod" && (current === "PENDING_WORKSHOP_HOD" || current === "PENDING_DEPT_HOD")) {
      const fromStatus = current;
      const workerId = payload?.workerId;
      const worker = await findWorkerById(orgId, workerId);
      if (!worker) {
        const error = new Error("Worker is required to approve tickets");
        error.status = 400;
        throw error;
      }
      ticket.purchaseRequired = false;
      ticket.estimatedCost = null;
      ticket.assignedWorkerId = String(worker._id);
      ticket.assignedWorkerName = worker.name || worker.email;
      ticket.status = "ASSIGNED_TO_WORKER";
      pushLog(ticket, { user, action: "approve", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
      await ticket.save();

      try {
        sendWorkflowEmail({
          orgId,
          ticket: ticket.toObject ? ticket.toObject() : ticket,
          toUser: worker,
          actor: actor || { name: user.email, email: user.email },
          heading: "College Utility | Maintenance Task Assigned",
          introLine: "A maintenance task has been assigned to you by Workshop HOD.",
          highlightLine: "Please log in and complete the task."
        }).catch(e => console.error("[Maintenance] Worker assignment email error:", e));
      } catch (e) {
        console.error("[Maintenance] Worker assignment email error:", e);
      }

      notifyStakeholders({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Ticket Approved & Assigned",
        introLine: `Workshop HOD approved the ticket and assigned worker ${worker.name}.`,
        highlightLine: `Ticket: ${ticket.problemTitle}`
      }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));
      return ticket.toObject ? ticket.toObject() : ticket;
    }

    if ((role === "hod" || role === "budget_hod") && current === "PENDING_BUDGET_DEPT_HOD") {
      const fromStatus = current;
      ticket.status = "PENDING_REGISTRAR";
      pushLog(ticket, { user, action: "budget_approve", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
      await ticket.save();

      notifyStakeholders({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Budget Approved by Department HOD",
        introLine: "Department HOD approved the external purchase budget.",
        highlightLine: `Estimated cost: ₹${ticket.estimatedCost || 0}. Pending Registrar approval.`
      }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));
      return ticket.toObject ? ticket.toObject() : ticket;
    }

    if (role === "registrar" && current === "PENDING_REGISTRAR") {
      const fromStatus = current;
      ticket.status = "PENDING_DIRECTOR";
      pushLog(ticket, { user, action: "approve", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
      await ticket.save();

      notifyStakeholders({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Budget Approved by Registrar",
        introLine: "Registrar approved this maintenance purchase request.",
        highlightLine: `Estimated cost: ₹${ticket.estimatedCost || 0}. Pending Director approval.`
      }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));
      return ticket.toObject ? ticket.toObject() : ticket;
    }

    if (role === "director" && current === "PENDING_DIRECTOR") {
      const fromStatus = current;
      ticket.status = "BACK_TO_WORKSHOP_AFTER_APPROVALS";
      pushLog(ticket, { user, action: "approve", fromStatus, toStatus: ticket.status, remarks: payload?.remarks, actorName });
      await ticket.save();

      notifyStakeholders({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Purchase Approved by Director",
        introLine: "Director approved this maintenance purchase request.",
        highlightLine: `Estimated cost: ₹${ticket.estimatedCost || 0}. Ticket returned to Workshop for execution.`
      }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));
      return ticket.toObject ? ticket.toObject() : ticket;
    }

    const error = new Error("You cannot approve this ticket at this stage");
    error.status = 409;
    throw error;
  }

  if (action === "assign_worker") {
    if (role !== "workshop_hod") {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
    if (!["PENDING_WORKSHOP_HOD", "PENDING_DEPT_HOD", "BACK_TO_WORKSHOP_AFTER_APPROVALS", "ASSIGNED_TO_WORKER", "PENDING_WORKSHOP_VERIFICATION"].includes(current)) {
      const error = new Error("Ticket is not ready for assignment");
      error.status = 409;
      throw error;
    }
    const workerId = payload?.workerId;
    const worker = await findWorkerById(orgId, workerId);
    if (!worker) {
      const error = new Error("Invalid worker");
      error.status = 400;
      throw error;
    }

    const fromStatus = current;
    ticket.purchaseRequired = false;
    ticket.estimatedCost = null;
    ticket.assignedWorkerId = String(worker._id);
    ticket.assignedWorkerName = worker.name || worker.email;
    ticket.status = "ASSIGNED_TO_WORKER";
    pushLog(ticket, { user, action: "assign_worker", fromStatus, toStatus: ticket.status, remarks: payload?.remarks || "Assigned by Workshop HOD", actorName });
    await ticket.save();

    try {
      sendWorkflowEmail({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        toUser: worker,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Task Assigned",
        introLine: "A maintenance task has been assigned to you by Workshop HOD.",
        highlightLine: "Please log in and complete the task."
      }).catch(e => console.error("[Maintenance] Email error:", e));
    } catch (e) {
      console.error("[Maintenance] Email error:", e);
    }

    notifyStakeholders({
      orgId,
      ticket: ticket.toObject ? ticket.toObject() : ticket,
      actor: actor || { name: user.email, email: user.email },
      heading: "College Utility | Maintenance Ticket Assigned",
      introLine: `Workshop HOD assigned worker ${worker.name}.`,
      highlightLine: `Ticket: ${ticket.problemTitle}`
    }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));

    return ticket.toObject ? ticket.toObject() : ticket;
  }

  if (action === "complete") {
    if (role === "worker") {
      if (String(ticket.assignedWorkerId) !== String(user.sub)) {
        const error = new Error("Forbidden: This ticket is not assigned to you");
        error.status = 403;
        throw error;
      }
      if (current !== "ASSIGNED_TO_WORKER") {
        const error = new Error(`Ticket is not in active worker repair stage (current status: ${current})`);
        error.status = 409;
        throw error;
      }

      const fromStatus = current;
      ticket.status = "PENDING_WORKSHOP_VERIFICATION";
      ticket.workerProgress = {
        status: "COMPLETED",
        reason: payload?.remarks || "Work finished by assigned technician. Awaiting Workshop HOD verification.",
        updatedAt: new Date()
      };
      pushLog(ticket, {
        user,
        action: "worker_complete",
        fromStatus,
        toStatus: ticket.status,
        remarks: payload?.remarks || "Work marked completed by technician. Submitted to Workshop HOD for final verification.",
        actorName
      });
      await ticket.save();

      try {
        const workshop = await findWorkshopHod(orgId);
        if (workshop) {
          sendWorkflowEmail({
            orgId,
            ticket: ticket.toObject ? ticket.toObject() : ticket,
            toUser: workshop,
            actor: actor || { name: user.email, email: user.email },
            heading: "College Utility | Maintenance Work Done - Awaiting Verification",
            introLine: `Technician ${actorName} has finished the repair work for ticket: ${ticket.problemTitle}.`,
            highlightLine: "Please review and verify the work to mark the ticket officially completed."
          }).catch(e => console.error("[Maintenance] Workshop verification email error:", e));
        }
      } catch (e) {
        console.error("[Maintenance] Workshop verification email error:", e);
      }

      return ticket.toObject ? ticket.toObject() : ticket;
    }

    if (role === "workshop_hod" || role === "org_admin" || role === "super_admin") {
      if (!["ASSIGNED_TO_WORKER", "PENDING_WORKSHOP_VERIFICATION"].includes(current)) {
        const error = new Error(`Ticket cannot be completed from status ${current}`);
        error.status = 409;
        throw error;
      }

      const fromStatus = current;
      ticket.status = "COMPLETED";
      ticket.completedAt = new Date();
      if (!ticket.workerProgress) {
        ticket.workerProgress = {
          status: "COMPLETED",
          reason: "Completed & verified by Workshop HOD.",
          updatedAt: new Date()
        };
      } else {
        ticket.workerProgress.status = "COMPLETED";
      }
      pushLog(ticket, {
        user,
        action: "complete",
        fromStatus,
        toStatus: ticket.status,
        remarks: payload?.remarks || (fromStatus === "PENDING_WORKSHOP_VERIFICATION" ? "Work verified and officially closed by Workshop HOD." : "Completed by Workshop HOD."),
        actorName
      });
      await ticket.save();

      notifyStakeholders({
        orgId,
        ticket: ticket.toObject ? ticket.toObject() : ticket,
        actor: actor || { name: user.email, email: user.email },
        heading: "College Utility | Maintenance Ticket Completed & Verified",
        introLine: `The maintenance ticket has been verified and marked completed by Workshop HOD ${actorName}.`,
        highlightLine: `Ticket: ${ticket.problemTitle}`
      }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));

      return ticket.toObject ? ticket.toObject() : ticket;
    }

    const error = new Error("Forbidden: You do not have permission to complete this ticket");
    error.status = 403;
    throw error;
  }

  if (action === "pause") {
    if (role !== "workshop_hod" && role !== "worker") {
      const error = new Error("Forbidden: Only Workshop HOD or assigned worker can pause a ticket");
      error.status = 403;
      throw error;
    }
    if (role === "worker" && String(ticket.assignedWorkerId) !== String(user.sub)) {
      const error = new Error("Forbidden: This ticket is not assigned to you");
      error.status = 403;
      throw error;
    }
    if (current !== "ASSIGNED_TO_WORKER") {
      const error = new Error("Only assigned tickets can be paused");
      error.status = 409;
      throw error;
    }
    const reason = String(payload?.reason || "").trim();
    if (!reason) {
      const error = new Error("Pause reason is required");
      error.status = 400;
      throw error;
    }

    const fromStatus = current;
    ticket.status = "PAUSED";
    ticket.pauseReason = reason;
    ticket.pausedAt = new Date();
    ticket.pausedById = user.sub;
    ticket.pausedByName = actorName;
    pushLog(ticket, {
      user,
      action: "pause",
      fromStatus,
      toStatus: ticket.status,
      remarks: reason,
      actorName
    });
    await ticket.save();

    notifyStakeholders({
      orgId,
      ticket: ticket.toObject ? ticket.toObject() : ticket,
      actor: actor || { name: user.email, email: user.email },
      heading: "College Utility | Maintenance Ticket Paused",
      introLine: `The maintenance ticket "${ticket.problemTitle}" has been paused by ${actorName} (${role === "worker" ? "Worker" : "Workshop HOD"}).`,
      highlightLine: `Pause Reason: ${reason}`
    }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));

    return ticket.toObject ? ticket.toObject() : ticket;
  }

  if (action === "reopen") {
    const reopenAllowedRoles = ["faculty", "hod", "org_admin", "super_admin"];
    if (!reopenAllowedRoles.includes(role)) {
      const error = new Error("Forbidden: Only faculty/requester, HOD, or admin can reopen a paused ticket");
      error.status = 403;
      throw error;
    }
    if (role === "faculty" && String(ticket.requesterId) !== String(user.sub)) {
      const error = new Error("Forbidden: You can only reopen your own tickets");
      error.status = 403;
      throw error;
    }
    if (current !== "PAUSED") {
      const error = new Error("Only paused tickets can be reopened");
      error.status = 409;
      throw error;
    }
    const reason = String(payload?.reason || "").trim();
    if (!reason) {
      const error = new Error("Reopen reason is required");
      error.status = 400;
      throw error;
    }

    const fromStatus = current;
    ticket.status = "ASSIGNED_TO_WORKER";
    ticket.pauseReason = null;
    ticket.pausedAt = null;
    ticket.pausedById = null;
    ticket.pausedByName = null;
    pushLog(ticket, {
      user,
      action: "reopen",
      fromStatus,
      toStatus: ticket.status,
      remarks: reason,
      actorName
    });
    await ticket.save();

    notifyStakeholders({
      orgId,
      ticket: ticket.toObject ? ticket.toObject() : ticket,
      actor: actor || { name: user.email, email: user.email },
      heading: "College Utility | Maintenance Ticket Reopened",
      introLine: `The maintenance ticket "${ticket.problemTitle}" has been reopened by ${actorName}.`,
      highlightLine: `Reopen Reason: ${reason}. Worker ${ticket.assignedWorkerName || "assigned"} can resume work.`
    }).catch(e => console.error("[Maintenance] Stakeholder notify error:", e));

    if (ticket.assignedWorkerId) {
      const worker = await findWorkerById(orgId, ticket.assignedWorkerId);
      if (worker) {
        sendWorkflowEmail({
          orgId,
          ticket: ticket.toObject ? ticket.toObject() : ticket,
          toUser: worker,
          actor: actor || { name: user.email, email: user.email },
          heading: "College Utility | Your Maintenance Task Has Been Reopened",
          introLine: `The ticket "${ticket.problemTitle}" you were working on has been reopened.`,
          highlightLine: `Reopen Reason: ${reason}. Please log in and resume work.`
        }).catch(e => console.error("[Maintenance] Worker reopen email error:", e));
      }
    }

    return ticket.toObject ? ticket.toObject() : ticket;
  }

  const error = new Error("Invalid action");
  error.status = 400;
  throw error;
};

export const updateWorkerProgress = async ({ orgId, ticketId, payload, user }) => {
  const ticket = await MaintenanceTicket.findOne({
    _id: ticketId,
    organizationId: orgId
  });

  if (!ticket) {
    const error = new Error("Ticket not found");
    error.status = 404;
    throw error;
  }

  assertWorkerCanUpdateProgress(ticket, user.sub);

  const { status, reason } = payload;
  if (!status) {
    const error = new Error("Progress status is required");
    error.status = 400;
    throw error;
  }

  ticket.workerProgress = {
    status,
    reason: (status === "ON_HOLD" || status === "INCOMPLETE") ? (reason || "").trim() : "",
    updatedAt: new Date()
  };

  await ticket.validate();

  ticket.actionLogs = ticket.actionLogs || [];
  const logEntry = {
    stepOrder: ticket.actionLogs.length + 1,
    role: user.role,
    actorId: user.sub,
    actorName: user.email,
    action: `worker_progress_${status.toLowerCase()}`,
    fromStatus: ticket.status,
    toStatus: ticket.status,
    remarks: reason ? `Reason: ${reason}` : `Worker progress updated to ${status}`
  };
  ticket.actionLogs.push(logEntry);

  await ticket.save();

  (async () => {
    try {
      const [requester, workshopHod] = await Promise.all([
        User.findOne({ _id: ticket.requesterId }).lean(),
        findWorkshopHod(orgId)
      ]);

      const actor = { name: user.email, email: user.email };
      const heading = `Maintenance Ticket Progress Update: ${status}`;
      const introLine = `Worker has updated the progress of the maintenance ticket (Title: "${ticket.problemTitle}").`;
      let highlightLine = `Current Worker Status: ${status}.`;
      if (status === "ON_HOLD" || status === "INCOMPLETE") {
        highlightLine += ` Reason: ${reason}`;
      } else if (status === "COMPLETED") {
        highlightLine += ` Worker marked complete, awaiting Workshop HOD confirmation.`;
      }

      if (requester) {
        await sendWorkflowEmail({
          orgId,
          ticket,
          toUser: requester,
          actor,
          heading,
          introLine,
          highlightLine
        });
      }

      if (workshopHod) {
        await sendWorkflowEmail({
          orgId,
          ticket,
          toUser: workshopHod,
          actor,
          heading,
          introLine,
          highlightLine
        });
      }
    } catch (emailError) {
      console.error("[Maintenance Progress Email] Error sending notifications:", emailError);
    }
  })();

  return ticket.toObject ? ticket.toObject() : ticket;
};

