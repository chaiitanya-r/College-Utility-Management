
const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString + "T00:00:00");
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch {
        return dateString;
    }
};

const emailWrapper = (title, content, footerText = "Thank you for using College Utility Management.") => {
    const rawFrontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const frontendUrl = rawFrontendUrl === "*" ? "http://localhost:5173" : rawFrontendUrl;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: #ffffff;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        .header {
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 20px;
            margin-bottom: 24px;
            text-align: center;
        }
        .header h1 {
            color: #123458;
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .content {
            margin: 20px 0;
            font-size: 14px;
            color: #334155;
        }
        .booking-details {
            background-color: #f8fafc;
            border-left: 4px solid #123458;
            padding: 18px;
            margin: 24px 0;
            border-radius: 8px;
            border-top: 1px solid #f1f5f9;
            border-right: 1px solid #f1f5f9;
            border-bottom: 1px solid #f1f5f9;
        }
        .detail-row {
            margin: 8px 0;
            display: flex;
        }
        .detail-label {
            font-weight: 700;
            min-width: 140px;
            color: #64748b;
        }
        .detail-value {
            color: #0f172a;
            font-weight: 500;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-pending { background-color: #fef3c7; color: #d97706; }
        .status-approved { background-color: #dbeafe; color: #1d4ed8; }
        .status-rejected { background-color: #fee2e2; color: #b91c1c; }
        .status-cancelled { background-color: #f1f5f9; color: #475569; }
        .status-confirmed { background-color: #dcfce7; color: #15803d; }
        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
        }
        .portal-box {
            text-align: center;
            margin: 28px 0 16px 0;
            padding: 20px;
            background-color: #f0f5fa;
            border-radius: 12px;
            border: 1px dashed #bcd0e4;
        }
        .portal-button {
            display: inline-block;
            padding: 12px 28px;
            background-color: #123458;
            color: #ffffff !important;
            font-weight: 700;
            font-size: 13px;
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(18, 52, 88, 0.15);
            transition: background-color 0.2s;
        }
        .remarks {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 18px 0;
            border-radius: 6px;
            font-style: italic;
            color: #78350f;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
        </div>
        <div class="content">
            ${content}
        </div>

        <!-- Portal Quick Access Box -->
        <div class="portal-box">
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569; font-weight: 600;">
                Need to view or manage this request? Go directly to your College Utility Management portal:
            </p>
            <a href="${frontendUrl}" target="_blank" class="portal-button">
                Open College Utility Management Portal ➜
            </a>
        </div>

        <div class="footer">
            <p>${footerText}</p>
            <p>This is an automated email sent from College Utility Management System. Please do not reply to this address.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
};

const bookingDetailsSection = (booking, organization = null) => {
    const statusClass = `status-${booking.status.replace("_", "-")}`;
    const statusLabel = booking.status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    let detailsHtml = `
        <div class="booking-details">
            <h3 style="margin-top: 0; color: #123458;">Booking Details</h3>
            <div class="detail-row">
                <span class="detail-label">Booking ID:</span>
                <span class="detail-value">${booking._id || booking.id || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Utility:</span>
                <span class="detail-value">${booking.utilityName || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${booking.categoryName || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formatDate(booking.date)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Time Slot:</span>
                <span class="detail-value">${booking.timeSlotLabel || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Purpose:</span>
                <span class="detail-value">${booking.purpose || "N/A"}</span>
            </div>
    `;

    if (booking.attendeesCount) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Attendees:</span>
                <span class="detail-value">${booking.attendeesCount}</span>
            </div>
        `;
    }

    if (organization) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${organization.name || "N/A"}</span>
            </div>
        `;
    }

    detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </span>
            </div>
        </div>
    `;

    return detailsHtml;
};

export const bookingCreatedTemplate = (booking, user, organization = null) => {
    const content = `
        <p>Dear ${user.name || user.email},</p>
        <p>Your booking has been successfully created and is pending approval.</p>
        ${bookingDetailsSection(booking, organization)}
        <p><strong>What happens next?</strong></p>
        <ul>
            <li>Your booking is now in the approval queue</li>
            <li>You will receive an email notification once your booking is reviewed</li>
            <li>Please wait for approval before using the facility</li>
        </ul>
        <p>If you have any questions or need to make changes, please contact the administrator.</p>
    `;

    return emailWrapper(
        "Booking Created Successfully",
        content,
        "We'll notify you once your booking is approved."
    );
};

export const bookingApprovedTemplate = (
    booking,
    user,
    approver,
    organization = null,
    options = {}
) => {
    const { isFullyConfirmed = booking?.status === "confirmed" } = options;
    const lastApproval = booking.approvals && booking.approvals.length > 0
        ? booking.approvals[booking.approvals.length - 1]
        : null;

    let remarksSection = "";
    if (lastApproval && lastApproval.remarks) {
        remarksSection = `
            <div class="remarks">
                <strong>Approver Remarks:</strong><br>
                ${lastApproval.remarks}
            </div>
        `;
    }

    const statusLine = isFullyConfirmed
        ? "<p><strong>Your booking is confirmed!</strong> You can proceed with using the facility as scheduled.</p>"
        : `<p>Your booking has moved to status: <strong>${booking.status}</strong>. Further approvals may still be required before it is confirmed.</p>`;

    const content = `
        <p>Dear ${user.name || user.email},</p>
        <p>Your booking request was <strong>approved</strong> by ${approver.name || approver.email || "an administrator"}.</p>
        ${bookingDetailsSection(booking, organization)}
        ${remarksSection}
        ${statusLine}
        <p>Please ensure you arrive on time and follow all facility guidelines.</p>
    `;

    return emailWrapper(
        isFullyConfirmed ? "Booking Confirmed" : "Booking Approval Update",
        content,
        "We look forward to serving you!"
    );
};

export const bookingRejectedTemplate = (booking, user, approver, organization = null) => {
    const lastApproval = booking.approvals && booking.approvals.length > 0
        ? booking.approvals[booking.approvals.length - 1]
        : null;

    let remarksSection = "";
    if (lastApproval && lastApproval.remarks) {
        remarksSection = `
            <div class="remarks">
                <strong>Rejection Reason:</strong><br>
                ${lastApproval.remarks}
            </div>
        `;
    }

    const content = `
        <p>Dear ${user.name || user.email},</p>
        <p>We regret to inform you that your booking has been <strong>rejected</strong> by ${approver.name || approver.email || "an administrator"}.</p>
        ${bookingDetailsSection(booking, organization)}
        ${remarksSection}
        <p>If you believe this is an error or would like to discuss alternative options, please contact the administrator.</p>
        <p>You can create a new booking request at any time.</p>
    `;

    return emailWrapper(
        "Booking Rejected",
        content,
        "We're sorry for any inconvenience."
    );
};

export const bookingCancelledTemplate = (booking, user, cancelledBy, organization = null) => {
    const cancelledByText = cancelledBy && cancelledBy.sub !== booking.requesterId
        ? ` by ${cancelledBy.name || cancelledBy.email || "an administrator"}`
        : "";

    const content = `
        <p>Dear ${user.name || user.email},</p>
        <p>Your booking has been <strong>cancelled</strong>${cancelledByText}.</p>
        ${bookingDetailsSection(booking, organization)}
        <p>If this cancellation was not initiated by you and you believe it's an error, please contact the administrator immediately.</p>
        <p>You can create a new booking request at any time.</p>
    `;

    return emailWrapper(
        "Booking Cancelled",
        content,
        "We hope to serve you in the future."
    );
};

export const bookingModifiedTemplate = (booking, user, modifier, changes, organization = null) => {
    let changesSection = "";
    if (changes && Object.keys(changes).length > 0) {
        changesSection = `
            <div class="booking-details" style="background-color: #e3f2fd; border-left-color: #2196F3;">
                <h3 style="margin-top: 0; color: #2196F3;">Changes Made</h3>
        `;

        for (const [field, value] of Object.entries(changes)) {
            const fieldLabel = field
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
            changesSection += `
                <div class="detail-row">
                    <span class="detail-label">${fieldLabel}:</span>
                    <span class="detail-value">${value}</span>
                </div>
            `;
        }

        changesSection += `</div>`;
    }

    const content = `
        <p>Dear ${user.name || user.email},</p>
        <p>Your booking has been <strong>modified</strong> by ${modifier.name || modifier.email || "an administrator"}.</p>
        ${bookingDetailsSection(booking, organization)}
        ${changesSection}
        <p>Please review the updated details above. If you have any questions or concerns about these changes, please contact the administrator.</p>
    `;

    return emailWrapper(
        "Booking Modified",
        content,
        "Please review the updated booking details."
    );
};

export const passwordResetOTPTemplate = (otp, userName) => {
    const content = `
        <p>Dear ${userName || "User"},</p>
        <p>You have requested to reset your password. Please use the following One-Time Password (OTP) to verify your identity:</p>
        <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f0f0f0; border: 2px solid #123458; border-radius: 8px; padding: 20px 40px;">
                <h2 style="margin: 0; color: #123458; font-size: 32px; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</h2>
            </div>
        </div>
        <p><strong>Important Security Information:</strong></p>
        <ul>
            <li>This OTP is valid for 10 minutes only</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you did not request this password reset, please ignore this email</li>
            <li>You have a maximum of 5 attempts to enter the correct OTP</li>
        </ul>
        <p>If you did not request a password reset, please contact your administrator immediately.</p>
    `;

    return emailWrapper(
        "Password Reset OTP",
        content,
        "This OTP will expire in 10 minutes. If you didn't request this, please ignore this email."
    );
};

const requisitionDetailsSection = (requisition, organization = null) => {
    const statusClass = `status-${(requisition.status || "pending").toLowerCase()}`;
    const statusLabel = (requisition.status || "PENDING_HOD")
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    const totalAmount = requisition.billing?.totalAmount ?? null;
    const estimatedCost = requisition.estimatedCost ?? null;

    let detailsHtml = `
        <div class="booking-details">
            <h3 style="margin-top: 0; color: #123458;">Canteen Requisition Details</h3>
            <div class="detail-row">
                <span class="detail-label">Requisition ID:</span>
                <span class="detail-value">${requisition._id || requisition.id || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${requisition.department || requisition.requesterDepartment || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Requester:</span>
                <span class="detail-value">${requisition.requesterName || requisition.requesterEmail || "N/A"}</span>
            </div>
    `;

    if (organization) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Institute:</span>
                <span class="detail-value">${organization.name || "College Utility Management"}</span>
            </div>
        `;
    } else {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Institute:</span>
                <span class="detail-value">College Utility Management</span>
            </div>
        `;
    }

    if (requisition.submittedAt || requisition.createdAt) {
        const date = requisition.submittedAt || requisition.createdAt;
        const d = new Date(date);
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Submitted On:</span>
                <span class="detail-value">${d.toLocaleString()}</span>
            </div>
        `;
    }

    if (typeof totalAmount === "number") {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Billing Amount:</span>
                <span class="detail-value">₹${totalAmount.toFixed(2)} ${requisition.billing?.currency || "INR"}</span>
            </div>
        `;
    }

    if (typeof estimatedCost === "number" && !Number.isNaN(estimatedCost)) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Estimated Purchase Cost:</span>
                <span class="detail-value">₹${Number(estimatedCost).toFixed(2)} INR</span>
            </div>
        `;
    }

    detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </span>
            </div>
        </div>
    `;

    return detailsHtml;
};

export const canteenRequisitionCreatedTemplate = (requisition, requester, organization = null) => {
    const orgName = organization?.name || "College Utility Management";
    const content = `
        <p>Dear ${requester.name || requester.email},</p>
        <p>Your canteen requisition has been successfully submitted to <strong>${orgName}</strong> and is now pending approval from your Head of Department.</p>
        ${requisitionDetailsSection(requisition, organization)}
        <p><strong>Next steps:</strong></p>
        <ul>
            <li>The requisition will move through HOD, Registrar, and Director approvals.</li>
            <li>You will receive email updates whenever the status of this requisition changes.</li>
            <li>Once the canteen prepares and hands over the order, you will receive a final confirmation.</li>
        </ul>
        <p>If you have any questions about this requisition, please coordinate with your department or the canteen team.</p>
    `;

    return emailWrapper(
        "Canteen Requisition Submitted",
        content,
        `${orgName} • College Utility Management`
    );
};

const maintenanceDetailsSection = (ticket, organization = null) => {
    const statusClass = `status-${(ticket.status || "pending").toLowerCase()}`;
    const statusLabel = (ticket.status || "PENDING_HOD")
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    let detailsHtml = `
        <div class="booking-details" style="border-left-color: #f59e0b;">
            <h3 style="margin-top: 0; color: #123458;">Maintenance Ticket Details</h3>
            <div class="detail-row">
                <span class="detail-label">Ticket ID:</span>
                <span class="detail-value">${ticket._id || ticket.id || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Issue/Title:</span>
                <span class="detail-value" style="font-weight: bold; color: #0f172a;">${ticket.problemTitle || ticket.title || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${ticket.description || "N/A"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${ticket.location || "N/A"}</span>
            </div>
    `;

    if (ticket.priority) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value" style="text-transform: uppercase; font-weight: bold; color: ${ticket.priority === 'high' ? '#dc2626' : '#d97706'}">${ticket.priority}</span>
            </div>
        `;
    }

    if (ticket.workerName) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Assigned Worker:</span>
                <span class="detail-value">${ticket.workerName}</span>
            </div>
        `;
    }

    if (ticket.estimatedCost) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Estimated Cost:</span>
                <span class="detail-value">₹${Number(ticket.estimatedCost).toFixed(2)} INR</span>
            </div>
        `;
    }

    detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </span>
            </div>
        </div>
    `;

    return detailsHtml;
};

export const canteenRequisitionStatusTemplate = (
    requisition,
    recipient,
    actor,
    {
        heading,
        introLine,
        highlightLine
    },
    organization = null
) => {
    const actorName = actor?.name || actor?.email || "System";
    const isMaintenance = !!(requisition.problemTitle || requisition.location);
    const detailsSection = isMaintenance
        ? maintenanceDetailsSection(requisition, organization)
        : requisitionDetailsSection(requisition, organization);

    const content = `
        <p>Dear ${recipient.name || recipient.email},</p>
        <p>${introLine}</p>
        <p><strong>${highlightLine}</strong></p>
        <p>This update was recorded by <strong>${actorName}</strong>.</p>
        ${detailsSection}
        <p>If you believe there is any discrepancy, please contact the coordinator or the administrator at <strong>${organization?.name || "College Utility Management"}</strong>.</p>
    `;

    return emailWrapper(
        heading,
        content,
        `${organization?.name || "College Utility Management"} • Campus ERP`
    );
};

export const canteenRequisitionFulfilmentTemplate = (
    requisition,
    recipient,
    stage,
    organization = null,
    opts = {}
) => {
    const isPrepared = stage === "prepared";
    const orgName = organization?.name || "College Utility Management";
    const title = isPrepared
        ? `${orgName} | Canteen Requisition Prepared`
        : `${orgName} | Canteen Requisition Delivered`;

    const leadLine = isPrepared
        ? "Your canteen requisition has been prepared by the canteen team."
        : "Your canteen requisition has been delivered / handed over.";

    let nextLine = isPrepared
        ? "Please ensure timely collection as per the canteen process."
        : "Please verify the items received and retain this email for your records.";

    let handoverSection = "";
    if (!isPrepared && (opts.peonName || opts.peonPhone)) {
        handoverSection = `
        <div class="booking-details" style="background-color: #f0f4f8; border-left-color: #123458;">
            <h3 style="margin-top: 0; color: #123458;">Delivery Details</h3>
            <div class="detail-row">
                <span class="detail-label">Received by:</span>
                <span class="detail-value">${opts.peonName || "—"}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Contact (mobile):</span>
                <span class="detail-value">${opts.peonPhone || "—"}</span>
            </div>
        </div>`;
    }

    const content = `
        <p>Dear ${recipient.name || recipient.email},</p>
        <p>${leadLine}</p>
        <p>${nextLine}</p>
        ${handoverSection}
        ${requisitionDetailsSection(requisition, organization)}
        <p>Thank you for using the campus canteen services.</p>
    `;

    return emailWrapper(
        title,
        content,
        `${orgName} • College Utility Management`
    );
};

export const canteenOwnerOrderTemplate = (
    requisition,
    stage,
    organization = null,
    opts = {}
) => {
    const isReady = stage === "ready";
    const isDelivered = stage === "delivered";
    const orgName = organization?.name || "College Utility Management";

    const title = isReady
        ? `${orgName} | New Order Ready for Preparation`
        : `${orgName} | Order Delivered`;
    const leadLine = isReady
        ? "A new canteen requisition has been fully approved and is ready for preparation."
        : "A canteen requisition has been handed over / delivered to the department.";
    const nextLine = isReady
        ? "Please log in to College Utility Management to prepare and fulfill this order."
        : "Order received by: " + (opts.peonName || "—") + (opts.peonPhone ? ` (${opts.peonPhone})` : "");

    const content = `
        <p>Dear Canteen Team,</p>
        <p>${leadLine}</p>
        <p>${nextLine}</p>
        ${requisitionDetailsSection(requisition, organization)}
        <p>— <strong>${orgName}</strong></p>
    `;

    return emailWrapper(
        title,
        content,
        `${orgName} • College Utility Management`
    );
};

