import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage, isRateLimitError, ChatApi } from "../lib/api";
import { getAuthUser, isAuthenticated } from "../lib/auth";
import { hasPermission, PERMISSIONS } from "../rbac/permissions";
import ChatMessageContent from "./chat/ChatMessageContent";
import {
  UtilityBookingApi,
  BookingApi,
  RequisitionApi,
  CanteenMenuApi,
  MaintenanceApi
} from "../lib/api";
import { MessageSquare, X } from "lucide-react";

const SESSION_KEY = "erp-chatbot-messages-offline";

const FAQS = [
  {
    q: "How do I book a facility or hall?",
    a: "Select **Facility Booking** from the main menu, choose a category (e.g. Halls, Labs, Vehicles), select the specific item, and follow the guided steps to select the date, time slot, and purpose."
  },
  {
    q: "Who can order food from the canteen?",
    a: "Only **Assistants**, **HODs**, and **Admin** roles have permission to place canteen requisitions. Regular faculty must request bookings or requisitions via their department assistant."
  },
  {
    q: "How do I raise a maintenance ticket?",
    a: "Select **Maintenance Tickets** and click **Raise Ticket**. Provide the department, select priority (Minor/Major), enter a title and description of the problem, then submit."
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes, you can cancel your bookings. Go to **Facility Booking** in this chatbot and select **Show My Bookings** to view active bookings and cancel them directly."
  },
  {
    q: "How long does canteen preparation take?",
    a: "Once approved by the HOD and Director, canteen items are typically prepared within 30 to 45 minutes and delivered to your designated department by a peon."
  }
];

function getOrgIdFromPath(pathname) {
  const match = pathname.match(/\/org\/([^/]+)/);
  return match?.[1] || "";
}

function loadStoredMessages(orgId, userId) {
  if (!userId) return [];
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY}:${userId}:${orgId || "global"}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(orgId, userId, messages) {
  if (!userId) return;
  try {
    sessionStorage.setItem(
      `${SESSION_KEY}:${userId}:${orgId || "global"}`,
      JSON.stringify(messages.slice(-20))
    );
  } catch {
    /* ignore quota errors */
  }
}

export default function ChatbotWidget() {
  const authUser = getAuthUser();
  const userId = authUser?.id || authUser?.email || "";
  const orgIdFromPath = getOrgIdFromPath(window.location.pathname);
  const orgId = orgIdFromPath || authUser?.organizationId || "";
  const role = authUser?.role;
  const canUseChat = hasPermission(role, PERMISSIONS.CHAT_USE);

  const [messages, setMessages] = useState(() => {
    const stored = loadStoredMessages(orgId, userId);
    if (stored.length > 0) return stored;
    return [
      {
        role: "assistant",
        content: "Hello! I am your **Assistant**. How can I help you today? Select one of the quick options below or type a query."
      }
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [moveLeft, setMoveLeft] = useState(false);

  const [menuStack, setMenuStack] = useState([]);
  const [currentMenu, setCurrentMenu] = useState("main");
  const [wizardState, setWizardState] = useState({
    type: null, // 'facility' | 'canteen' | 'maintenance'
    step: 0,
    data: {}
  });

  const [categories, setCategories] = useState([]);
  const [utilities, setUtilities] = useState([]);
  const [canteenMenu, setCanteenMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [departments, setDepartments] = useState([]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lastSendAtRef = useRef(0);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const [chatbotLockedBooking, setChatbotLockedBooking] = useState(null);
  const [chatbotTimeLeft, setChatbotTimeLeft] = useState(0);
  const chatbotLockedBookingRef = useRef(null);

  useEffect(() => {
    chatbotLockedBookingRef.current = chatbotLockedBooking;
  }, [chatbotLockedBooking]);

  const formatTimeLeft = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (chatbotLockedBookingRef.current && orgId) {
        const bid = chatbotLockedBookingRef.current.id || chatbotLockedBookingRef.current._id;
        BookingApi.release(orgId, bid).catch(() => {});
      }
    };
  }, [orgId]);

  useEffect(() => {
    if (!chatbotLockedBooking) {
      setChatbotTimeLeft(0);
      return;
    }

    const expiresTime = new Date(chatbotLockedBooking.lockExpiresAt).getTime();

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
      setChatbotTimeLeft(diff);

      if (diff <= 0) {
        handleChatbotLockExpire();
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [chatbotLockedBooking]);

  const handleChatbotLockExpire = async () => {
    if (chatbotLockedBookingRef.current && orgId) {
      try {
        const bid = chatbotLockedBookingRef.current.id || chatbotLockedBookingRef.current._id;
        await BookingApi.release(orgId, bid);
      } catch (err) {
        console.error("Error releasing chatbot expired lock", err);
      }
    }
    setChatbotLockedBooking(null);
    setChatbotTimeLeft(0);
    setWizardState(prev => ({
      ...prev,
      step: 4,
      data: {
        ...prev.data,
        timeSlotId: undefined,
        timeSlotLabel: undefined
      }
    }));
    addAssistantMessage("Slot lock expired! The temporary 5-minute hold on your selected slot has ended. Please choose a slot again.");
  };

  const handleChatbotLockSlot = async (slotId, slotLabel) => {
    setLoading(true);
    setErrorText("");
    const { utilityId, date } = wizardState.data;
    try {
      const res = await BookingApi.lock(orgId, {
        utilityId,
        date,
        timeSlotId: slotId
      });
      setChatbotLockedBooking(res.data);
      setWizardState(prev => ({
        ...prev,
        step: 5,
        data: {
          ...prev.data,
          timeSlotId: slotId,
          timeSlotLabel: slotLabel
        }
      }));
    } catch (err) {
      setErrorText(getApiErrorMessage(err, "Failed to lock slot. It may have been taken or already locked."));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChatbotWizard = async () => {
    if (chatbotLockedBooking) {
      const bid = chatbotLockedBooking.id || chatbotLockedBooking._id;
      try {
        await BookingApi.release(orgId, bid);
      } catch (err) {
        console.error("Error releasing lock on cancel", err);
      }
      setChatbotLockedBooking(null);
      setChatbotTimeLeft(0);
    }
    setWizardState({ type: null, step: 0, data: {} });
  };

  useEffect(() => {
    const syncAuth = () => setAuthenticated(isAuthenticated());
    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-changed", syncAuth);
    };
  }, []);

  useEffect(() => {
    const checkAttr = () => {
      const isOpen = document.body.getAttribute("data-ticket-chat-open") === "true";
      setMoveLeft(isOpen);
    };

    checkAttr();

    const observer = new MutationObserver(checkAttr);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ticket-chat-open"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (userId) {
      saveStoredMessages(orgId, userId, messages);
    }
  }, [messages, orgId, userId]);

  useEffect(() => {
    if (!userId) {
      sessionStorage.removeItem("erp-chatbot-active-user");
      return;
    }
    const sessionUser = sessionStorage.getItem("erp-chatbot-active-user");
    if (sessionUser !== userId) {
      sessionStorage.removeItem(`${SESSION_KEY}:${userId}:${orgId || "global"}`);
      sessionStorage.setItem("erp-chatbot-active-user", userId);
      setMessages([
        {
          role: "assistant",
          content: "Hello! I am your **Assistant**. How can I help you today? Select one of the quick options below or type a query."
        }
      ]);
    } else {
      setMessages(loadStoredMessages(orgId, userId));
    }
  }, [userId, orgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, wizardState]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const fetchCategories = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await UtilityBookingApi.listCategories(orgId);
      setCategories((res.data || []).filter(c => c.isActive !== false));
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUtilitiesForCategory = async (categoryId) => {
    if (!orgId || !categoryId) return;
    setLoading(true);
    try {
      const res = await UtilityBookingApi.listUtilities(orgId, categoryId);
      setUtilities((res.data || []).filter(u => u.isActive !== false));
    } catch (err) {
      console.error("Failed to load utilities:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCanteenMenu = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await CanteenMenuApi.list(orgId);
      setCanteenMenu((res.data || []).filter(item => item.isActive !== false));
    } catch (err) {
      console.error("Failed to load menu:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!orgId) return;
    try {
      const res = await RequisitionApi.listDepartments(orgId);
      if (res.data && res.data.length > 0) {
        setDepartments(res.data);
      }
    } catch {
      setDepartments([]);
    }
  };

  const navigateToMenu = (menuName) => {
    if (chatbotLockedBooking) {
      const bid = chatbotLockedBooking.id || chatbotLockedBooking._id;
      BookingApi.release(orgId, bid).catch(() => {});
      setChatbotLockedBooking(null);
      setChatbotTimeLeft(0);
    }
    setErrorText("");
    setMenuStack((prev) => [...prev, currentMenu]);
    setCurrentMenu(menuName);
    setWizardState({ type: null, step: 0, data: {} });
    setCart({});

    if (menuName === "facility") {
      fetchCategories();
    } else if (menuName === "canteen") {
      fetchCanteenMenu();
      fetchDepartments();
    }
  };

  const handleBack = () => {
    setErrorText("");
    if (wizardState.type) {
      if (wizardState.step > 1) {
        if (wizardState.type === "facility" && wizardState.step === 5 && chatbotLockedBooking) {
          const bid = chatbotLockedBooking.id || chatbotLockedBooking._id;
          BookingApi.release(orgId, bid).catch(() => {});
          setChatbotLockedBooking(null);
          setChatbotTimeLeft(0);
          setWizardState(prev => ({
            ...prev,
            step: 4,
            data: { ...prev.data, timeSlotId: undefined, timeSlotLabel: undefined }
          }));
          return;
        }
        setWizardState((prev) => ({ ...prev, step: prev.step - 1 }));
      } else {
        setWizardState({ type: null, step: 0, data: {} });
      }
    } else if (menuStack.length > 0) {
      const prevMenu = menuStack[menuStack.length - 1];
      setMenuStack((prev) => prev.slice(0, -1));
      setCurrentMenu(prevMenu);
    }
  };

  const addAssistantMessage = (content) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const addUserMessage = (content) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
  };

  const handleShowAllFacilities = async () => {
    setLoading(true);
    try {
      const res = await UtilityBookingApi.listUtilities(orgId);
      const list = (res.data || []).filter(u => u.isActive !== false);
      if (list.length === 0) {
        addAssistantMessage("No active bookable facilities found.");
      } else {
        const lines = list.map(f => `- **${f.name}** (${f.categoryName || "facility"}) — ${f.description || "available for booking"}`);
        addAssistantMessage(`**Available Facilities:**\n\n${lines.join("\n")}`);
      }
    } catch (err) {
      addAssistantMessage(`Error loading facilities: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowCanteenMenu = async () => {
    setLoading(true);
    try {
      const res = await CanteenMenuApi.list(orgId);
      const list = (res.data || []).filter(item => item.isActive !== false);
      if (list.length === 0) {
        addAssistantMessage("The canteen menu is currently empty.");
      } else {
        const lines = list.map(item => `- **${item.name}** (${item.type}) — ₹${item.price ?? 0} per ${item.unit || "pcs"}`);
        addAssistantMessage(`**Canteen Menu:**\n\n${lines.join("\n")}`);
      }
    } catch (err) {
      addAssistantMessage(`Error loading canteen menu: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleListMyOrders = async () => {
    setLoading(true);
    try {
      const res = await RequisitionApi.list(orgId);
      const list = (res.data || []).filter(r => r.requesterEmail === authUser.email);
      if (list.length === 0) {
        addAssistantMessage("You have not placed any canteen orders yet.");
      } else {
        const lines = list.slice(0, 5).map(r => {
          const itemsStr = r.items.map(i => `${i.name} x${i.quantity}`).join(", ");
          return `- **Order ID ${r._id.slice(-6)}**: ${itemsStr} — **Status**: \`${r.status}\` (Total: ₹${r.billing?.totalAmount || 0})`;
        });
        addAssistantMessage(`**Your Recent Orders:**\n\n${lines.join("\n")}`);
      }
    } catch (err) {
      addAssistantMessage(`Error loading orders: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleListMyBookings = async () => {
    setLoading(true);
    try {
      const res = await UtilityBookingApi.listBookings(orgId);
      const list = (res.data || []).filter(b => b.requesterEmail === authUser.email && b.status !== "cancelled" && b.status !== "rejected");

      if (list.length === 0) {
        addAssistantMessage("You have no active bookings.");
      } else {
        const lines = list.slice(0, 5).map(b =>
          `- **${b.utilityName}** (${b.categoryName}) on **${b.date}** (${b.timeSlotLabel}) — **Status**: \`${b.status}\` (ID: \`${b.id}\`)`
        );
        addAssistantMessage(`**Active Bookings:**\n\n${lines.join("\n")}`);
      }
    } catch (err) {
      addAssistantMessage(`Error loading bookings: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const showFacilityMenu = hasPermission(role, PERMISSIONS.UTILITY_VIEW) || hasPermission(role, PERMISSIONS.UTILITY_BOOK);
  const showCanteenMenu = hasPermission(role, PERMISSIONS.CANTEEN_VIEW);
  const showMaintenanceMenu = hasPermission(role, PERMISSIONS.MAINTENANCE_VIEW) || hasPermission(role, PERMISSIONS.MAINTENANCE_CREATE);

  const handleQuickReplyClick = async (text) => {
    setErrorText("");
    addUserMessage(text);
    setLoading(true);
    try {
      await sendToBackendChat(text);
    } catch (err) {
      addAssistantMessage("Something went wrong processing your request.");
    } finally {
      setLoading(false);
    }
  };

  const startFacilityWizard = async () => {
    if (!hasPermission(role, PERMISSIONS.UTILITY_BOOK)) {
      setErrorText("Your role does not have permission to book facilities.");
      return;
    }
    await fetchCategories();
    setWizardState({
      type: "facility",
      step: 1,
      data: {}
    });
  };

  const startCanteenOrderWizard = async () => {
    if (!hasPermission(role, PERMISSIONS.CANTEEN_ORDER_CREATE)) {
      setErrorText("Your role does not have permission to place canteen orders.");
      return;
    }
    await fetchCanteenMenu();
    await fetchDepartments();
    setCart({});
    setWizardState({
      type: "canteen",
      step: 1,
      data: {}
    });
  };

  const startMaintenanceWizard = () => {
    if (!hasPermission(role, PERMISSIONS.MAINTENANCE_CREATE)) {
      setErrorText("Your role does not have permission to raise maintenance tickets.");
      return;
    }
    setWizardState({
      type: "maintenance",
      step: 1,
      data: {
        priority: "minor",
        department: authUser?.department || "Administration"
      }
    });
  };

  const submitFacilityBooking = async () => {
    setLoading(true);
    setErrorText("");
    const { purpose } = wizardState.data;
    if (!chatbotLockedBooking) {
      setErrorText("No active slot lock found. Please try again.");
      setLoading(false);
      return;
    }
    const bid = chatbotLockedBooking.id || chatbotLockedBooking._id;
    try {
      const res = await BookingApi.confirm(orgId, {
        bookingId: bid,
        purpose: purpose.trim()
      });
      addAssistantMessage(`**Facility/Hall booked successfully!**\n\nBooking ID: \`${res.data?._id || res.data?.id || "Done"}\`\nStatus: \`${res.data?.status || "Submitted"}\``);
      setChatbotLockedBooking(null);
      setChatbotTimeLeft(0);
      setWizardState({ type: null, step: 0, data: {} });
    } catch (err) {
      setErrorText(getApiErrorMessage(err, "Booking confirmation failed. Your lock may have expired."));
    } finally {
      setLoading(false);
    }
  };

  const submitCanteenOrder = async () => {
    setLoading(true);
    setErrorText("");
    const { department, reasoning } = wizardState.data;
    const items = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        menuItemId: itemId,
        quantity: qty
      }));

    try {
      const res = await RequisitionApi.create(orgId, {
        items,
        department,
        reasoning
      });
      addAssistantMessage(`**Canteen requisition placed!**\n\nRequisition ID: \`${res.data?._id || "Done"}\`\nDepartment: \`${department}\`\nStatus: \`PENDING_HOD\``);
      setWizardState({ type: null, step: 0, data: {} });
      setCart({});
    } catch (err) {
      setErrorText(getApiErrorMessage(err, "Failed to place canteen order."));
    } finally {
      setLoading(false);
    }
  };

  const submitMaintenanceTicket = async () => {
    setLoading(true);
    setErrorText("");
    const { department, priority, title, description } = wizardState.data;
    try {
      const res = await MaintenanceApi.create(orgId, {
        department,
        issueCategory: priority,
        problemTitle: title,
        actualProblem: description,
        itemsToRepair: []
      });
      addAssistantMessage(`**Maintenance ticket submitted!**\n\nTicket ID: \`${res.data?._id || "Done"}\`\nTitle: \`${title}\`\nPriority: \`${priority.toUpperCase()}\``);
      setWizardState({ type: null, step: 0, data: {} });
    } catch (err) {
      setErrorText(getApiErrorMessage(err, "Failed to submit ticket."));
    } finally {
      setLoading(false);
    }
  };

  const sendToBackendChat = async (userText) => {
    try {
      const recentHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      }));
      recentHistory.push({ role: "user", content: userText });

      const res = await ChatApi.send({
        messages: recentHistory,
        orgId: orgId || undefined
      });

      const reply = res.data?.reply || res.reply;
      const meta = res.data?.meta || res.meta || {};

      if (Array.isArray(meta.toolsUsed) && meta.toolsUsed.length > 0) {
        const tools = meta.toolsUsed;
        if (tools.some(t => ["lockUtilitySlot", "confirmUtilityBooking", "cancelUtilityBooking", "updateUtilityBookingStatus", "releaseLock"].includes(t))) {
          window.dispatchEvent(new Event("booking-changed"));
        }
        if (tools.some(t => ["raiseMaintenanceTicket", "actOnMaintenanceTicket"].includes(t))) {
          window.dispatchEvent(new Event("maintenance-changed"));
        }
      }

      if (reply) {
        addAssistantMessage(reply);
      } else {
        addAssistantMessage("No response from assistant. Please try again.");
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        addAssistantMessage("You're sending messages too fast. Please wait a moment.");
      } else {
        addAssistantMessage(`${getApiErrorMessage(err, "Something went wrong. Please try again.")}`);
      }
    }
  };

  const handleSendTextQuery = async () => {
    setErrorText("");
    const text = input.trim();
    if (!text || loading) return;

    addUserMessage(text);
    setInput("");

    const now = Date.now();
    if (now - lastSendAtRef.current < 800) {
      setErrorText("Please wait a moment.");
      return;
    }
    lastSendAtRef.current = now;

    if (!authenticated) {
      addAssistantMessage("Please log in to your College Utility Management account to interact with the assistant.");
      return;
    }

    if (!canUseChat) {
      addAssistantMessage("Your role does not have authorization to access the ERP assistant.");
      return;
    }

    setLoading(true);

    const lower = text.toLowerCase();

    try {
      if (/^(menu|main\s*menu|options)\s*$/i.test(lower)) {
        addAssistantMessage("Here is the main menu. Select an option to proceed.");
        setCurrentMenu("main");
        setMenuStack([]);
        setWizardState({ type: null, step: 0, data: {} });
      } else if (lower === "back") {
        handleBack();
      } else if (/^(cancel|abort|stop|nevermind|never\s*mind|quit|exit|forget\s*it|no\s*thanks|nope)\s*$/i.test(lower)) {
        if (wizardState.type) {
          await handleCancelChatbotWizard();
        }
        await sendToBackendChat(text);
      } else if (/^(faq|questions)\s*$/i.test(lower) || lower === "how does" || lower === "who can") {
        navigateToMenu("faq");
      } else {
        await sendToBackendChat(text);
      }
    } catch (err) {
      addAssistantMessage("Something went wrong processing your request.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendTextQuery();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clearChat = () => {
    if (chatbotLockedBooking) {
      const bid = chatbotLockedBooking.id || chatbotLockedBooking._id;
      BookingApi.release(orgId, bid).catch(() => {});
      setChatbotLockedBooking(null);
      setChatbotTimeLeft(0);
    }
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared! How can I help you now?"
      }
    ]);
    setMenuStack([]);
    setCurrentMenu("main");
    setWizardState({ type: null, step: 0, data: {} });
    setCart({});
  };

  if (!authenticated || !canUseChat) {
    return null;
  }

  const selectedUtility = utilities.find(u => u.id === wizardState.data.utilityId);

  const chatbotPositionStyle = moveLeft
    ? {
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 1000,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }
    : {
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      };

  const dialogPositionStyle = moveLeft
    ? {
        position: "absolute",
        bottom: 68,
        left: 0,
        width: "min(390px, calc(100vw - 24px))",
        background: "white",
        borderRadius: 16,
        border: "1px solid #e8e5ff",
        boxShadow: "0 12px 40px rgba(83,74,183,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }
    : {
        position: "absolute",
        bottom: 68,
        right: 0,
        width: "min(390px, calc(100vw - 24px))",
        background: "white",
        borderRadius: 16,
        border: "1px solid #e8e5ff",
        boxShadow: "0 12px 40px rgba(83,74,183,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      };

  const buttonStyle = moveLeft
    ? {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: open ? "#3d3499" : "#534AB7",
        color: "white",
        border: "none",
        fontSize: 22,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(83,74,183,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginRight: "auto"
      }
    : {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: open ? "#3d3499" : "#534AB7",
        color: "white",
        border: "none",
        fontSize: 22,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(83,74,183,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "auto"
      };

  return (
    <div style={chatbotPositionStyle}>
      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          aria-modal="false"
          style={dialogPositionStyle}
        >
          <div
            style={{
              padding: "14px 18px",
              background: "linear-gradient(135deg, #534AB7, #6c63d4)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(menuStack.length > 0 || wizardState.type) && (
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      border: "none",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    ← Back
                  </button>
                )}
                <h3 style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>
                  Assistant
                </h3>
              </div>
              <button
                type="button"
                onClick={clearChat}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  fontSize: 11,
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                Clear
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, margin: 0 }}>
                Assistant
                {currentMenu !== "main" && ` > ${currentMenu === "facility" ? "Facility" : currentMenu.charAt(0).toUpperCase() + currentMenu.slice(1)}`}
                {wizardState.type && ` > Wizard (Step ${wizardState.step})`}
              </p>
            </div>
          </div>

          <div
            style={{
              height: 380,
              overflowY: "auto",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#faf9ff"
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: msg.role === "user" ? "78%" : "90%",
                  background: msg.role === "user" ? "#534AB7" : "white",
                  color: msg.role === "user" ? "white" : "#1a1a2e",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  fontSize: 13,
                  lineHeight: 1.45,
                  border: msg.role === "user" ? "none" : "1px solid #ede9ff",
                  boxShadow: msg.role === "user" ? "none" : "0 2px 8px rgba(0,0,0,0.02)"
                }}
              >
                <ChatMessageContent content={msg.content} />
              </div>
            ))}

            {wizardState.type && (
              <div
                style={{
                  background: "white",
                  border: "1.5px solid #d4d0f7",
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 8,
                  boxShadow: "0 4px 16px rgba(83,74,183,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ede9ff", paddingBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#534AB7" }}>
                    {wizardState.type === "facility" && "Facility/Hall Booking"}
                    {wizardState.type === "canteen" && "Canteen Ordering"}
                    {wizardState.type === "maintenance" && "Maintenance Request"}
                  </span>
                  <span style={{ fontSize: 11, color: "#888" }}>
                    Step {wizardState.step}
                  </span>
                </div>

                {chatbotLockedBooking && (
                  <div style={{
                    background: "#fff9eb",
                    border: "1px solid #ffe8cc",
                    borderRadius: 8,
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#b0720f",
                    marginTop: 4
                  }}>
                    <span>Holding slot...</span>
                    <span style={{
                      fontFamily: "monospace",
                      background: chatbotTimeLeft < 60 ? "#ff4d4d" : "#e69500",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 11
                    }}>
                      {formatTimeLeft(chatbotTimeLeft)}
                    </span>
                  </div>
                )}

                {wizardState.type === "facility" && (
                  <div>
                    {wizardState.step === 1 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Select Category:</p>
                        {loading ? (
                          <div style={{ fontSize: 12, color: "#666" }}>Loading categories...</div>
                        ) : categories.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#999" }}>No active categories available.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {categories.map((cat) => (
                              <button
                                key={cat._id}
                                type="button"
                                onClick={() => {
                                  setWizardState(prev => ({ ...prev, step: 2, data: { ...prev.data, categoryId: cat._id, categoryName: cat.name } }));
                                  fetchUtilitiesForCategory(cat._id);
                                }}
                                style={{
                                  padding: "8px 10px",
                                  border: "1px solid #ddd7ff",
                                  borderRadius: 8,
                                  background: "#f9f8ff",
                                  textAlign: "left",
                                  fontSize: 12,
                                  color: "#3b3680",
                                  cursor: "pointer",
                                  fontWeight: 500
                                }}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 2 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Select Item to Book ({wizardState.data.categoryName}):</p>
                        {loading ? (
                          <div style={{ fontSize: 12, color: "#666" }}>Loading items...</div>
                        ) : utilities.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#999" }}>No active items found in this category.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                            {utilities.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setWizardState(prev => ({ ...prev, step: 3, data: { ...prev.data, utilityId: u.id, utilityName: u.name } }))}
                                style={{
                                  padding: "8px 10px",
                                  border: "1px solid #ddd7ff",
                                  borderRadius: 8,
                                  background: "#f9f8ff",
                                  textAlign: "left",
                                  fontSize: 12,
                                  color: "#3b3680",
                                  cursor: "pointer",
                                  fontWeight: 500
                                }}
                              >
                                {u.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 3 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Select Date:</p>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          {["Today", "Tomorrow"].map((day) => {
                            const d = new Date();
                            if (day === "Tomorrow") d.setDate(d.getDate() + 1);
                            const iso = d.toISOString().split("T")[0];
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => setWizardState(prev => ({ ...prev, step: 4, data: { ...prev.data, date: iso } }))}
                                style={{
                                  flex: 1,
                                  padding: "6px",
                                  border: "1px solid #ddd7ff",
                                  borderRadius: 6,
                                  background: "#f9f8ff",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  color: "#3b3680"
                                }}
                              >
                                {day} ({iso})
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="date"
                          onChange={(e) => {
                            if (e.target.value) {
                              setWizardState(prev => ({ ...prev, step: 4, data: { ...prev.data, date: e.target.value } }));
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "6px",
                            border: "1.5px solid #ddd7ff",
                            borderRadius: 6,
                            fontSize: 11,
                            boxSizing: "border-box"
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 4 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Select Time Slot:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selectedUtility?.timeSlots?.length > 0 ? (
                            selectedUtility.timeSlots.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleChatbotLockSlot(s.id, s.label)}
                                style={{
                                  padding: "6px 10px",
                                  border: "1px solid #ddd7ff",
                                  borderRadius: 8,
                                  background: "#f9f8ff",
                                  fontSize: 12,
                                  color: "#3b3680",
                                  cursor: "pointer",
                                  textAlign: "left"
                                }}
                              >
                                {s.label} ({s.startTime}-{s.endTime})
                              </button>
                            ))
                          ) : (
                            ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00", "17:00-19:00"].map((s, idx) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleChatbotLockSlot(`slot-${idx}`, s)}
                                style={{
                                  padding: "6px 10px",
                                  border: "1px solid #ddd7ff",
                                  borderRadius: 8,
                                  background: "#f9f8ff",
                                  fontSize: 12,
                                  color: "#3b3680",
                                  cursor: "pointer",
                                  textAlign: "left"
                                }}
                              >
                                {s}
                              </button>
                            ))
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 5 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Enter Purpose of Booking:</p>
                        <input
                          type="text"
                          placeholder="e.g. Project presentation (min 3 chars)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setWizardState(prev => ({ ...prev, data: { ...prev.data, purpose: val } }));
                          }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1.5px solid #ddd7ff",
                            borderRadius: 8,
                            fontSize: 12,
                            boxSizing: "border-box",
                            marginBottom: 8
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ((wizardState.data.purpose || "").trim().length >= 3) {
                                setWizardState(prev => ({ ...prev, step: 6 }));
                              }
                            }}
                            disabled={(wizardState.data.purpose || "").trim().length < 3}
                            style={{
                              flex: 2,
                              background: "#534AB7",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: (wizardState.data.purpose || "").trim().length < 3 ? 0.5 : 1
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 6 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Confirm Facility Booking:</p>
                        <div style={{ background: "#f8f7ff", border: "1px solid #e8e5ff", borderRadius: 8, padding: 10, fontSize: 11, color: "#333", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                          <div><strong>Category:</strong> {wizardState.data.categoryName}</div>
                          <div><strong>Item Name:</strong> {wizardState.data.utilityName}</div>
                          <div><strong>Date:</strong> {wizardState.data.date}</div>
                          <div><strong>Slot:</strong> {wizardState.data.timeSlotLabel}</div>
                          <div><strong>Purpose:</strong> {wizardState.data.purpose}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitFacilityBooking}
                            disabled={loading}
                            style={{ flex: 2, padding: "8px 12px", border: "none", background: "#534AB7", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Confirm Booking
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {wizardState.type === "canteen" && (
                  <div>
                    {wizardState.step === 1 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Build Your Cart:</p>
                        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                          {canteenMenu.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#999" }}>Loading menu...</div>
                          ) : (
                            canteenMenu.map((item) => {
                              const qty = cart[item._id] || 0;
                              return (
                                <div
                                  key={item._id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "6px 8px",
                                    border: "1px solid #ede9ff",
                                    borderRadius: 8,
                                    background: "#fdfcff"
                                  }}
                                >
                                  <div style={{ fontSize: 12 }}>
                                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                                    <div style={{ color: "#777", fontSize: 10 }}>₹{item.price} / {item.unit || "pcs"}</div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {qty === 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setCart(prev => ({ ...prev, [item._id]: 1 }))}
                                        style={{
                                          background: "white",
                                          border: "1px solid #534AB7",
                                          color: "#534AB7",
                                          fontSize: 11,
                                          fontWeight: 600,
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          cursor: "pointer"
                                        }}
                                      >
                                        Add
                                      </button>
                                    ) : (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <button
                                          type="button"
                                          onClick={() => setCart(prev => ({ ...prev, [item._id]: Math.max(0, qty - 1) }))}
                                          style={{ width: 22, height: 22, border: "1px solid #ccc", borderRadius: "50%", background: "white", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                          -
                                        </button>
                                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 14, textAlign: "center" }}>{qty}</span>
                                        <button
                                          type="button"
                                          onClick={() => setCart(prev => ({ ...prev, [item._id]: qty + 1 }))}
                                          style={{ width: 22, height: 22, border: "1px solid #ccc", borderRadius: "50%", background: "white", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {(() => {
                          const total = Object.entries(cart).reduce((sum, [itemId, q]) => {
                            const match = canteenMenu.find(m => m._id === itemId);
                            return sum + (match?.price || 0) * q;
                          }, 0);
                          return (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ede9ff", paddingTop: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>Total: ₹{total}</span>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={handleCancelChatbotWizard}
                                  style={{ padding: "6px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWizardState(prev => ({ ...prev, step: 2 }))}
                                  disabled={total === 0}
                                  style={{
                                    background: "#534AB7",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    opacity: total === 0 ? 0.5 : 1
                                  }}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {wizardState.step === 2 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Select Department:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 150, overflowY: "auto" }}>
                          {departments.map((dept) => (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => setWizardState(prev => ({ ...prev, step: 3, data: { ...prev.data, department: dept } }))}
                              style={{
                                padding: "8px",
                                border: "1px solid #ddd7ff",
                                borderRadius: 8,
                                background: "#f9f8ff",
                                fontSize: 12,
                                color: "#3b3680",
                                textAlign: "left",
                                cursor: "pointer"
                              }}
                            >
                              {dept}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 3 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Enter Order Reasoning:</p>
                        <textarea
                          placeholder="e.g. Refreshments for advisory board meeting"
                          onChange={(e) => {
                            const val = e.target.value;
                            setWizardState(prev => ({ ...prev, data: { ...prev.data, reasoning: val } }));
                          }}
                          style={{
                            width: "100%",
                            height: 60,
                            padding: "8px",
                            border: "1.5px solid #ddd7ff",
                            borderRadius: 8,
                            fontSize: 12,
                            boxSizing: "border-box",
                            fontFamily: "inherit",
                            marginBottom: 8
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ((wizardState.data.reasoning || "").trim().length >= 3) {
                                setWizardState(prev => ({ ...prev, step: 4 }));
                              }
                            }}
                            disabled={(wizardState.data.reasoning || "").trim().length < 3}
                            style={{
                              flex: 2,
                              background: "#534AB7",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: (wizardState.data.reasoning || "").trim().length < 3 ? 0.5 : 1
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 4 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Confirm Order Details:</p>
                        <div style={{ background: "#f8f7ff", border: "1px solid #e8e5ff", borderRadius: 8, padding: 10, fontSize: 11, color: "#333", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                          <div><strong>Department:</strong> {wizardState.data.department}</div>
                          <div><strong>Reasoning:</strong> {wizardState.data.reasoning}</div>
                          <div style={{ borderTop: "1px solid #ede9ff", marginTop: 4, paddingTop: 4 }}>
                            <strong>Items selected:</strong>
                            {Object.entries(cart).map(([itemId, qty]) => {
                              const match = canteenMenu.find(m => m._id === itemId);
                              if (qty === 0 || !match) return null;
                              return <div key={itemId}>- {match.name} x{qty} (₹{match.price * qty})</div>;
                            })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitCanteenOrder}
                            disabled={loading}
                            style={{ flex: 2, padding: "8px 12px", border: "none", background: "#534AB7", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Place Order
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {wizardState.type === "maintenance" && (
                  <div>
                    {wizardState.step === 1 && (
                      <div>
                        <p style={{ margin: "0 0 4px 0", fontSize: 12, fontWeight: 500 }}>Priority:</p>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          {["minor", "major"].map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setWizardState(prev => ({ ...prev, data: { ...prev.data, priority: cat } }))}
                              style={{
                                flex: 1,
                                padding: "6px",
                                border: wizardState.data.priority === cat ? "1.5px solid #534AB7" : "1px solid #ddd7ff",
                                background: wizardState.data.priority === cat ? "#f4f3ff" : "white",
                                color: wizardState.data.priority === cat ? "#534AB7" : "#333",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: wizardState.data.priority === cat ? 600 : 500
                              }}
                            >
                              {cat.toUpperCase()}
                            </button>
                          ))}
                        </div>

                        <p style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 500 }}>Select Department:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto", marginBottom: 8 }}>
                          {departments.map((dept) => (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => setWizardState(prev => ({ ...prev, step: 2, data: { ...prev.data, department: dept } }))}
                              style={{
                                padding: "6px 8px",
                                border: "1px solid #ddd7ff",
                                borderRadius: 6,
                                background: "#f9f8ff",
                                fontSize: 11,
                                color: "#3b3680",
                                textAlign: "left",
                                cursor: "pointer"
                              }}
                            >
                              {dept}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 2 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Problem Summary / Title:</p>
                        <input
                          type="text"
                          placeholder="e.g. Light bulb not working (min 3 chars)"
                          onChange={(e) => {
                            const val = e.target.value;
                            setWizardState(prev => ({ ...prev, data: { ...prev.data, title: val } }));
                          }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1.5px solid #ddd7ff",
                            borderRadius: 8,
                            fontSize: 12,
                            boxSizing: "border-box",
                            marginBottom: 8
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ((wizardState.data.title || "").trim().length >= 3) {
                                setWizardState(prev => ({ ...prev, step: 3 }));
                              }
                            }}
                            disabled={(wizardState.data.title || "").trim().length < 3}
                            style={{
                              flex: 2,
                              background: "#534AB7",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: (wizardState.data.title || "").trim().length < 3 ? 0.5 : 1
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 3 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Provide Detailed Description:</p>
                        <textarea
                          placeholder="Please specify room number, symptoms..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setWizardState(prev => ({ ...prev, data: { ...prev.data, description: val } }));
                          }}
                          style={{
                            width: "100%",
                            height: 60,
                            padding: "8px",
                            border: "1.5px solid #ddd7ff",
                            borderRadius: 8,
                            fontSize: 12,
                            boxSizing: "border-box",
                            fontFamily: "inherit",
                            marginBottom: 8
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if ((wizardState.data.description || "").trim().length >= 3) {
                                setWizardState(prev => ({ ...prev, step: 4 }));
                              }
                            }}
                            disabled={(wizardState.data.description || "").trim().length < 3}
                            style={{
                              flex: 2,
                              background: "#534AB7",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: (wizardState.data.description || "").trim().length < 3 ? 0.5 : 1
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardState.step === 4 && (
                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 500 }}>Confirm Ticket details:</p>
                        <div style={{ background: "#f8f7ff", border: "1px solid #e8e5ff", borderRadius: 8, padding: 10, fontSize: 11, color: "#333", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                          <div><strong>Dept:</strong> {wizardState.data.department}</div>
                          <div><strong>Priority:</strong> {wizardState.data.priority?.toUpperCase()}</div>
                          <div><strong>Title:</strong> {wizardState.data.title}</div>
                          <div><strong>Description:</strong> {wizardState.data.description}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={handleBack}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e1dbff", background: "#f5f3ff", color: "#534AB7", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelChatbotWizard}
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ebdada", background: "#fff5f5", color: "#c53030", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitMaintenanceTicket}
                            disabled={loading}
                            style={{ flex: 2, padding: "8px 12px", border: "none", background: "#534AB7", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Submit Ticket
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loading && !wizardState.type && (
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "82%",
                  background: "#f4f3ff",
                  color: "#1a1a2e",
                  padding: "10px 14px",
                  borderRadius: "12px 12px 12px 2px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: 2
                }}
              >
                <span className="chat-thinking-dot">●</span>{" "}
                <span className="chat-thinking-dot">●</span>{" "}
                <span className="chat-thinking-dot">●</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {!wizardState.type && (
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #ede9ff",
                background: "#faf9ff",
                maxHeight: 120,
                overflowY: "auto",
                display: "flex",
                flexWrap: "wrap",
                gap: 6
              }}
            >
              {currentMenu === "main" && (
                <>
                  {role === "faculty" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("faculty_booking")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Facility Booking</button>
                      <button type="button" onClick={() => navigateToMenu("faculty_maintenance")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Maintenance Requests</button>
                      <button type="button" onClick={() => navigateToMenu("faculty_analytics")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Faculty Analytics</button>
                    </>
                  )}
                  {role === "assistant" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("assistant_canteen")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Canteen Orders</button>
                      <button type="button" onClick={() => navigateToMenu("assistant_tracking")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Order Tracking</button>
                      <button type="button" onClick={() => navigateToMenu("assistant_insights")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Canteen Insights</button>
                    </>
                  )}
                  {role === "coordinator" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("coordinator_approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Approval Operations</button>
                      <button type="button" onClick={() => navigateToMenu("coordinator_schedule")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Facility Schedule</button>
                      <button type="button" onClick={() => navigateToMenu("coordinator_analytics")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Coordinator Analytics</button>
                    </>
                  )}
                  {role === "hod" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("hod_approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Maintenance Approvals</button>
                      <button type="button" onClick={() => navigateToMenu("hod_insights")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Department Insights</button>
                    </>
                  )}
                  {role === "workshop_hod" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("workshop_approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Workshop Approvals</button>
                      <button type="button" onClick={() => navigateToMenu("workshop_analytics")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Repair Analytics</button>
                    </>
                  )}
                  {role === "budget_hod" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("budget_approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Budget Approvals</button>
                      <button type="button" onClick={() => navigateToMenu("budget_insights")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Budget Insights</button>
                    </>
                  )}
                  {role === "registrar" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("registrar_queue")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Registrar Queue</button>
                      <button type="button" onClick={() => navigateToMenu("registrar_insights")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Registrar Insights</button>
                    </>
                  )}
                  {role === "director" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("director_reports")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Executive Reports</button>
                      <button type="button" onClick={() => navigateToMenu("director_actions")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Actions</button>
                      <button type="button" onClick={() => navigateToMenu("director_ai")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>AI Assistant</button>
                    </>
                  )}
                  {role === "worker" && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("worker_jobs")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Assigned Jobs</button>
                      <button type="button" onClick={() => navigateToMenu("worker_progress")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Update Progress</button>
                    </>
                  )}
                  {(role === "org_admin" || role === "super_admin") && (
                    <>
                      <button type="button" onClick={() => navigateToMenu("admin_analytics")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Campus Analytics</button>
                      <button type="button" onClick={() => navigateToMenu("admin_workflow")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Workflow Analytics</button>
                      <button type="button" onClick={() => navigateToMenu("admin_ai")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>AI Assistant</button>
                    </>
                  )}
                  <button type="button" onClick={() => navigateToMenu("faq")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>FAQs & Info</button>
                </>
              )}

              {currentMenu === "faculty_booking" && (
                <>
                  <button type="button" onClick={handleShowAllFacilities} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show Available Facilities</button>
                  <button type="button" onClick={startFacilityWizard} style={{ padding: "6px 10px", background: "#f5f3ff", border: "1px solid #534AB7", color: "#534AB7", fontSize: 11, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Book a Facility/Hall</button>
                  <button type="button" onClick={() => handleQuickReplyClick("show my pending facility requests")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show My Pending Requests</button>
                  <button type="button" onClick={() => handleQuickReplyClick("who is currently reviewing my booking?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Who is reviewing my booking?</button>
                </>
              )}
              {currentMenu === "faculty_maintenance" && (
                <>
                  <button type="button" onClick={startMaintenanceWizard} style={{ padding: "6px 10px", background: "#f5f3ff", border: "1px solid #534AB7", color: "#534AB7", fontSize: 11, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Raise Ticket</button>
                  <button type="button" onClick={() => handleQuickReplyClick("show my maintenance requests")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show My Maintenance Requests</button>
                </>
              )}
              {currentMenu === "faculty_analytics" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("how many bookings have I made this month?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Bookings Made This Month</button>
                  <button type="button" onClick={() => handleQuickReplyClick("most used facility by my department")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Used Facility by Dept</button>
                </>
              )}

              {currentMenu === "assistant_canteen" && (
                <>
                  <button type="button" onClick={handleShowCanteenMenu} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show Today's Menu</button>
                  <button type="button" onClick={() => handleQuickReplyClick("show vegetarian items")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show Vegetarian Items</button>
                  <button type="button" onClick={startCanteenOrderWizard} style={{ padding: "6px 10px", background: "#f5f3ff", border: "1px solid #534AB7", color: "#534AB7", fontSize: 11, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Place Canteen Order</button>
                  <button type="button" onClick={() => handleQuickReplyClick("repeat my last order")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Repeat Last Order</button>
                </>
              )}
              {currentMenu === "assistant_tracking" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("track order CNT-123")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Track Order CNT-123</button>
                  <button type="button" onClick={handleListMyOrders} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show My Order History</button>
                </>
              )}
              {currentMenu === "assistant_insights" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("my most ordered item")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>My Most Ordered Item</button>
                  <button type="button" onClick={() => handleQuickReplyClick("total orders this month")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Total Orders This Month</button>
                  <button type="button" onClick={() => handleQuickReplyClick("last 10 orders")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Last 10 Orders</button>
                </>
              )}

              {currentMenu === "coordinator_approvals" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("show pending facility approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Approvals</button>
                  <button type="button" onClick={() => handleQuickReplyClick("approve booking BKH-123")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Approve BKH-123</button>
                  <button type="button" onClick={() => handleQuickReplyClick("reject booking BKH-234")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Reject BKH-234</button>
                </>
              )}
              {currentMenu === "coordinator_schedule" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("show today's bookings")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Today's Bookings</button>
                  <button type="button" onClick={() => handleQuickReplyClick("show facility schedule")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Facility Schedule</button>
                </>
              )}
              {currentMenu === "coordinator_analytics" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("most booked facility this week")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Booked Facility</button>
                  <button type="button" onClick={() => handleQuickReplyClick("peak booking hours")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Peak Booking Hours</button>
                  <button type="button" onClick={() => handleQuickReplyClick("unused facilities today")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Unused Facilities Today</button>
                  <button type="button" onClick={() => handleQuickReplyClick("facility conflicts")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Facility Conflicts</button>
                </>
              )}

              {currentMenu === "hod_approvals" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("show maintenance requests awaiting approval")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Approvals</button>
                  <button type="button" onClick={() => handleQuickReplyClick("approve request MNT-123")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Approve MNT-123</button>
                  <button type="button" onClick={() => handleQuickReplyClick("reject request MNT-456")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Reject MNT-456</button>
                </>
              )}
              {currentMenu === "hod_insights" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("which faculty use facilities most?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Top Faculty Users</button>
                  <button type="button" onClick={() => handleQuickReplyClick("department booking statistics")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Booking Statistics</button>
                  <button type="button" onClick={() => handleQuickReplyClick("department maintenance expenses")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Maintenance Expenses</button>
                </>
              )}

              {currentMenu === "workshop_approvals" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("pending workshop requests")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Workshop Requests</button>
                  <button type="button" onClick={() => handleQuickReplyClick("equipment requiring repair")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Equipment Requiring Repair</button>
                </>
              )}
              {currentMenu === "workshop_analytics" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("most damaged equipment")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Damaged Equipment</button>
                  <button type="button" onClick={() => handleQuickReplyClick("average repair time")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Average Repair Time</button>
                </>
              )}

              {currentMenu === "budget_approvals" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("show requests requiring budget approval")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Budget Approval Requests</button>
                  <button type="button" onClick={() => handleQuickReplyClick("estimated maintenance cost")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Estimated Repair Cost</button>
                </>
              )}
              {currentMenu === "budget_insights" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("monthly maintenance spending")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Monthly Repair Spend</button>
                  <button type="button" onClick={() => handleQuickReplyClick("budget utilization report")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Budget Utilization Report</button>
                </>
              )}

              {currentMenu === "registrar_queue" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("pending approvals")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Approvals</button>
                  <button type="button" onClick={() => handleQuickReplyClick("high-cost maintenance requests")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>High-Cost Requests</button>
                </>
              )}
              {currentMenu === "registrar_insights" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("monthly facility utilization")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Facility Utilization</button>
                  <button type="button" onClick={() => handleQuickReplyClick("approval bottlenecks")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Approval Bottlenecks</button>
                </>
              )}

              {currentMenu === "director_reports" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("campus utilization report")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Utilization Report</button>
                  <button type="button" onClick={() => handleQuickReplyClick("monthly operations summary")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Operations Summary</button>
                  <button type="button" onClick={() => handleQuickReplyClick("most used facilities")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Used Facilities</button>
                  <button type="button" onClick={() => handleQuickReplyClick("canteen performance")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Canteen Performance</button>
                  <button type="button" onClick={() => handleQuickReplyClick("maintenance cost summary")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Repair Cost Summary</button>
                </>
              )}
              {currentMenu === "director_actions" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("pending approvals requiring my action")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending Approvals</button>
                </>
              )}
              {currentMenu === "director_ai" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("generate executive summary for Director")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Executive Summary</button>
                </>
              )}

              {currentMenu === "worker_jobs" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("show assigned jobs")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Show Assigned Jobs</button>
                </>
              )}
              {currentMenu === "worker_progress" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("mark repair started")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Mark Started</button>
                  <button type="button" onClick={() => handleQuickReplyClick("update repair progress")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Update Progress</button>
                  <button type="button" onClick={() => handleQuickReplyClick("mark completed")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Mark Completed</button>
                  <button type="button" onClick={() => handleQuickReplyClick("upload repair notes")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Upload Repair Notes</button>
                </>
              )}

              {currentMenu === "admin_analytics" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("which facility is booked most?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Booked Facility</button>
                  <button type="button" onClick={() => handleQuickReplyClick("which facility is underutilized?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Underutilized Facilities</button>
                  <button type="button" onClick={() => handleQuickReplyClick("show booking heatmap for last month")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Booking Heatmap</button>
                  <button type="button" onClick={() => handleQuickReplyClick("most ordered item")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Ordered Food</button>
                  <button type="button" onClick={() => handleQuickReplyClick("revenue this month")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Revenue This Month</button>
                  <button type="button" onClick={() => handleQuickReplyClick("most repaired equipment")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Most Repaired Equipment</button>
                  <button type="button" onClick={() => handleQuickReplyClick("equipment with highest failure rate")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Highest Failure Rate</button>
                </>
              )}
              {currentMenu === "admin_workflow" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("average approval time")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Average Approval Time</button>
                  <button type="button" onClick={() => handleQuickReplyClick("which approval stage causes delays?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Stage Causing Delays</button>
                  <button type="button" onClick={() => handleQuickReplyClick("top rejection reasons")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Top Rejection Reasons</button>
                  <button type="button" onClick={() => handleQuickReplyClick("pending requests by approver")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Pending By Approver</button>
                </>
              )}
              {currentMenu === "admin_ai" && (
                <>
                  <button type="button" onClick={() => handleQuickReplyClick("Why is Seminar Hall B underutilized?")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Why is Hall B Underutilized?</button>
                  <button type="button" onClick={() => handleQuickReplyClick("Predict next month's canteen demand")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Predict Canteen Demand</button>
                  <button type="button" onClick={() => handleQuickReplyClick("Show facilities likely to reach full capacity next week")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Capacity Risk Next Week</button>
                  <button type="button" onClick={() => handleQuickReplyClick("generate executive summary for Director")} style={{ padding: "6px 10px", background: "white", border: "1px solid #d4d0f7", color: "#3b3680", fontSize: 11, borderRadius: 8, fontWeight: 500, cursor: "pointer" }}>Generate Executive Summary</button>
                </>
              )}

              {currentMenu === "faq" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                  {FAQS.map((faq, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        addUserMessage(faq.q);
                        addAssistantMessage(faq.a);
                      }}
                      style={{
                        padding: "6px 8px",
                        background: "white",
                        border: "1px solid #ede9ff",
                        borderRadius: 6,
                        color: "#3b3680",
                        fontSize: 11,
                        textAlign: "left",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      {faq.q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #ede9ff",
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "#fdfcff"
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type message, e.g. 'book facility' or 'show menu'"
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1.5px solid #d4d0f7",
                fontSize: 13,
                outline: "none"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#534AB7";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d4d0f7";
              }}
            />
            <button
              type="button"
              onClick={handleSendTextQuery}
              disabled={loading}
              style={{
                background: "#534AB7",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "0 18px",
                height: 40,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? "…" : "Send"}
            </button>
          </div>

          {errorText && (
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #ede9ff",
                background: "#fff2f2",
                color: "#8f1d1d",
                fontSize: 12,
                fontWeight: 500
              }}
            >
              {errorText}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        style={buttonStyle}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>
    </div>
  );
}
