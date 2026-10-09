import { Organization } from "../models/Organization.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { Utility } from "../models/Utility.js";
import { Hall } from "../models/Hall.js";
import { MaintenanceTicket } from "../models/MaintenanceTicket.js";
import { Requisition } from "../models/Requisition.js";
import { Category } from "../models/Category.js";
import { CanteenMenu } from "../models/CanteenMenu.js";
import { ChatbotUsage } from "../models/ChatbotUsage.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { Department } from "../models/Department.js";
import XLSX from "xlsx";

export const listOrganizations = async (includeInactive = false) => {
  const query = includeInactive ? {} : { isActive: true };
  const orgs = await Organization.find(query).lean();
  return orgs;
};

export const getOrganizationById = async (orgId) => {
  const org = await Organization.findById(orgId).lean();
  if (!org || !org.isActive) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }
  return org;
};

export const getPlatformStats = async () => {
  const [totalOrganizations, activeOrganizations, totalAdmins, totalBookings] =
    await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ isActive: true }),
      User.countDocuments({ role: "org_admin" }),
      Booking.countDocuments()
    ]);

  return {
    totalOrganizations,
    activeOrganizations,
    inactiveOrganizations: totalOrganizations - activeOrganizations,
    totalAdmins,
    totalBookings
  };
};

export const createOrganization = async ({ name }) => {
  if (!name || !name.trim()) {
    const error = new Error("Organization name is required");
    error.status = 400;
    throw error;
  }

  const trimmedName = name.trim();
  const existing = await Organization.findOne({ name: trimmedName });
  if (existing) {
    const statusMsg = existing.isActive ? "already exists" : "exists in inactive/deactivated state. Please reactivate it instead";
    const error = new Error(`Organization "${trimmedName}" ${statusMsg}.`);
    error.status = 400;
    throw error;
  }

  const org = await Organization.create({
    name: trimmedName,
    isActive: true
  });

  return org;
};

export const deleteOrganization = async ({ orgId }) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }

  org.isActive = false;
  await org.save();
  return org;
};

export const reactivateOrganization = async ({ orgId }) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }

  org.isActive = true;
  await org.save();
  return org;
};

export const purgeOrganization = async ({ orgId }) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }

  const results = await Promise.all([
    Organization.deleteOne({ _id: orgId }),
    User.deleteMany({ organizationId: orgId }),
    Booking.deleteMany({ organizationId: orgId }),
    Utility.deleteMany({ organizationId: orgId }),
    Hall.deleteMany({ organizationId: orgId }),
    MaintenanceTicket.deleteMany({ organizationId: orgId }),
    Requisition.deleteMany({ organizationId: orgId }),
    Category.deleteMany({ organizationId: orgId }),
    CanteenMenu.deleteMany({ organizationId: orgId }),
    ChatbotUsage.deleteMany({ organizationId: orgId }),
    PasswordReset.deleteMany({ organizationId: orgId }),
    Department.deleteMany({ organizationId: orgId })
  ]);

  return {
    deleted: true,
    orgId,
    purgedData: {
      users: results[1]?.deletedCount || 0,
      bookings: results[2]?.deletedCount || 0,
      utilities: results[3]?.deletedCount || 0,
      halls: results[4]?.deletedCount || 0,
      maintenanceTickets: results[5]?.deletedCount || 0,
      requisitions: results[6]?.deletedCount || 0,
      categories: results[7]?.deletedCount || 0,
      canteenMenus: results[8]?.deletedCount || 0,
      chatbotLogs: results[9]?.deletedCount || 0,
      passwordResets: results[10]?.deletedCount || 0
    }
  };
};

function csvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatDate(d) {
  if (!d) return "N/A";
  try {
    return new Date(d).toISOString().replace("T", " ").replace(/\..+/, "");
  } catch {
    return String(d);
  }
}

export const exportOrganizationHistory = async ({ orgId, format = "csv" }) => {
  const org = await Organization.findById(orgId).lean();
  if (!org) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }

  const [users, bookings, maintenanceTickets, requisitions, utilities, chatbotLogs] = await Promise.all([
    User.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean(),
    Booking.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean(),
    MaintenanceTicket.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean(),
    Requisition.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean(),
    Utility.find({ organizationId: orgId }).sort({ createdAt: -1 }).lean(),
    ChatbotUsage.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(200).lean()
  ]);

  const sanitizedOrgName = org.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStamp = new Date().toISOString().split("T")[0];

  const userRows = users.map((u, idx) => ({
    "No.": idx + 1,
    "User ID": String(u._id),
    "Name": u.name || "",
    "Email": u.email || "",
    "Role": u.role || "",
    "Department": u.department || "N/A",
    "Phone": u.phone || "N/A",
    "Created Date": formatDate(u.createdAt)
  }));

  const bookingRows = bookings.map((b, idx) => ({
    "No.": idx + 1,
    "Booking ID": String(b._id),
    "Facility / Utility": b.utilityName || "",
    "Category": b.categoryName || "",
    "Requester Name": b.requesterName || "",
    "Requester Email": b.requesterEmail || "",
    "Requester Role": b.requesterRole || "",
    "Department": b.requesterDepartment || "",
    "Date": b.date || "",
    "Time Slot": b.timeSlotLabel || "",
    "Purpose": b.purpose || "",
    "Attendees": b.attendeesCount || "N/A",
    "Status": b.status || "",
    "Booked On": formatDate(b.createdAt)
  }));

  const ticketRows = maintenanceTickets.map((t, idx) => ({
    "No.": idx + 1,
    "Ticket ID": String(t._id),
    "Problem Title": t.problemTitle || "",
    "Issue Category": t.issueCategory || "",
    "Actual Problem": t.actualProblem || "",
    "Department": t.department || t.requesterDepartment || "",
    "Status": t.status || "",
    "Reported By": t.requesterName ? `${t.requesterName} (${t.requesterEmail})` : t.requesterEmail || "",
    "Purchase Required": t.purchaseRequired ? "Yes" : "No",
    "Estimated Cost (INR)": t.estimatedCost !== null && t.estimatedCost !== undefined ? t.estimatedCost : "N/A",
    "Assigned Worker": t.assignedWorkerName || "Unassigned",
    "Reported Date": formatDate(t.createdAt)
  }));

  const requisitionRows = requisitions.map((r, idx) => ({
    "No.": idx + 1,
    "Requisition ID": String(r._id),
    "Requested By": r.requestedBy ? `${r.requestedBy.name || ""} (${r.requestedBy.email || ""})` : "N/A",
    "Department": r.department || "",
    "Status": r.status || "",
    "Items Count": Array.isArray(r.items) ? r.items.length : 0,
    "Total Amount (INR)": r.billing?.totalAmount || 0,
    "Created Date": formatDate(r.createdAt)
  }));

  const facilityRows = utilities.map((ut, idx) => ({
    "No.": idx + 1,
    "Facility ID": String(ut._id),
    "Name": ut.name || "",
    "Category": ut.categoryName || "",
    "Capacity": ut.capacity || "N/A",
    "Location": ut.location || "N/A",
    "Active": ut.isActive !== false ? "Yes" : "No",
    "Created Date": formatDate(ut.createdAt)
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { "Metric": "Institution Name", "Value": org.name },
      { "Metric": "Organization ID", "Value": String(org._id) },
      { "Metric": "Status", "Value": org.isActive ? "Active" : "Inactive / Deactivated" },
      { "Metric": "Contact Email", "Value": org.contactEmail || "N/A" },
      { "Metric": "Contact Phone", "Value": org.contactPhone || "N/A" },
      { "Metric": "Total Faculty & Staff", "Value": users.length },
      { "Metric": "Total Facilities & Utilities", "Value": utilities.length },
      { "Metric": "Total Bookings Recorded", "Value": bookings.length },
      { "Metric": "Total Maintenance Tickets", "Value": maintenanceTickets.length },
      { "Metric": "Total Requisitions", "Value": requisitions.length },
      { "Metric": "Report Generated At", "Value": formatDate(new Date()) }
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userRows.length ? userRows : [{ "Status": "No users found" }]), "Users & Faculty");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookingRows.length ? bookingRows : [{ "Status": "No bookings found" }]), "Bookings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ticketRows.length ? ticketRows : [{ "Status": "No tickets found" }]), "Maintenance Tickets");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(requisitionRows.length ? requisitionRows : [{ "Status": "No requisitions found" }]), "Requisitions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facilityRows.length ? facilityRows : [{ "Status": "No facilities found" }]), "Facilities");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return {
      filename: `${sanitizedOrgName}_history_${dateStamp}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsxBuffer
    };
  }

  let csv = "\uFEFF";

  csv += "========================================================================================\n";
  csv += `ORGANIZATION HISTORY REPORT: ${org.name.toUpperCase()}\n`;
  csv += `Organization ID: ${org._id} | Status: ${org.isActive ? "ACTIVE" : "INACTIVE / DEACTIVATED"}\n`;
  csv += `Export Generated At: ${formatDate(new Date())}\n`;
  csv += `Summary: ${users.length} Users | ${bookings.length} Bookings | ${maintenanceTickets.length} Tickets | ${requisitions.length} Requisitions | ${utilities.length} Facilities\n`;
  csv += "========================================================================================\n\n";

  csv += "--- SECTION 1: FACULTY & STAFF DIRECTORY ---\n";
  if (userRows.length > 0) {
    const uHeaders = Object.keys(userRows[0]);
    csv += uHeaders.map(csvCell).join(",") + "\n";
    for (const r of userRows) {
      csv += uHeaders.map((k) => csvCell(r[k])).join(",") + "\n";
    }
  } else {
    csv += "No users or faculty recorded.\n";
  }
  csv += "\n";

  csv += "--- SECTION 2: FACILITY & UTILITY BOOKINGS HISTORY ---\n";
  if (bookingRows.length > 0) {
    const bHeaders = Object.keys(bookingRows[0]);
    csv += bHeaders.map(csvCell).join(",") + "\n";
    for (const r of bookingRows) {
      csv += bHeaders.map((k) => csvCell(r[k])).join(",") + "\n";
    }
  } else {
    csv += "No bookings recorded.\n";
  }
  csv += "\n";

  csv += "--- SECTION 3: MAINTENANCE TICKETS & ISSUES ---\n";
  if (ticketRows.length > 0) {
    const tHeaders = Object.keys(ticketRows[0]);
    csv += tHeaders.map(csvCell).join(",") + "\n";
    for (const r of ticketRows) {
      csv += tHeaders.map((k) => csvCell(r[k])).join(",") + "\n";
    }
  } else {
    csv += "No maintenance tickets recorded.\n";
  }
  csv += "\n";

  csv += "--- SECTION 4: REQUISITIONS & FINANCIAL ORDERS ---\n";
  if (requisitionRows.length > 0) {
    const reqHeaders = Object.keys(requisitionRows[0]);
    csv += reqHeaders.map(csvCell).join(",") + "\n";
    for (const r of requisitionRows) {
      csv += reqHeaders.map((k) => csvCell(r[k])).join(",") + "\n";
    }
  } else {
    csv += "No requisitions recorded.\n";
  }
  csv += "\n";

  csv += "--- SECTION 5: REGISTERED FACILITIES & UTILITIES ---\n";
  if (facilityRows.length > 0) {
    const fHeaders = Object.keys(facilityRows[0]);
    csv += fHeaders.map(csvCell).join(",") + "\n";
    for (const r of facilityRows) {
      csv += fHeaders.map((k) => csvCell(r[k])).join(",") + "\n";
    }
  } else {
    csv += "No facilities registered.\n";
  }
  csv += "\n";

  return {
    filename: `${sanitizedOrgName}_history_${dateStamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(csv, "utf-8")
  };
};
