const user = JSON.parse(sessionStorage.getItem("user"));

let dashboardPenaltyInterval = null;

function meApiUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/users?me=true") : "api/users?me=true";
}

function clearDashboardPenaltyInterval() {
    if (dashboardPenaltyInterval) {
        clearInterval(dashboardPenaltyInterval);
        dashboardPenaltyInterval = null;
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

function applyPenaltyDashboard(u) {
    const penalties =
        u.penalties !== undefined && u.penalties !== null ? Number(u.penalties) : 0;
    const until = u.eventRestrictionUntil;
    const endMs = until ? Date.parse(until) : NaN;
    const active = until && !isNaN(endMs) && endMs > Date.now();

    const statVal = document.getElementById("statPenaltyValue");
    const statSub = document.getElementById("statPenaltySub");
    const card = document.getElementById("statPenaltyCard");
    const mini = document.getElementById("profilePenaltyMini");
    const recentBody = document.getElementById("recentPenaltiesBody");

    if (statVal) {
        statVal.textContent = String(penalties);
    }
    if (mini) {
        mini.textContent = String(penalties);
    }

    if (statSub && card) {
        if (active) {
            statSub.textContent = "Active restriction — cannot join or create events";
            card.classList.add("stat-card-warn");
        } else {
            statSub.textContent =
                penalties > 0 ? "No active timer (recorded points only)" : "All clear";
            card.classList.remove("stat-card-warn");
        }
    }

    clearDashboardPenaltyInterval();
    if (!recentBody) {
        return;
    }

    if (active) {
        recentBody.innerHTML =
            '<div class="penalty-active">' +
            '<div class="penalty-active-title">No-show event restriction</div>' +
            '<p class="penalty-active-desc">Joining and creating events is blocked until this timer ends.</p>' +
            '<div class="penalty-timer-label">Time remaining</div>' +
            '<div class="penalty-timer" id="dashboardPenaltyTimer">—</div>' +
            "</div>";

        const end = endMs;
        function tick() {
            const el = document.getElementById("dashboardPenaltyTimer");
            const ms = end - Date.now();
            if (el) {
                el.textContent = formatRemainingMs(ms);
            }
            if (ms <= 0) {
                clearDashboardPenaltyInterval();
                loadDashboardPenaltyInfo();
            }
        }
        tick();
        dashboardPenaltyInterval = setInterval(tick, 1000);
    } else if (penalties > 0) {
        recentBody.innerHTML =
            '<div class="penalty-record-only">' +
            '<div class="penalty-record-title">Penalty points on file</div>' +
            "<p>" +
            penalties +
            " total — no active event restriction right now.</p>" +
            "</div>";
    } else {
        recentBody.innerHTML =
            '<div class="penalty-empty-state">' +
            '<div class="penalty-check">✓</div>' +
            "<div>No penalties on record</div>" +
            "</div>";
    }
}

function loadDashboardPenaltyInfo() {
    fetch(meApiUrl(), { credentials: "same-origin" })
        .then(function (res) {
            if (res.status === 401) {
                window.location.href = "login.html";
                return null;
            }
            return res.json();
        })
        .then(function (u) {
            if (u && u.id !== undefined) {
                applyPenaltyDashboard(u);
                try {
                    sessionStorage.setItem("user", JSON.stringify(u));
                } catch (e) {
                    /* ignore */
                }
            }
        })
        .catch(function () {
            const statVal = document.getElementById("statPenaltyValue");
            const statSub = document.getElementById("statPenaltySub");
            const recentBody = document.getElementById("recentPenaltiesBody");
            if (statVal) {
                statVal.textContent = "—";
            }
            if (statSub) {
                statSub.textContent = "Could not load";
            }
            if (recentBody) {
                recentBody.innerHTML =
                    '<div class="penalty-loading error">Could not load penalty info.</div>';
            }
        });
}

if (!user) {
    window.location.href = "login.html";
} else {
    const username = user.username || "User";

    document.getElementById("username").textContent = username;

    const sidebarUsername = document.getElementById("sidebarUsername");
    if (sidebarUsername) {
        sidebarUsername.textContent = username;
    }

    const profileNameLarge = document.getElementById("profileNameLarge");
    if (profileNameLarge) {
        profileNameLarge.textContent = username;
    }

    const initials = getInitials(username);

    const sidebarInitials = document.getElementById("sidebarInitials");
    if (sidebarInitials) {
        sidebarInitials.textContent = initials;
    }

    const profileInitials = document.getElementById("profileInitials");
    if (profileInitials) {
        profileInitials.textContent = initials;
    }

    loadDashboardPenaltyInfo();
    loadUpcomingEvents();
    loadStats();
    loadSuggestedMatches();
    loadFacilitiesPreview();
}

function upcomingEventsUrl() {
    return typeof campusFitUrl === "function"
        ? campusFitUrl("upcomingEvents?limit=8")
        : "upcomingEvents?limit=8";
}

function escapeHtmlDash(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function loadUpcomingEvents() {
    const body = document.getElementById("upcomingEventsBody");
    if (!body) {
        return;
    }

    fetch(upcomingEventsUrl(), { credentials: "same-origin" })
        .then(function (res) {
            if (res.status === 401) {
                window.location.href = "login.html";
                return null;
            }
            return res.json();
        })
        .then(function (events) {
            if (!body) {
                return;
            }
            if (!events || !Array.isArray(events) || events.length === 0) {
                body.innerHTML =
                    '<div class="empty-state empty-state--compact">' +
                    '<div class="empty-icon">📅</div>' +
                    "<h4>No upcoming events</h4>" +
                    "<p>Browse activities or create an event to see it here.</p>" +
                    "</div>";
                return;
            }

            body.innerHTML = events
                .map(function (ev) {
                    const when =
                        escapeHtmlDash(ev.date || "") + " · " + escapeHtmlDash(ev.time || "");
                    return (
                        '<div class="upcoming-row">' +
                        '<div class="upcoming-row-main">' +
                        '<div class="upcoming-title">' +
                        escapeHtmlDash(ev.activityType || "Event") +
                        "</div>" +
                        '<div class="upcoming-meta">' +
                        escapeHtmlDash(ev.location || "") +
                        "</div>" +
                        '<div class="upcoming-when">' +
                        when +
                        "</div>" +
                        "</div>" +
                        "</div>"
                    );
                })
                .join("");
        })
        .catch(function () {
            body.innerHTML =
                '<div class="upcoming-error">Could not load upcoming events.</div>';
        });
}

function statsUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/stats") : "api/stats";
}

function loadStats() {
    fetch(statsUrl(), { credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var joined = data.eventsJoined;
            var matches = data.matchesFound;
            var reviews = data.reviewsCount;

            var el = document.getElementById("statEventsJoined");
            if (el) el.textContent = joined;
            var sub = document.getElementById("statEventsJoinedSub");
            if (sub) sub.textContent = joined === 1 ? "1 event joined" : joined + " events joined";

            el = document.getElementById("statMatchesFound");
            if (el) el.textContent = matches;
            sub = document.getElementById("statMatchesFoundSub");
            if (sub) sub.textContent = matches === 1 ? "1 match found" : matches + " matches found";

            el = document.getElementById("profileEventsMini");
            if (el) el.textContent = joined;
            el = document.getElementById("profileMatchesMini");
            if (el) el.textContent = matches;

            el = document.getElementById("statReviews");
            if (el) el.textContent = reviews;
            sub = document.getElementById("statReviewsSub");
            if (sub) sub.textContent = reviews === 1 ? "1 review left" : reviews + " reviews left";
        })
        .catch(function () { /* silently fail — stats are non-critical */ });
}

function matchesApiUrl() {
    return typeof campusFitUrl === "function" ? campusFitUrl("api/matches") : "api/matches";
}

function loadSuggestedMatches() {
    var body = document.getElementById("suggestedMatchesBody");
    if (!body) return;

    fetch(matchesApiUrl(), { credentials: "same-origin" })
        .then(function (res) {
            if (res.status === 401) { window.location.href = "login.html"; return null; }
            return res.json();
        })
        .then(function (data) {
            if (!data || data.length === 0) return;
            var preview = data.slice(0, 2);
            body.innerHTML = preview.map(buildSuggestedMatchRow).join("");
        })
        .catch(function () { /* leave default empty state */ });
}

function loadFacilitiesPreview() {
    var body = document.getElementById("facilitiesCardBody");
    if (!body) return;

    var url = typeof campusFitUrl === "function" ? campusFitUrl("api/locations") : "api/locations";
    fetch(url, { credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (!data || data.length === 0) return;
            body.innerHTML = data.slice(0, 4).map(function (f) {
                var reviewCount = Number(f.reviewCount || 0);
                var ratingHtml;
                if (reviewCount === 0) {
                    ratingHtml = '<div style="color:#7a7a7a;font-size:12px;font-style:italic;">No reviews yet</div>';
                } else {
                    var stars = Math.round(Number(f.averageRating || 0));
                    var starStr = "★".repeat(stars) + "☆".repeat(5 - stars);
                    ratingHtml = '<div class="facility-stars">' + starStr + '</div>';
                }
                return '<div class="facility-row">' +
                    '<div class="facility-left"><div>' +
                    '<div class="row-title">' + escapeHtmlDash(f.name) + '</div>' +
                    ratingHtml +
                    '</div></div>' +
                    '<span class="status-pill">Open</span>' +
                    '</div>';
            }).join("");
        })
        .catch(function () { /* leave default */ });
}

function buildSuggestedMatchRow(match) {
    var initials = getInitials(match.username || "?");
    var score = match.matchScore || 0;
    var skill = match.skillLevel ? match.skillLevel.charAt(0).toUpperCase() + match.skillLevel.slice(1).toLowerCase() : "";
    var firstInterest = match.interests ? match.interests.split(",")[0].trim() : "";
    var meta = [skill, firstInterest].filter(Boolean).join(" · ");
    return (
        '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border,#eee)">' +
            '<div style="width:36px;height:36px;border-radius:50%;background:#992233;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0">' + escapeHtmlDash(initials) + '</div>' +
            '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtmlDash(match.username || "") + '</div>' +
                '<div style="font-size:12px;color:#666">' + escapeHtmlDash(meta) + '</div>' +
            '</div>' +
            '<div style="font-weight:700;color:#992233;font-size:14px;flex-shrink:0">' + score + '%</div>' +
        '</div>'
    );
}

function getInitials(name) {
    const parts = String(name).trim().split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[1][0]).toUpperCase();
}
