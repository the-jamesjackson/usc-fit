let user = null;
try {
    const raw = sessionStorage.getItem("user");
    if (raw) user = JSON.parse(raw);
} catch (e) {
    user = null;
}

const isGuest = !user || user.id === 0;

function showGuestModal() {
    const modal = document.getElementById("guestModal");
    if (modal) modal.style.display = "flex";
}

if (isGuest) {
    const banner = document.getElementById("guestBanner");
    if (banner) banner.style.display = "block";

    const sidebarUsername = document.getElementById("sidebarUsername");
    const sidebarInitials = document.getElementById("sidebarInitials");
    if (sidebarUsername) sidebarUsername.textContent = "Guest";
    if (sidebarInitials) sidebarInitials.textContent = "G";

    // Intercept restricted links — show modal instead of navigating
    ["dashboardLink", "matchesLink", "profileLink"].forEach(function(id) {
        const link = document.getElementById(id);
        if (link) {
            link.href = "#";
            link.addEventListener("click", function(e) { e.preventDefault(); showGuestModal(); });
        }
    });

    const createLink = document.getElementById("createEventLink");
    if (createLink) {
        createLink.href = "#";
        createLink.addEventListener("click", function(e) { e.preventDefault(); showGuestModal(); });
    }

    // Close modal when clicking the backdrop
    const modal = document.getElementById("guestModal");
    if (modal) {
        modal.addEventListener("click", function(e) {
            if (e.target === modal) modal.style.display = "none";
        });
    }
} else {
    const username = user.username || "User";
    const sidebarUsername = document.getElementById("sidebarUsername");
    const sidebarInitials = document.getElementById("sidebarInitials");
    if (sidebarUsername) sidebarUsername.textContent = username;
    if (sidebarInitials) sidebarInitials.textContent = getInitials(username);
}

const calTitle = document.getElementById("calTitle");
const calGrid = document.getElementById("calGrid");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const calToday = document.getElementById("calToday");
const calAll = document.getElementById("calAll");
const calHint = document.getElementById("calHint");

let allEvents = [];
let calendarMonth = new Date();
calendarMonth.setDate(1);
let selectedDate = null; // "YYYY-MM-DD" or null

const myUserId = user && user.id !== undefined && user.id !== null ? Number(user.id) : -1;

function parseEventDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) {
        return null;
    }
    const t = String(timeStr).trim();
    const timePart = t.length === 5 ? t + ":00" : t;
    const d = new Date(String(dateStr).trim() + "T" + timePart);
    return isNaN(d.getTime()) ? null : d;
}

function getEventEndDate(e) {
    if (e.endTime) {
        const end = parseEventDateTime(e.date, e.endTime);
        if (end) {
            return end;
        }
    }
    const start = parseEventDateTime(e.date, e.time);
    if (!start) {
        return null;
    }
    return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

function getEventProgressState(e) {
    const start = parseEventDateTime(e.date, e.time);
    const end = getEventEndDate(e);
    if (!start || !end) {
        return { key: "unknown", label: "—" };
    }
    const now = new Date();
    if (now < start) {
        return { key: "upcoming", label: "Upcoming" };
    }
    if (now >= end) {
        return { key: "completed", label: "Completed" };
    }
    return { key: "in_progress", label: "In progress" };
}

/** Completed (past end time) events are excluded from the top summary cards only. */
function isEventActiveForSummary(e) {
    return getEventProgressState(e).key !== "completed";
}

function eventsForSummaryStats(events) {
    return (events || []).filter(isEventActiveForSummary);
}

/**
 * Status column: for completed events where the user participated, show Present / Not present.
 */
function getStatusDisplay(e, progress) {
    const joined = !!e.currentUserJoined;
    const host = myUserId >= 0 && Number(e.creatorId) === myUserId;
    const p = e.participantPresent;
    if (progress.key === "completed" && joined && !host) {
        if (p === true) {
            return { label: "Present", cssKey: "present-confirmed" };
        }
        return { label: "Not present", cssKey: "not-present" };
    }
    if (progress.key === "unknown") {
        return { label: progress.label, cssKey: "unknown" };
    }
    return { label: progress.label, cssKey: progress.key.replace(/_/g, "-") };
}

function buildActionColumn(e, progress) {
    const maxParticipants = Number(e.maxParticipants || 0);
    const currentParticipants = Number(e.currentParticipants || 0);
    const openSpots = Math.max(maxParticipants - currentParticipants, 0);
    const host = myUserId >= 0 && Number(e.creatorId) === myUserId;
    const joined = !!e.currentUserJoined;

    if (host) {
        if (progress.key === "in_progress") {
            return (
                '<div class="action-host-stack">' +
                '<span class="action-host">Hosting</span>' +
                '<button type="button" class="btn-attendance" data-attendance-event-id="' +
                Number(e.id) +
                '">Attendance</button>' +
                "</div>"
            );
        }
        return '<span class="action-host">Hosting</span>';
    }

    if (progress.key === "completed") {
        if (joined) {
            if (e.participantPresent === true) {
                return '<span class="action-muted">Attended</span>';
            }
            return '<span class="action-not-present">Not present</span>';
        }
        return '<span class="action-muted">—</span>';
    }

    if (progress.key === "in_progress") {
        if (joined) {
            return '<span class="action-live">In session</span>';
        }
        return '<span class="action-muted">Started</span>';
    }

    if (progress.key === "unknown") {
        return '<span class="action-muted">—</span>';
    }

    if (joined) {
        return (
            '<div class="action-stack">' +
            '<span class="btn-joined-label">Joined</span>' +
            '<button type="button" class="btn-link-leave" data-leave-id="' +
            Number(e.id) +
            '">Leave</button>' +
            "</div>"
        );
    }

    if (openSpots <= 0) {
        return '<span class="action-muted">Full</span>';
    }

    return '<button type="button" class="btn-join" data-join-id="' + Number(e.id) + '">Join</button>';
}

function bindActionButtons(tbody) {
    if (!tbody) {
        return;
    }
    tbody.querySelectorAll("[data-join-id]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const id = Number(btn.getAttribute("data-join-id"));
            joinEventById(id, btn);
        });
    });
    tbody.querySelectorAll("[data-leave-id]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const id = Number(btn.getAttribute("data-leave-id"));
            leaveEventById(id, btn);
        });
    });
    tbody.querySelectorAll("[data-attendance-event-id]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const id = Number(btn.getAttribute("data-attendance-event-id"));
            openAttendanceModal(id);
        });
    });
}

let attendanceModalEventId = null;

function attendanceGetUrl(eventId) {
    var base =
        typeof campusFitUrl === "function" ? campusFitUrl("eventAttendance") : "eventAttendance";
    return base + "?eventId=" + encodeURIComponent(String(eventId));
}

function markAttendancePostUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("markAttendance") : "markAttendance";
}

function openAttendanceModal(eventId) {
    var overlay = document.getElementById("attendanceOverlay");
    var listEl = document.getElementById("attendanceList");
    var errEl = document.getElementById("attendanceError");
    if (!overlay || !listEl) {
        return;
    }
    if (errEl) {
        errEl.textContent = "";
    }
    listEl.innerHTML = '<div class="modal-loading">Loading roster…</div>';
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    attendanceModalEventId = eventId;

    fetch(attendanceGetUrl(eventId), { credentials: "same-origin" })
        .then(function(res) {
            return res.json().then(function(data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function(result) {
            if (!result.data || !result.data.success) {
                listEl.innerHTML =
                    '<div class="modal-empty">' +
                    escapeHtml((result.data && result.data.message) || "Could not load attendance.") +
                    "</div>";
                return;
            }
            var parts = result.data.participants || [];
            if (parts.length === 0) {
                listEl.innerHTML =
                    '<div class="modal-empty">No participants have joined yet (besides you as host).</div>';
                return;
            }
            listEl.innerHTML = "";
            parts.forEach(function(p) {
                var uid = Number(p.userId);
                var checked = p.present === true;
                var row = document.createElement("label");
                row.className = "attendance-row";
                row.innerHTML =
                    '<input type="checkbox" data-att-user="' +
                    uid +
                    '" ' +
                    (checked ? "checked " : "") +
                    '/> <span class="attendance-name">' +
                    escapeHtml(p.username || "User") +
                    "</span> <span class=\"attendance-hint\">Present</span>";
                listEl.appendChild(row);
            });
        })
        .catch(function() {
            listEl.innerHTML = '<div class="modal-empty">Could not load attendance.</div>';
        });
}

function closeAttendanceModal() {
    var overlay = document.getElementById("attendanceOverlay");
    if (overlay) {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
    }
    attendanceModalEventId = null;
}

function saveAttendanceFromModal() {
    var listEl = document.getElementById("attendanceList");
    var errEl = document.getElementById("attendanceError");
    var saveBtn = document.getElementById("attendanceSave");
    if (!attendanceModalEventId || !listEl) {
        return;
    }
    var boxes = listEl.querySelectorAll("input[data-att-user]");
    if (boxes.length === 0) {
        closeAttendanceModal();
        return;
    }
    var marks = [];
    boxes.forEach(function(cb) {
        marks.push({
            userId: Number(cb.getAttribute("data-att-user")),
            present: cb.checked
        });
    });
    if (errEl) {
        errEl.textContent = "";
    }
    if (saveBtn) {
        saveBtn.disabled = true;
    }

    fetch(markAttendancePostUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ eventId: attendanceModalEventId, marks: marks })
    })
        .then(function(res) {
            return res.json().then(function(data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function(result) {
            if (result.data && result.data.success) {
                closeAttendanceModal();
                fetchAndRender();
            } else if (errEl) {
                errEl.textContent =
                    (result.data && result.data.message) || "Could not save attendance.";
            }
        })
        .catch(function() {
            if (errEl) {
                errEl.textContent = "Could not save attendance.";
            }
        })
        .then(function() {
            if (saveBtn) {
                saveBtn.disabled = false;
            }
        });
}

function joinEventUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("joinEvent") : "joinEvent";
}

function leaveEventUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("leaveEvent") : "leaveEvent";
}

function joinEventById(eventId, btn) {
    btn.disabled = true;
    const params = new URLSearchParams({ eventId: String(eventId) });
    fetch(joinEventUrl(), { method: "POST", body: params, credentials: "same-origin" })
        .then(function(res) {
            return res.json().then(function(data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function(result) {
            if (result.data && result.data.success) {
                fetchAndRender();
            } else {
                var msg = (result.data && result.data.message) || "Could not join this event.";
                alert(msg);
                btn.disabled = false;
            }
        })
        .catch(function() {
            alert("Could not join this event.");
            btn.disabled = false;
        });
}

function leaveEventById(eventId, btn) {
    btn.disabled = true;
    const params = new URLSearchParams({ eventId: String(eventId) });
    fetch(leaveEventUrl(), { method: "POST", body: params, credentials: "same-origin" })
        .then(function(res) {
            return res.json().then(function(data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function(result) {
            if (result.data && result.data.success) {
                fetchAndRender();
            } else {
                var msg = (result.data && result.data.message) || "Could not leave this event.";
                alert(msg);
                btn.disabled = false;
            }
        })
        .catch(function() {
            alert("Could not leave this event.");
            btn.disabled = false;
        });
}

function toDateInputValue(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function groupEventsByDate(events) {
    const map = new Map(); // date -> events[]
    (events || []).forEach((e) => {
        const d = String(e.date || "").trim();
        if (!d) return;
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(e);
    });
    for (const [d, list] of map.entries()) {
        list.sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
        map.set(d, list);
    }
    return map;
}

function setSelectedDate(newDate) {
    selectedDate = newDate;
    if (calHint) {
        calHint.textContent = selectedDate
            ? `Showing events for ${selectedDate}. Click “All events” to clear the filter.`
            : "Click a day to filter the table below.";
    }
    if (calAll) {
        calAll.classList.toggle("primary", !selectedDate);
    }
    renderCalendar();
    renderTable();
}

function renderCalendar() {
    if (!calGrid || !calTitle) return;
    const monthLabel = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    calTitle.textContent = monthLabel;
    calGrid.innerHTML = "";

    ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].forEach((label) => {
        const el = document.createElement("div");
        el.className = "cal-dow";
        el.textContent = label;
        calGrid.appendChild(el);
    });

    const eventsByDate = groupEventsByDate(allEvents);

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
        const dayNum = prevMonthDays - (firstDay - 1 - i);
        const cell = document.createElement("div");
        cell.className = "cal-day muted";
        cell.innerHTML = `<div class="cal-day-top"><div class="cal-num">${dayNum}</div></div>`;
        calGrid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const thisDate = new Date(year, month, day);
        const value = toDateInputValue(thisDate);
        const todaysEvents = eventsByDate.get(value) || [];

        const cell = document.createElement("div");
        cell.className = "cal-day";
        if (selectedDate === value) {
            cell.classList.add("selected");
        }

        const badge = todaysEvents.length > 0 ? `<div class="cal-badge">${todaysEvents.length}</div>` : "";
        const pills = todaysEvents.slice(0, 2).map((e) => {
            const pend =
                String(e.viewerInviteStatus || "").toUpperCase() === "PENDING" ? " invite-pending" : "";
            return `<div class="cal-pill${pend}" title="${escapeHtml((e.activityType || "Event") + " @ " + (e.location || ""))}">${escapeHtml(e.activityType || "Event")}</div>`;
        }).join("");
        const more = todaysEvents.length > 2 ? `<div class="cal-more">+${todaysEvents.length - 2} more</div>` : "";

        cell.innerHTML = `
            <div class="cal-day-top">
                <div class="cal-num">${day}</div>
                ${badge}
            </div>
            <div class="cal-events">
                ${pills}
                ${more}
            </div>
        `;

        cell.addEventListener("click", () => setSelectedDate(value));
        calGrid.appendChild(cell);
    }
}

function renderTable() {
    const tbody = document.getElementById("eventsBody");
    const eventCount = document.getElementById("eventCount");
    const openSpotCount = document.getElementById("openSpotCount");
    const locationCount = document.getElementById("locationCount");

    if (!tbody || !eventCount || !openSpotCount || !locationCount) return;

    const shown = selectedDate
        ? allEvents.filter((e) => String(e.date || "").trim() === selectedDate)
        : allEvents.slice();

    tbody.innerHTML = "";

    if (!shown || shown.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">${selectedDate ? "No events on this day yet." : "No activities available yet."}</td>
            </tr>
        `;
        const summaryPool = eventsForSummaryStats(allEvents);
        eventCount.textContent = String(summaryPool.length || 0);
        openSpotCount.textContent = String(calcTotalOpenSpots(summaryPool));
        locationCount.textContent = String(calcLocationCount(summaryPool));
        return;
    }

    shown.sort((a, b) => {
        const d = String(a.date || "").localeCompare(String(b.date || ""));
        if (d !== 0) return d;
        return String(a.time || "").localeCompare(String(b.time || ""));
    });

    shown.forEach(function(e) {
        const maxParticipants = Number(e.maxParticipants || 0);
        const currentParticipants = Number(e.currentParticipants || 0);
        const endTime = e.endTime ? ` - ${e.endTime}` : "";
        const progress = getEventProgressState(e);
        const statusDisplay = getStatusDisplay(e, progress);
        const statusClass = "status-" + statusDisplay.cssKey;
        const inviteChip =
            String(e.viewerInviteStatus || "").toUpperCase() === "PENDING"
                ? '<span class="table-invite-chip">Invite</span>'
                : "";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${inviteChip}<span class="activity-pill">${escapeHtml(e.activityType || "Activity")}</span></td>
            <td><span class="location-text">${escapeHtml(e.location || "N/A")}</span></td>
            <td>${escapeHtml(e.date || "N/A")}</td>
            <td>${escapeHtml((e.time || "N/A") + endTime)}</td>
            <td><span class="status-pill ${statusClass}">${escapeHtml(statusDisplay.label)}</span></td>
            <td><span class="spots-pill">${currentParticipants}/${maxParticipants}</span></td>
            <td class="action-cell">${buildActionColumn(e, progress)}</td>
        `;
        tbody.appendChild(row);
    });

    bindActionButtons(tbody);

    const summaryPool = eventsForSummaryStats(allEvents);
    eventCount.textContent = String(summaryPool.length || 0);
    openSpotCount.textContent = String(calcTotalOpenSpots(summaryPool));
    locationCount.textContent = String(calcLocationCount(summaryPool));
}

function calcTotalOpenSpots(events) {
    let total = 0;
    (events || []).forEach((e) => {
        const maxParticipants = Number(e.maxParticipants || 0);
        const currentParticipants = Number(e.currentParticipants || 0);
        total += Math.max(maxParticipants - currentParticipants, 0);
    });
    return total;
}

function calcLocationCount(events) {
    const locations = new Set();
    (events || []).forEach((e) => {
        if (e.location) locations.add(e.location);
    });
    return locations.size;
}

function renderInvitePanel() {
    const body = document.getElementById("invitesBody");
    if (!body) return;

    const pending = allEvents.filter(
        (e) =>
            String(e.viewerInviteStatus || "").toUpperCase() === "PENDING" &&
            e.inviteId != null &&
            Number(e.inviteId) > 0
    );

    if (pending.length === 0) {
        body.innerHTML = '<p class="invites-empty">No pending invitations.</p>';
        return;
    }

    body.innerHTML = "";
    pending.forEach(function (ev) {
        const inviter = ev.inviterUsername ? `From ${escapeHtml(ev.inviterUsername)}` : "You were invited";
        const range = `${escapeHtml(String(ev.date || "?"))} · ${escapeHtml(String(ev.time || "?"))}`;
        const row = document.createElement("div");
        row.className = "invite-banner-row";
        row.innerHTML = `
            <div class="invite-meta">
                <strong>${escapeHtml(ev.activityType || "Event")}</strong>
                <small>${inviter} · ${range} · ${escapeHtml(ev.location || "")}</small>
            </div>
            <div class="invite-actions" data-invite-id="${Number(ev.inviteId)}"></div>
        `;
        const actions = row.querySelector(".invite-actions");
        const btnDecl = document.createElement("button");
        btnDecl.type = "button";
        btnDecl.className = "btn-decline";
        btnDecl.textContent = "Decline";
        btnDecl.addEventListener("click", function () {
            respondToInvite(Number(ev.inviteId), "decline");
        });
        const btnAcc = document.createElement("button");
        btnAcc.type = "button";
        btnAcc.className = "btn-accept";
        btnAcc.textContent = "Accept";
        btnAcc.addEventListener("click", function () {
            respondToInvite(Number(ev.inviteId), "accept");
        });
        actions.appendChild(btnDecl);
        actions.appendChild(btnAcc);
        body.appendChild(row);
    });
}

function respondToInvite(inviteId, action) {
    var url = typeof campusFitUrl === "function" ? campusFitUrl("respondInvite") : "respondInvite";
    var params = new URLSearchParams();
    params.set("inviteId", String(inviteId));
    params.set("action", action);

    fetch(url, { method: "POST", body: params, credentials: "same-origin" })
        .then(function (res) {
            return res.json().then(function (data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function (wrapped) {
            if (!wrapped.ok) {
                alert(wrapped.data && wrapped.data.message ? wrapped.data.message : "Request failed");
                return;
            }
            fetchAndRender();
        })
        .catch(function () {
            alert("Could not respond to invitation.");
        });
}

function showError(message) {
    const tbody = document.getElementById("eventsBody");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="error-cell">${escapeHtml(message)}</td>
        </tr>
    `;
}

function fetchAndRender() {
    var url = typeof campusFitUrl === "function" ? campusFitUrl("events") : "events";
    if (calHint) {
        calHint.textContent = "Loading events…";
    }

    fetch(url, { credentials: "same-origin" })
        .then(function(res) {
            if (!res.ok) {
                throw new Error("Could not load activities.");
            }
            return res.json();
        })
        .then(function(events) {
            allEvents = Array.isArray(events) ? events : [];
            if (calHint) {
                calHint.textContent = selectedDate
                    ? `Showing events for ${selectedDate}. Click “All events” to clear the filter.`
                    : "Click a day to filter the table below.";
            }
            renderCalendar();
            renderTable();
            renderInvitePanel();
        })
        .catch(function(error) {
            allEvents = [];
            renderCalendar();
            renderInvitePanel();
            if (calHint) {
                calHint.textContent = "Could not load events; calendar is empty.";
            }
            showError(error.message);
        });
}

if (calPrev) {
    calPrev.addEventListener("click", () => {
        calendarMonth.setMonth(calendarMonth.getMonth() - 1);
        renderCalendar();
    });
}

if (calNext) {
    calNext.addEventListener("click", () => {
        calendarMonth.setMonth(calendarMonth.getMonth() + 1);
        renderCalendar();
    });
}

if (calToday) {
    calToday.addEventListener("click", () => {
        const now = new Date();
        calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setSelectedDate(toDateInputValue(now));
    });
}

if (calAll) {
    calAll.addEventListener("click", () => setSelectedDate(null));
}

(function initAttendanceModal() {
    var cancel = document.getElementById("attendanceCancel");
    var save = document.getElementById("attendanceSave");
    var overlay = document.getElementById("attendanceOverlay");
    if (cancel) {
        cancel.addEventListener("click", closeAttendanceModal);
    }
    if (save) {
        save.addEventListener("click", saveAttendanceFromModal);
    }
    if (overlay) {
        overlay.addEventListener("click", function(ev) {
            if (ev.target === overlay) {
                closeAttendanceModal();
            }
        });
    }
})();

// Month grid renders immediately even if /events is slow or fails — avoid a blank calendar.
renderCalendar();
renderInvitePanel();

fetchAndRender();
if (!isGuest) loadInvites();

function loadInvites() {
    var container = document.getElementById("inviteRows");
    if (!container) return;

    container.innerHTML = '<div class="invite-empty">Loading invites...</div>';

    var url = typeof campusFitUrl === "function" ? campusFitUrl("myInvites") : "/CampusActivities/myInvites";
    fetch(url, { credentials: "same-origin" })
        .then(function(res) {
            if (res.status === 401) { window.location.href = "login.html"; return; }
            return res.json();
        })
        .then(function(invites) {
            if (!invites) return;
            container.innerHTML = "";
            if (invites.length === 0) {
                container.innerHTML = '<div class="invite-empty">No pending invites.</div>';
                return;
            }
            invites.forEach(function(inv) {
                var row = document.createElement("div");
                row.className = "invite-row";
                row.id = "invite-" + inv.inviteId;

                var info = document.createElement("div");
                info.className = "invite-info";

                var from = document.createElement("div");
                from.className = "invite-from";
                from.textContent = inv.inviterName + " invited you";

                var detail = document.createElement("div");
                detail.className = "invite-detail";
                detail.textContent = capitalize(inv.activityType) + " · " + inv.location + " · " + inv.date;

                info.appendChild(from);
                info.appendChild(detail);

                var btns = document.createElement("div");
                btns.className = "invite-btns";

                var acceptBtn = document.createElement("button");
                acceptBtn.className = "invite-btn primary";
                acceptBtn.textContent = "Accept";
                acceptBtn.addEventListener("click", function() {
                    respondToInvite(inv.inviteId, true, acceptBtn, declineBtn, row);
                });

                var declineBtn = document.createElement("button");
                declineBtn.className = "invite-btn";
                declineBtn.textContent = "Decline";
                declineBtn.addEventListener("click", function() {
                    respondToInvite(inv.inviteId, false, acceptBtn, declineBtn, row);
                });

                btns.appendChild(acceptBtn);
                btns.appendChild(declineBtn);
                row.appendChild(info);
                row.appendChild(btns);
                container.appendChild(row);
            });
        })
        .catch(function() {
            container.innerHTML = '<div class="invite-empty">Failed to load invites.</div>';
        });
}

function respondToInvite(inviteId, accept, acceptBtn, declineBtn, row) {
    acceptBtn.disabled = true;
    declineBtn.disabled = true;

    var url = typeof campusFitUrl === "function" ? campusFitUrl("respondInvite") : "/CampusActivities/respondInvite";
    var params = new URLSearchParams({ inviteId: inviteId, accept: accept });
    fetch(url, { method: "POST", body: params, credentials: "same-origin" })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                row.remove();
                var container = document.getElementById("inviteRows");
                if (container && container.children.length === 0) {
                    container.innerHTML = '<div class="invite-empty">No pending invites.</div>';
                }
            } else {
                alert(data.message);
                acceptBtn.disabled = false;
                declineBtn.disabled = false;
            }
        })
        .catch(function() {
            alert("Failed to respond to invite.");
            acceptBtn.disabled = false;
            declineBtn.disabled = false;
        });
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getInitials(name) {
    const parts = String(name).trim().split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}