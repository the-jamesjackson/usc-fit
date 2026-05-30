const sessionUser = JSON.parse(sessionStorage.getItem("user") || "null");

let profilePenaltyInterval = null;

function meApiUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/users?me=true") : "api/users?me=true";
}

function usersApiBase() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/users") : "api/users";
}

function clearProfilePenaltyInterval() {
    if (profilePenaltyInterval) {
        clearInterval(profilePenaltyInterval);
        profilePenaltyInterval = null;
    }
}

function formatRemainingMs(ms) {
    if (ms <= 0) {
        return "0s";
    }
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts = [];
    if (h > 0) {
        parts.push(h + "h");
    }
    if (h > 0 || m > 0) {
        parts.push(m + "m");
    }
    parts.push(s + "s");
    return parts.join(" ");
}

function formatEndLocal(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        });
    } catch (e) {
        return iso;
    }
}

function applyStatusPanel(u, isOwnProfile) {
    const penalties =
        u.penalties !== undefined && u.penalties !== null ? Number(u.penalties) : 0;
    const until = u.eventRestrictionUntil;
    const endMs = until ? Date.parse(until) : NaN;
    const active =
        isOwnProfile && until && !isNaN(endMs) && endMs > Date.now();

    const titleEl = document.getElementById("statusTitle");
    const descEl = document.getElementById("statusDesc");
    const iconEl = document.getElementById("statusIcon");
    const panel = document.getElementById("statusPanel");
    const timerWrap = document.getElementById("statusTimerWrap");
    const timerEl = document.getElementById("statusTimer");
    const infoRestriction = document.getElementById("infoRestriction");

    clearProfilePenaltyInterval();

    if (!titleEl || !descEl || !panel) {
        return;
    }

    if (!isOwnProfile) {
        panel.classList.remove("status-warning");
        if (iconEl) {
            iconEl.textContent = "✓";
            iconEl.classList.remove("status-warn-icon");
        }
        if (timerWrap) {
            timerWrap.hidden = true;
        }
        if (timerEl) {
            timerEl.textContent = "—";
        }
        if (infoRestriction) {
            infoRestriction.textContent = "—";
        }
        if (penalties > 0) {
            titleEl.textContent = "Penalty points on record";
            descEl.textContent =
                "This account has " +
                penalties +
                " penalty point(s). Active restrictions are private.";
        } else {
            titleEl.textContent = "Good standing";
            descEl.textContent = "No penalty points on record.";
        }
        return;
    }

    if (active) {
        panel.classList.add("status-warning");
        if (iconEl) {
            iconEl.textContent = "!";
            iconEl.classList.add("status-warn-icon");
        }
        titleEl.textContent = "Event restriction active";
        descEl.textContent =
            "You cannot register for or create campus events until this restriction lifts (typically after a no-show).";
        if (timerWrap) {
            timerWrap.hidden = false;
        }
        if (infoRestriction) {
            infoRestriction.textContent = "Active until " + formatEndLocal(until);
        }

        const end = endMs;
        function tick() {
            const ms = end - Date.now();
            if (timerEl) {
                timerEl.textContent = formatRemainingMs(ms);
            }
            if (ms <= 0) {
                clearProfilePenaltyInterval();
                refreshOwnProfileFromServer();
            }
        }
        tick();
        profilePenaltyInterval = setInterval(tick, 1000);
    } else {
        panel.classList.remove("status-warning");
        if (iconEl) {
            iconEl.textContent = "✓";
            iconEl.classList.remove("status-warn-icon");
        }
        if (timerWrap) {
            timerWrap.hidden = true;
        }
        if (penalties > 0) {
            titleEl.textContent = "Account in good standing";
            descEl.textContent =
                "You have " +
                penalties +
                " penalty point(s) on record, but no active event restriction.";
        } else {
            titleEl.textContent = "Account in good standing";
            descEl.textContent = "No active penalties on record.";
        }
        if (infoRestriction) {
            infoRestriction.textContent = "None";
        }
    }
}

function refreshOwnProfileFromServer() {
    fetch(meApiUrl(), { credentials: "same-origin" })
        .then(function (res) {
            return res.json();
        })
        .then(function (u) {
            if (u && u.id !== undefined) {
                populateProfile(u, true);
                applyStatusPanel(u, true);
                try {
                    sessionStorage.setItem("user", JSON.stringify(u));
                } catch (e) {
                    /* ignore */
                }
            }
        })
        .catch(function () {
            /* ignore */
        });
}

if (!sessionUser) {
    window.location.href = "login.html";
} else {
    document.getElementById("sidebarUsername").textContent = sessionUser.username || "User";
    document.getElementById("sidebarInitials").textContent = getInitials(sessionUser.username);
}

const params = new URLSearchParams(window.location.search);
const viewingUserId = params.get("userId");
const isOwnProfile = !viewingUserId || (sessionUser && String(viewingUserId) === String(sessionUser.id));

let profileUserId = null;
let selectedRating = 0;

if (isOwnProfile) {
    fetch(typeof campusFitUrl === "function" ? campusFitUrl("api/profile") : "/CampusActivities/api/profile", {
        credentials: "same-origin"
    })
        .then(function(res) {
            if (res.status === 401) { window.location.href = "login.html"; return null; }
            return res.json();
        })
        .then(function(data) {
            if (!data || !data.success) return;
            profileUserId = data.user.id;
            populateProfile(data.user);
            applyStatusPanel(data.user, true);
            loadAvailability();
            loadProfileStats();
            document.getElementById("eventsJoinedCount").textContent = data.eventsJoined || 0;
            document.getElementById("ratingsReceivedCount").textContent = data.ratingCount || 0;
            document.getElementById("editProfileBtn").style.display = "inline-block";
            prefillEditForm(data.user);
            loadRatingDisplay(data.user.id);
            renderActivityHistory(data.activityHistory || []);
            loadHostAppeals();
        })
        .catch(function() {
            if (sessionUser) { populateProfile(sessionUser); applyStatusPanel(sessionUser, true); }
        });
} else {
    const availCard = document.getElementById("availabilityCard");
    if (availCard) availCard.hidden = true;
    const activityHistoryCard = document.getElementById("activityHistoryCard");
    if (activityHistoryCard) activityHistoryCard.style.display = "none";
    const hostAppealsCard = document.getElementById("hostAppealsCard");
    if (hostAppealsCard) hostAppealsCard.style.display = "none";
    profileUserId = parseInt(viewingUserId, 10);
    fetch((typeof campusFitUrl === "function" ? campusFitUrl("api/users") : "/CampusActivities/api/users") + "?id=" + viewingUserId, {
        credentials: "same-origin"
    })
        .then(function(res) {
            if (res.status === 404) { document.getElementById("profileUsername").textContent = "User not found"; return null; }
            return res.json();
        })
        .then(function(data) {
            if (data) {
                populateProfile(data.user || data);
                applyStatusPanel(data.user || data, false);
                loadRatingDisplay(profileUserId);
                if (sessionUser && sessionUser.id !== 0) {
                    document.getElementById("rateSection").style.display = "block";
                    loadExistingRating(profileUserId);
                }
            }
        })
        .catch(function() {
            document.getElementById("profileUsername").textContent = "Error loading profile";
        });
}

function loadRatingDisplay(userId) {
    fetch((typeof campusFitUrl === "function" ? campusFitUrl("api/ratings") : "/CampusActivities/api/ratings") + "?userId=" + userId, {
        credentials: "same-origin"
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data || !data.success) return;
            renderAvgRating(data.avgRating, data.ratingCount);
            document.getElementById("ratingsReceivedCount").textContent = data.ratingCount || 0;
        })
        .catch(function() {});
}

function loadExistingRating(userId) {
    fetch((typeof campusFitUrl === "function" ? campusFitUrl("api/ratings") : "/CampusActivities/api/ratings") + "?userId=" + userId, {
        credentials: "same-origin"
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.yourRating > 0) {
                setSelectedRating(data.yourRating);
            }
        })
        .catch(function() {});
}

function renderAvgRating(avg, count) {
    const starsEl = document.getElementById("avgRatingStars");
    const countEl = document.getElementById("ratingCountLabel");
    avg = parseFloat(avg) || 0;
    count = parseInt(count) || 0;

    let starsHtml = '<span class="avg-rating-val">' + (avg > 0 ? avg.toFixed(1) : "—") + '</span>';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= Math.round(avg) ? " filled" : "";
        starsHtml += '<span class="star' + filled + '">&#9733;</span>';
    }
    starsEl.innerHTML = starsHtml;
    countEl.textContent = count > 0
        ? count + " rating" + (count === 1 ? "" : "s")
        : "No ratings yet.";
}

// Interactive star picker for rating submission
document.getElementById("rateStars").addEventListener("mouseover", function(e) {
    if (!e.target.classList.contains("star")) return;
    const val = parseInt(e.target.dataset.val);
    highlightStars(val);
});

document.getElementById("rateStars").addEventListener("mouseout", function() {
    highlightStars(selectedRating);
});

document.getElementById("rateStars").addEventListener("click", function(e) {
    if (!e.target.classList.contains("star")) return;
    setSelectedRating(parseInt(e.target.dataset.val));
});

function setSelectedRating(val) {
    selectedRating = val;
    highlightStars(val);
}

function highlightStars(val) {
    document.querySelectorAll("#rateStars .star").forEach(function(star) {
        star.classList.toggle("filled", parseInt(star.dataset.val) <= val);
    });
}

function submitRating() {
    if (selectedRating === 0) {
        showRateMsg("Please select a star rating first.", "error");
        return;
    }
    const btn = document.getElementById("rateSubmitBtn");
    btn.disabled = true;

    const params = new URLSearchParams({ rateeId: profileUserId, score: selectedRating });
    fetch(typeof campusFitUrl === "function" ? campusFitUrl("api/ratings") : "/CampusActivities/api/ratings", {
        method: "POST",
        body: params,
        credentials: "same-origin"
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                showRateMsg("Rating submitted!", "success");
                renderAvgRating(data.newAvgRating, data.ratingCount);
                document.getElementById("ratingsReceivedCount").textContent = data.ratingCount || 0;
            } else {
                showRateMsg(data.message || "Failed to submit rating.", "error");
                btn.disabled = false;
            }
        })
        .catch(function() {
            showRateMsg("Connection error. Please try again.", "error");
            btn.disabled = false;
        });
}

function showRateMsg(text, type) {
    const el = document.getElementById("rateMsg");
    el.textContent = text;
    el.className = "rate-msg " + type;
}

function populateProfile(user, fromServer) {
    const username = user.username || "User";
    const email = user.email || "No email available";
    const skillLevel = user.skill_level || user.skillLevel || "Student";
    const penalties =
        user.penalties !== undefined && user.penalties !== null ? Number(user.penalties) : 0;
    const interests = parseInterests(user.interests);
    const avgRating = parseFloat(user.avgRating) || 0;

    document.getElementById("profileUsername").textContent = username;
    document.getElementById("infoUsername").textContent = username;
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("infoEmail").textContent = email;
    document.getElementById("profileSkillLevel").textContent = skillLevel;
    document.getElementById("infoSkillLevel").textContent = skillLevel;
    document.getElementById("infoPenalties").textContent = penalties;
    document.getElementById("profileInitials").textContent = getInitials(username);

    renderInterests(interests);
    renderPreferredLocations(user.preferredLocations);

    const statusBox = document.getElementById("statusBox");
    if (statusBox && penalties > 0) {
        statusBox.innerHTML = `
            <div class="status-check" style="background:#e05252;">!</div>
            <div>
                <strong>Active penalties: ${penalties}</strong>
                <p>This account has penalty points on record.</p>
            </div>`;
    }
}

const KNOWN_FACILITIES = ["Lyon Center", "USC Village Fitness Center", "Uytengsu Aquatics Center", "HSC Fitness Center", "PED South Gym"];

function toggleLocDropdown() {
    const panel = document.getElementById("locDropdownPanel");
    const arrow = document.getElementById("locDropdownArrow");
    if (!panel) return;
    const open = panel.classList.toggle("open");
    if (arrow) arrow.textContent = open ? "▲" : "▼";
}

function updateLocDropdownLabel() {
    const selected = [];
    document.querySelectorAll(".loc-cb").forEach(function(cb) {
        if (cb.checked) selected.push(cb.value);
    });
    const otherCheck = document.getElementById("otherLocationCheck");
    const otherText = document.getElementById("otherLocationText");
    if (otherCheck && otherCheck.checked && otherText && otherText.value.trim()) {
        selected.push("Other");
    }
    const label = document.getElementById("locDropdownLabel");
    if (label) label.textContent = selected.length > 0 ? selected.join(", ") : "Choose locations";
}

document.addEventListener("click", function(e) {
    const wrapper = document.querySelector(".loc-dropdown-wrapper");
    if (wrapper && !wrapper.contains(e.target)) {
        const panel = document.getElementById("locDropdownPanel");
        const arrow = document.getElementById("locDropdownArrow");
        if (panel) panel.classList.remove("open");
        if (arrow) arrow.textContent = "▼";
    }
});

document.querySelectorAll(".loc-cb").forEach(function(cb) {
    cb.addEventListener("change", updateLocDropdownLabel);
});

const otherCheckEl = document.getElementById("otherLocationCheck");
if (otherCheckEl) {
    otherCheckEl.addEventListener("change", function() {
        const otherText = document.getElementById("otherLocationText");
        otherText.style.display = this.checked ? "block" : "none";
        if (!this.checked) otherText.value = "";
        updateLocDropdownLabel();
    });
}

const otherTextEl = document.getElementById("otherLocationText");
if (otherTextEl) otherTextEl.addEventListener("input", updateLocDropdownLabel);

function prefillEditForm(user) {
    const storedInterests = parseInterests(user.interests).map(function(i) { return i.toLowerCase(); });
    document.querySelectorAll(".interest-cb").forEach(function(cb) {
        cb.checked = storedInterests.includes(cb.value);
    });
    const skillLevel = user.skill_level || user.skillLevel || "beginner";
    const select = document.getElementById("editSkillLevel");
    for (let opt of select.options) {
        if (opt.value === skillLevel) { opt.selected = true; break; }
    }

    const existing = (user.preferredLocations || "").split(",").map(function(l) { return l.trim(); }).filter(Boolean);
    const otherValues = [];

    document.querySelectorAll(".loc-cb").forEach(function(cb) {
        cb.checked = existing.includes(cb.value);
    });

    existing.forEach(function(loc) {
        if (!KNOWN_FACILITIES.includes(loc)) otherValues.push(loc);
    });

    const otherCheck = document.getElementById("otherLocationCheck");
    const otherText = document.getElementById("otherLocationText");
    if (otherValues.length > 0) {
        otherCheck.checked = true;
        otherText.style.display = "block";
        otherText.value = otherValues.join(", ");
    } else {
        otherCheck.checked = false;
        otherText.style.display = "none";
        otherText.value = "";
    }
    updateLocDropdownLabel();
}

function getSelectedInterests() {
    const selected = [];
    document.querySelectorAll(".interest-cb").forEach(function(cb) {
        if (cb.checked) selected.push(cb.value);
    });
    return selected.join(",");
}

function getSelectedLocations() {
    const selected = [];
    document.querySelectorAll(".loc-cb").forEach(function(cb) {
        if (cb.checked) selected.push(cb.value);
    });
    const otherCheck = document.getElementById("otherLocationCheck");
    const otherText = document.getElementById("otherLocationText");
    if (otherCheck && otherCheck.checked && otherText && otherText.value.trim()) {
        otherText.value.trim().split(",").forEach(function(v) {
            const t = v.trim();
            if (t) selected.push(t);
        });
    }
    return selected.join(", ");
}

function toggleEditForm() {
    const form = document.getElementById("editProfileForm");
    form.classList.toggle("open");
    document.getElementById("editMsg").className = "edit-msg";
    document.getElementById("editSecurityAnswer").value = "";
    document.getElementById("editSecurityQuestion").value = "";
}

function submitEditProfile(event) {
    event.preventDefault();
    const msgEl = document.getElementById("editMsg");
    msgEl.className = "edit-msg";

    const body = new URLSearchParams({
        interests: getSelectedInterests(),
        skillLevel: document.getElementById("editSkillLevel").value,
        preferredLocations: getSelectedLocations(),
        securityQuestion: document.getElementById("editSecurityQuestion").value,
        securityAnswer: document.getElementById("editSecurityAnswer").value.trim()
    });

    fetch(typeof campusFitUrl === "function" ? campusFitUrl("api/profile") : "/CampusActivities/api/profile", {
        method: "POST",
        body: body,
        credentials: "same-origin"
    })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                msgEl.textContent = "Profile updated!";
                msgEl.className = "edit-msg success";
                if (data.user) {
                    sessionStorage.setItem("user", JSON.stringify(data.user));
                    populateProfile(data.user);
                    prefillEditForm(data.user);
                }
                setTimeout(function() { toggleEditForm(); }, 1500);
            } else {
                msgEl.textContent = data.message || "Failed to update profile.";
                msgEl.className = "edit-msg error";
            }
        })
        .catch(function() {
            msgEl.textContent = "Connection error. Please try again.";
            msgEl.className = "edit-msg error";
        });
}

function parseInterests(interests) {
    if (!interests) return [];
    if (Array.isArray(interests)) return interests;
    return String(interests).split(",").map(function(i) { return i.trim(); }).filter(function(i) { return i.length > 0; });
}

function renderInterests(interests) {
    const el = document.getElementById("interestTags");
    if (!interests || interests.length === 0) {
        el.innerHTML = `<span class="empty-text">No interests added yet.</span>`;
        return;
    }
    el.innerHTML = interests.map(function(i) { return `<span class="interest-tag">${escapeHtml(i)}</span>`; }).join("");
}

function renderPreferredLocations(locString) {
    const el = document.getElementById("preferredLocationTags");
    if (!el) return;
    const locs = (locString || "").split(",").map(function(l) { return l.trim(); }).filter(Boolean);
    if (locs.length === 0) {
        el.innerHTML = `<span class="empty-text">No preferred locations set.</span>`;
        return;
    }
    el.innerHTML = locs.map(function(l) { return `<span class="interest-tag">${escapeHtml(l)}</span>`; }).join("");
}

function getInitials(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function profileStatsUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/stats") : "api/stats";
}

function loadProfileStats() {
    fetch(profileStatsUrl(), { credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var el = document.getElementById("summaryEventsJoined");
            if (el) el.textContent = data.eventsJoined;
            el = document.getElementById("summaryMatches");
            if (el) el.textContent = data.matchesFound;
            el = document.getElementById("summaryReviews");
            if (el) el.textContent = data.reviewsCount;
        })
        .catch(function () { /* non-critical */ });
}

function availUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("availability") : "availability";
}

function loadAvailability() {
    fetch(availUrl(), { credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (slots) { renderAvailability(slots); })
        .catch(function () { renderAvailability([]); });
}

var AVAIL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function renderBlock(start, end) {
    return (
        '<div class="avail-block">' +
            '<input type="time" class="avail-start" value="' + start + '">' +
            '<span class="avail-to">to</span>' +
            '<input type="time" class="avail-end" value="' + end + '">' +
            '<button type="button" class="avail-remove-btn">×</button>' +
        '</div>'
    );
}

function renderAvailability(saved) {
    var grid = document.getElementById("availGrid");
    if (!grid) return;

    var savedMap = {};
    AVAIL_DAYS.forEach(function (day) { savedMap[day] = []; });
    (saved || []).forEach(function (s) {
        if (savedMap[s.day]) savedMap[s.day].push(s);
    });

    grid.innerHTML = AVAIL_DAYS.map(function (day) {
        var slots = savedMap[day];
        var checked = slots.length > 0 ? "checked" : "";
        var hidden = slots.length > 0 ? "" : "avail-blocks-hidden";
        var blocksHtml = (slots.length > 0 ? slots : [{ startTime: "", endTime: "" }])
            .map(function (s) { return renderBlock(s.startTime || "", s.endTime || ""); })
            .join("");
        return (
            '<div class="avail-row">' +
                '<label class="avail-day-label">' +
                    '<input type="checkbox" id="avail-cb-' + day + '" ' + checked + '>' +
                    '<span>' + day + '</span>' +
                '</label>' +
                '<div class="avail-blocks-wrap ' + hidden + '" id="avail-wrap-' + day + '">' +
                    '<div class="avail-blocks" id="avail-blocks-' + day + '">' + blocksHtml + '</div>' +
                    '<button type="button" class="add-block-btn" data-day="' + day + '">+ Add time block</button>' +
                '</div>' +
            '</div>'
        );
    }).join("");

    bindAvailabilityForm();
}

function bindAvailabilityForm() {
    AVAIL_DAYS.forEach(function (day) {
        var cb = document.getElementById("avail-cb-" + day);
        var wrap = document.getElementById("avail-wrap-" + day);
        if (!cb || !wrap) return;
        cb.addEventListener("change", function () {
            wrap.classList.toggle("avail-blocks-hidden", !cb.checked);
        });
    });

    var grid = document.getElementById("availGrid");
    if (grid) {
        grid.addEventListener("click", function (e) {
            if (e.target.classList.contains("add-block-btn")) {
                var day = e.target.getAttribute("data-day");
                var list = document.getElementById("avail-blocks-" + day);
                if (list) list.insertAdjacentHTML("beforeend", renderBlock("", ""));
            }
            if (e.target.classList.contains("avail-remove-btn")) {
                var block = e.target.closest(".avail-block");
                var list = block ? block.parentElement : null;
                if (!block || !list) return;
                if (list.querySelectorAll(".avail-block").length > 1) {
                    block.remove();
                } else {
                    block.querySelectorAll("input[type='time']").forEach(function (inp) { inp.value = ""; });
                }
            }
        });
    }

    var saveBtn = document.getElementById("saveAvailBtn");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", async function () {
        saveBtn.disabled = true;
        try {
            var res = await saveAvailability();
            var data = await res.json();
            showAvailMsg(data.success ? "Saved!" : (data.message || "Error saving."), data.success);
        } catch (e) {
            showAvailMsg("Error saving availability.", false);
        }
        saveBtn.disabled = false;
    });
}

function showAvailMsg(text, ok) {
    var el = document.getElementById("availMsg");
    if (!el) return;
    el.textContent = text;
    el.className = "avail-msg " + (ok ? "avail-msg-ok" : "avail-msg-err");
    setTimeout(function () { el.textContent = ""; el.className = "avail-msg"; }, 3000);
}

function saveAvailability() {
    var slots = [];

    AVAIL_DAYS.forEach(function (day) {
        var cb = document.getElementById("avail-cb-" + day);
        if (!cb || !cb.checked) return;
        var list = document.getElementById("avail-blocks-" + day);
        if (!list) return;
        list.querySelectorAll(".avail-block").forEach(function (block) {
            var start = block.querySelector(".avail-start").value;
            var end = block.querySelector(".avail-end").value;
            if (!start || !end || start >= end) return;
            slots.push({ day: day, startTime: start, endTime: end });
        });
    });

    return fetch(availUrl(), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slots)
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

var cachedActivityHistory = [];

function appealsApiUrl(queryString) {
    var base = typeof campusFitUrl === "function" ? campusFitUrl("api/appeals") : "/CampusActivities/api/appeals";
    return queryString ? base + "?" + queryString : base;
}

function formatScheduleRange(dateStr, timeStr, endTimeStr) {
    if (!dateStr) {
        return "";
    }
    try {
        var timePart = timeStr || "00:00:00";
        var start = new Date(dateStr + "T" + timePart);
        var startFormatted = start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        if (!endTimeStr) {
            return startFormatted;
        }
        var endShort = String(endTimeStr).substring(0, 5);
        return startFormatted + " – ends " + endShort;
    } catch (e) {
        return dateStr + " " + (timeStr || "");
    }
}

function renderActivityHistory(items) {
    cachedActivityHistory = items || [];
    var listEl = document.getElementById("activityHistoryList");
    var card = document.getElementById("activityHistoryCard");
    if (!listEl || !card) {
        return;
    }
    card.style.display = "block";
    if (!cachedActivityHistory.length) {
        listEl.innerHTML = '<p class="empty-text">No events yet.</p>';
        return;
    }
    listEl.innerHTML = cachedActivityHistory.map(function (row) {
        var isHost = row.role && String(row.role).toUpperCase() === "HOST";
        var attLabel = "";
        var attPillClass = "pill-present";
        if (isHost) {
            attLabel = "Host";
            attPillClass = "pill-host";
        } else if (!row.eventEnded) {
            attLabel = "Upcoming";
            attPillClass = "pill-participant";
        } else if (row.present === true) {
            attLabel = "Present";
            attPillClass = "pill-present";
        } else if (row.present === false) {
            attLabel = "Absent";
            attPillClass = "pill-absent";
        } else {
            attLabel = "Not marked";
            attPillClass = "pill-pending";
        }
        var appealPill = "";
        if (row.appealStatus) {
            var st = String(row.appealStatus).toUpperCase();
            if (st === "PENDING") {
                appealPill = '<span class="pill pill-pending">Appeal pending</span>';
            } else if (st === "DENIED") {
                appealPill = '<span class="pill pill-denied">Appeal denied</span>';
            } else if (st === "GRANTED") {
                appealPill = '<span class="pill pill-granted">Appeal granted</span>';
            }
        }
        var rolePill = isHost
            ? '<span class="pill pill-host">Host</span>'
            : '<span class="pill pill-participant">Joined</span>';
        var appealBtn = (!isHost && row.canAppeal)
            ? '<button type="button" class="btn-appeal" onclick="openAppealPage(' + row.eventId + ')">Appeal penalty</button>'
            : "";
        return (
            '<div class="activity-row">' +
                '<div class="activity-row-main">' +
                    '<p class="activity-row-title">' + escapeHtml(row.activityType || "Event") + "</p>" +
                    '<p class="activity-row-meta">' +
                        escapeHtml(row.location || "") +
                        "<br>" +
                        escapeHtml(formatScheduleRange(row.date, row.time, row.endTime)) +
                    "</p>" +
                    '<div class="activity-badges" style="margin-top:8px;">' +
                        rolePill +
                        '<span class="pill ' +
                        attPillClass +
                        '">' +
                        escapeHtml(attLabel) +
                        "</span>" +
                        appealPill +
                    "</div></div>" +
                    "<div>" +
                    appealBtn +
                    "</div></div>"
        );
    }).join("");
}

function openAppealPage(eventId) {
    var row = cachedActivityHistory.find(function (r) {
        return r.eventId === eventId;
    });
    try {
        if (row) {
            sessionStorage.setItem("appealEventMeta", JSON.stringify(row));
        }
    } catch (e) {
        /* ignore */
    }
    var url =
        typeof campusFitUrl === "function"
            ? campusFitUrl("appeal.html?eventId=" + eventId)
            : "/CampusActivities/appeal.html?eventId=" + eventId;
    window.location.href = url;
}

function loadHostAppeals() {
    fetch(appealsApiUrl("forHost=true"), { credentials: "same-origin" })
        .then(function (res) {
            return res.json();
        })
        .then(function (data) {
            if (!data || !data.success) {
                return;
            }
            renderHostAppeals(data.appeals || []);
        })
        .catch(function () {});
}

var pendingAppealReviewId = null;

function renderHostAppeals(appeals) {
    var card = document.getElementById("hostAppealsCard");
    var listEl = document.getElementById("hostAppealsList");
    var emptyEl = document.getElementById("hostAppealsEmpty");
    if (!card || !listEl) {
        return;
    }
    card.style.display = "block";
    if (!appeals.length) {
        listEl.innerHTML = "";
        if (emptyEl) {
            emptyEl.style.display = "block";
        }
        return;
    }
    if (emptyEl) {
        emptyEl.style.display = "none";
    }
    listEl.innerHTML = appeals
        .map(function (a) {
            var sub =
                escapeHtml(a.activityType || "") +
                " · " +
                escapeHtml(a.location || "") +
                " · " +
                escapeHtml(formatScheduleRange(a.date, a.time, null));
            return (
                '<div class="appeal-review-row">' +
                    "<div><strong>" +
                    escapeHtml(a.appellantUsername || "User") +
                    "</strong>" +
                    '<p style="margin:4px 0 0;font-size:13px;color:#666;">' +
                    sub +
                    "</p></div>" +
                    '<button type="button" class="btn-review-appeal" data-appeal-id="' +
                    a.id +
                    '">Review</button></div>'
            );
        })
        .join("");
    listEl.querySelectorAll(".btn-review-appeal").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var id = parseInt(btn.getAttribute("data-appeal-id"), 10);
            var rec = appeals.find(function (x) {
                return x.id === id;
            });
            openAppealReviewModal(rec);
        });
    });
}

function openAppealReviewModal(a) {
    if (!a) {
        return;
    }
    pendingAppealReviewId = a.id;
    document.getElementById("appealReviewSub").textContent =
        (a.appellantUsername || "User") +
        " · " +
        (a.activityType || "") +
        " (" +
        formatScheduleRange(a.date, a.time, null) +
        ")";
    document.getElementById("appealReviewMessage").textContent = a.message || "";
    var msgEl = document.getElementById("appealReviewMsg");
    msgEl.textContent = "";
    msgEl.className = "edit-msg";
    msgEl.style.display = "none";
    document.getElementById("appealReviewModal").hidden = false;
}

function closeAppealReviewModal() {
    pendingAppealReviewId = null;
    document.getElementById("appealReviewModal").hidden = true;
}

function submitAppealReview(decision) {
    if (!pendingAppealReviewId) {
        return;
    }
    var msgEl = document.getElementById("appealReviewMsg");
    var params = new URLSearchParams({
        appealId: String(pendingAppealReviewId),
        decision: decision
    });
    var reviewUrl =
        typeof campusFitUrl === "function"
            ? campusFitUrl("api/appeals/review")
            : "/CampusActivities/api/appeals/review";
    fetch(reviewUrl, {
        method: "POST",
        body: params,
        credentials: "same-origin"
    })
        .then(function (res) {
            return res.json();
        })
        .then(function (data) {
            if (data.success) {
                closeAppealReviewModal();
                loadHostAppeals();
                refreshOwnProfileFromServer();
                fetch(
                    typeof campusFitUrl === "function"
                        ? campusFitUrl("api/profile")
                        : "/CampusActivities/api/profile",
                    { credentials: "same-origin" }
                )
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (d) {
                        if (d && d.success && d.activityHistory) {
                            renderActivityHistory(d.activityHistory);
                        }
                    })
                    .catch(function () {});
            } else {
                msgEl.textContent = data.message || "Could not save.";
                msgEl.className = "edit-msg error";
                msgEl.style.display = "block";
            }
        })
        .catch(function () {
            msgEl.textContent = "Connection error.";
            msgEl.className = "edit-msg error";
            msgEl.style.display = "block";
        });
}

var appealModalCancel = document.getElementById("appealModalCancel");
if (appealModalCancel) {
    appealModalCancel.addEventListener("click", closeAppealReviewModal);
}
var appealBtnPresent = document.getElementById("appealBtnPresent");
if (appealBtnPresent) {
    appealBtnPresent.addEventListener("click", function () {
        submitAppealReview("present");
    });
}
var appealBtnAbsent = document.getElementById("appealBtnAbsent");
if (appealBtnAbsent) {
    appealBtnAbsent.addEventListener("click", function () {
        submitAppealReview("absent");
    });
}
var appealReviewModal = document.getElementById("appealReviewModal");
if (appealReviewModal) {
    appealReviewModal.addEventListener("click", function (e) {
        if (e.target.id === "appealReviewModal") {
            closeAppealReviewModal();
        }
    });
}
