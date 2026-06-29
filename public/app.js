const state = {
    user: null,
    agents: [],
    maps: [],
    players: [],
    mySelectedAgents: [],
    myPreferredMaps: [],
    myPreferences: []
};

const roles = ["Controller", "Sentinel", "Initiator", "Duelist"];

const els = {
    authScreen: document.getElementById("authScreen"),
    appScreen: document.getElementById("appScreen"),
    loginTab: document.getElementById("loginTab"),
    registerTab: document.getElementById("registerTab"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    registerDisplayName: document.getElementById("registerDisplayName"),
    registerUsername: document.getElementById("registerUsername"),
    registerPassword: document.getElementById("registerPassword"),
    authError: document.getElementById("authError"),
    userLine: document.getElementById("userLine"),
    logoutBtn: document.getElementById("logoutBtn"),
    teamStatus: document.getElementById("teamStatus"),
    captainCheck: document.getElementById("captainCheck"),
    saveRosterBtn: document.getElementById("saveRosterBtn"),
    agentPicker: document.getElementById("agentPicker"),
    selectedAgentBadge: document.getElementById("selectedAgentBadge"),
    saveAgentsBtn: document.getElementById("saveAgentsBtn"),
    preferredMapPicker: document.getElementById("preferredMapPicker"),
    savePreferredMapsBtn: document.getElementById("savePreferredMapsBtn"),
    preferenceForm: document.getElementById("preferenceForm"),
    preferenceAgent: document.getElementById("preferenceAgent"),
    preferenceRating: document.getElementById("preferenceRating"),
    preferenceMaps: document.getElementById("preferenceMaps"),
    preferenceNotes: document.getElementById("preferenceNotes"),
    preferencesList: document.getElementById("preferencesList"),
    mapForm: document.getElementById("mapForm"),
    mapId: document.getElementById("mapId"),
    mapName: document.getElementById("mapName"),
    mapNotes: document.getElementById("mapNotes"),
    saveMapBtn: document.getElementById("saveMapBtn"),
    cancelMapBtn: document.getElementById("cancelMapBtn"),
    mapsList: document.getElementById("mapsList"),
    teamMap: document.getElementById("teamMap"),
    generateBtn: document.getElementById("generateBtn"),
    teamPlan: document.getElementById("teamPlan"),
    playersList: document.getElementById("playersList"),
    confirmOverlay: document.getElementById("confirmOverlay"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmCancel: document.getElementById("confirmCancel"),
    confirmAccept: document.getElementById("confirmAccept"),
    toast: document.getElementById("toast")
};

boot();

async function boot() {
    bindEvents();
    const me = await api("/api/auth/me", "GET", null, false);

    if (me.user) {
        await loadApp();
    } else {
        showAuth();
    }
}

function bindEvents() {
    els.loginTab.addEventListener("click", () => setAuthTab("login"));
    els.registerTab.addEventListener("click", () => setAuthTab("register"));
    els.loginForm.addEventListener("submit", login);
    els.registerForm.addEventListener("submit", register);
    els.logoutBtn.addEventListener("click", logout);
    els.saveRosterBtn.addEventListener("click", saveRosterStatus);
    els.saveAgentsBtn.addEventListener("click", saveSelectedAgents);
    els.savePreferredMapsBtn.addEventListener("click", savePreferredMaps);
    els.preferenceForm.addEventListener("submit", savePreference);
    els.mapForm.addEventListener("submit", saveMap);
    els.cancelMapBtn.addEventListener("click", resetMapForm);
    els.generateBtn.addEventListener("click", generateTeamPlan);
    els.confirmOverlay.addEventListener("click", event => {
        if (event.target === els.confirmOverlay) closeConfirm(false);
    });
}

async function api(url, method = "GET", body = null, showErrors = true) {
    const options = {
        method,
        headers: {}
    };

    if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data.error || "Something went wrong";
        if (showErrors) toast(message);
        throw new Error(message);
    }

    return data;
}

function setAuthTab(tab) {
    const login = tab === "login";
    els.loginTab.classList.toggle("active", login);
    els.registerTab.classList.toggle("active", !login);
    els.loginForm.classList.toggle("hidden", !login);
    els.registerForm.classList.toggle("hidden", login);
    els.authError.classList.add("hidden");
}

async function login(event) {
    event.preventDefault();
    try {
        await api("/api/auth/login", "POST", {
            username: els.loginUsername.value,
            password: els.loginPassword.value
        }, false);
        await loadApp();
    } catch (error) {
        showAuthError(error.message);
    }
}

async function register(event) {
    event.preventDefault();
    try {
        await api("/api/auth/register", "POST", {
            displayName: els.registerDisplayName.value,
            username: els.registerUsername.value,
            password: els.registerPassword.value
        }, false);
        await loadApp();
    } catch (error) {
        showAuthError(error.message);
    }
}

async function logout() {
    await api("/api/auth/logout", "POST");
    state.user = null;
    showAuth();
}

function showAuthError(message) {
    els.authError.textContent = message;
    els.authError.classList.remove("hidden");
}

function showAuth() {
    els.appScreen.classList.add("hidden");
    els.authScreen.classList.remove("hidden");
}

function showApp() {
    els.authScreen.classList.add("hidden");
    els.appScreen.classList.remove("hidden");
}

async function loadApp() {
    const data = await api("/api/bootstrap");
    state.user = data.user;
    state.agents = data.agents;
    state.maps = data.maps;
    state.players = data.players;
    state.mySelectedAgents = data.mySelectedAgents;
    state.myPreferredMaps = data.myPreferredMaps;
    state.myPreferences = data.myPreferences;
    showApp();
    renderAll();
}

function renderAll() {
    els.userLine.textContent = `Logged in as ${state.user.display_name} (@${state.user.username})`;
    renderRosterStatus();
    renderSelects();
    renderAgentPicker();
    renderPreferredMapPicker();
    renderPreferences();
    renderMaps();
    renderPlayers();
    generateTeamPlan();
}

function renderRosterStatus() {
    els.teamStatus.value = state.user.team_status === "sub" ? "sub" : "main";
    els.captainCheck.checked = Number(state.user.is_captain) === 1 || state.user.is_captain === true;
}

function renderSelects() {
    const mapOnlyOptions = state.maps.map(map => `<option value="${map.id}">${escapeHtml(map.name)}</option>`).join("");
    const agentOptions = state.agents.map(agent => `<option value="${agent.id}">${escapeHtml(agent.name)} · ${escapeHtml(agent.role)}</option>`).join("");

    els.teamMap.innerHTML = mapOnlyOptions;
    els.preferenceAgent.innerHTML = agentOptions;
    renderPreferenceMapChecks();
}

function renderAgentPicker() {
    els.agentPicker.innerHTML = "";
    const selectedIds = new Set(state.mySelectedAgents.map(agent => Number(agent.id)));

    roles.forEach(role => {
        const roleAgents = state.agents.filter(agent => agent.role === role);
        const section = document.createElement("section");
        section.className = "role-section";
        section.innerHTML = `<h3>${escapeHtml(role)}</h3><div class="agent-grid"></div>`;
        const grid = section.querySelector(".agent-grid");

        roleAgents.forEach(agent => {
            const checked = selectedIds.has(Number(agent.id));
            const label = document.createElement("label");
            label.className = `agent-check${checked ? " selected" : ""}`;
            label.innerHTML = `
                <span class="agent-title">
                    <span class="agent-name">${escapeHtml(agent.name)} · ${escapeHtml(agent.role)}</span>
                    <span class="agent-role">${escapeHtml(agent.role)} class</span>
                </span>
                <input type="checkbox" class="agent-checkbox" value="${agent.id}" ${checked ? "checked" : ""}>
            `;
            label.querySelector("input").addEventListener("change", () => {
                label.classList.toggle("selected", label.querySelector("input").checked);
                updateSelectedAgentBadge();
            });
            grid.appendChild(label);
        });

        els.agentPicker.appendChild(section);
    });

    updateSelectedAgentBadge();
}

function updateSelectedAgentBadge() {
    const count = els.agentPicker.querySelectorAll(".agent-checkbox:checked").length;
    els.selectedAgentBadge.textContent = `${count} agent${count === 1 ? "" : "s"} selected`;
}

function renderPreferredMapPicker() {
    if (!state.maps.length) {
        els.preferredMapPicker.innerHTML = `<div class="empty">No maps have been added yet.</div>`;
        return;
    }

    const selectedIds = new Set(state.myPreferredMaps.map(map => Number(map.id)));
    els.preferredMapPicker.innerHTML = `<div class="map-grid"></div>`;
    const grid = els.preferredMapPicker.querySelector(".map-grid");

    state.maps.forEach(map => {
        const checked = selectedIds.has(Number(map.id));
        const label = document.createElement("label");
        label.className = `map-check${checked ? " selected" : ""}`;
        label.innerHTML = `
            <span class="map-title">
                <span class="map-name">${escapeHtml(map.name)}</span>
                <span class="map-note-small">Preferred map</span>
            </span>
            <input type="checkbox" class="preferred-map-checkbox" value="${map.id}" ${checked ? "checked" : ""}>
        `;
        label.querySelector("input").addEventListener("change", () => {
            label.classList.toggle("selected", label.querySelector("input").checked);
        });
        grid.appendChild(label);
    });
}

function renderPreferenceMapChecks() {
    if (!state.maps.length) {
        els.preferenceMaps.innerHTML = `<div class="empty">No maps available.</div>`;
        return;
    }

    els.preferenceMaps.innerHTML = state.maps.map(map => `
        <label class="mini-check">
            <span>${escapeHtml(map.name)}</span>
            <input type="checkbox" class="preference-map-checkbox" value="${map.id}">
        </label>
    `).join("");

    els.preferenceMaps.querySelectorAll(".mini-check input").forEach(input => {
        input.addEventListener("change", () => input.closest(".mini-check").classList.toggle("selected", input.checked));
    });
}

function renderPreferences() {
    if (!state.myPreferences.length) {
        els.preferencesList.innerHTML = `<div class="empty">No preferences saved yet.</div>`;
        return;
    }

    els.preferencesList.innerHTML = state.myPreferences.map(pref => `
        <div class="item">
            <div class="item-head">
                <div>
                    <div class="item-title">${escapeHtml(pref.agent_name)} · ${escapeHtml(pref.agent_role)}</div>
                    <div class="item-sub">${escapeHtml(pref.map_name || "All Maps")} · Preference ${pref.preference}/5${pref.notes ? `\n${escapeHtml(pref.notes)}` : ""}</div>
                </div>
                <div class="item-actions">
                    <button class="danger" type="button" data-delete-pref="${pref.id}">Delete</button>
                </div>
            </div>
        </div>
    `).join("");

    els.preferencesList.querySelectorAll("[data-delete-pref]").forEach(button => {
        button.addEventListener("click", () => deletePreference(button.dataset.deletePref));
    });
}

function renderMaps() {
    if (!state.maps.length) {
        els.mapsList.innerHTML = `<div class="empty">No maps added yet.</div>`;
        return;
    }

    els.mapsList.innerHTML = state.maps.map(map => `
        <div class="item">
            <div class="item-head">
                <div>
                    <div class="item-title">${escapeHtml(map.name)}</div>
                    <div class="item-sub">${escapeHtml(map.notes || "No notes yet")}</div>
                </div>
                <div class="item-actions">
                    <button class="secondary" type="button" data-edit-map="${map.id}">Edit</button>
                    <button class="danger" type="button" data-delete-map="${map.id}">Delete Note</button>
                </div>
            </div>
        </div>
    `).join("");

    els.mapsList.querySelectorAll("[data-edit-map]").forEach(button => {
        button.addEventListener("click", () => editMap(button.dataset.editMap));
    });

    els.mapsList.querySelectorAll("[data-delete-map]").forEach(button => {
        button.addEventListener("click", () => deleteMap(button.dataset.deleteMap));
    });
}

function renderPlayers() {
    if (!state.players.length) {
        els.playersList.innerHTML = `<div class="empty">No players yet.</div>`;
        return;
    }

    els.playersList.innerHTML = state.players.map(player => {
        const selectedAgents = player.selected_agents.length ? player.selected_agents.map(agent => `<span class="tag good">${escapeHtml(agent.name)} · ${escapeHtml(agent.role)}</span>`).join("") : `<span class="tag">No agents selected</span>`;
        const preferredMaps = player.preferred_maps.length ? player.preferred_maps.map(map => `<span class="tag warn">${escapeHtml(map.name)}</span>`).join("") : `<span class="tag">No preferred maps</span>`;
        const preferences = player.preferences.length ? player.preferences.slice(0, 8).map(pref => `<div class="item-sub">${escapeHtml(pref.agent_name)} on ${escapeHtml(pref.map_name || "All Maps")} · ${pref.preference}/5${pref.notes ? ` — ${escapeHtml(pref.notes)}` : ""}</div>`).join("") : `<div class="item-sub">No agent notes yet.</div>`;
        const roster = player.team_status === "sub" ? "Sub" : "Main Team";
        const captain = player.is_captain ? `<span class="tag captain">Captain</span>` : "";

        return `
            <article class="player-card">
                <h3>${escapeHtml(player.display_name)}${player.id === state.user.id ? " · You" : ""}</h3>
                <div class="item-sub">@${escapeHtml(player.username)}</div>
                <div class="tags player-meta-tags"><span class="tag">${escapeHtml(roster)}</span>${captain}</div>
                <div class="player-section">
                    <div class="player-section-title">Agent Pool</div>
                    <div class="tags">${selectedAgents}</div>
                </div>
                <div class="player-section">
                    <div class="player-section-title">Preferred Maps</div>
                    <div class="tags">${preferredMaps}</div>
                </div>
                <div class="player-section">
                    <div class="player-section-title">Preference Notes</div>
                    ${preferences}
                </div>
            </article>
        `;
    }).join("");
}

async function saveRosterStatus() {
    const data = await api("/api/me/profile", "POST", {
        team_status: els.teamStatus.value,
        is_captain: els.captainCheck.checked
    });

    state.user = data.user;
    state.players = data.players;
    renderRosterStatus();
    renderPlayers();
    generateTeamPlan();
    toast("Roster status saved");
}

async function saveSelectedAgents() {
    const agentIds = Array.from(els.agentPicker.querySelectorAll(".agent-checkbox:checked")).map(input => Number(input.value));
    const data = await api("/api/me/agents", "POST", { agent_ids: agentIds });
    state.mySelectedAgents = data.mySelectedAgents;
    state.players = data.players;
    renderAgentPicker();
    renderPlayers();
    generateTeamPlan();
    toast("Agent pool saved");
}

async function savePreferredMaps() {
    const mapIds = Array.from(els.preferredMapPicker.querySelectorAll(".preferred-map-checkbox:checked")).map(input => Number(input.value));
    const data = await api("/api/me/maps", "POST", { map_ids: mapIds });
    state.myPreferredMaps = data.myPreferredMaps;
    state.players = data.players;
    renderPreferredMapPicker();
    renderPlayers();
    generateTeamPlan();
    toast("Preferred maps saved");
}

async function savePreference(event) {
    event.preventDefault();
    const mapIds = Array.from(els.preferenceMaps.querySelectorAll(".preference-map-checkbox:checked")).map(input => Number(input.value));
    const data = await api("/api/me/preferences", "POST", {
        map_ids: mapIds,
        agent_id: Number(els.preferenceAgent.value),
        preference: Number(els.preferenceRating.value),
        notes: els.preferenceNotes.value
    });
    state.myPreferences = data.myPreferences;
    state.players = data.players;
    els.preferenceNotes.value = "";
    els.preferenceMaps.querySelectorAll(".preference-map-checkbox").forEach(input => {
        input.checked = false;
        input.closest(".mini-check").classList.remove("selected");
    });
    renderPreferences();
    renderPlayers();
    generateTeamPlan();
    toast("Preference saved");
}

async function deletePreference(id) {
    const ok = await askConfirm({
        title: "Delete this preference?",
        message: "This removes the saved agent preference and note from your account. It cannot be undone.",
        confirmText: "Delete Preference"
    });

    if (!ok) return;

    const data = await api(`/api/me/preferences/${id}`, "DELETE");
    state.myPreferences = data.myPreferences;
    state.players = data.players;
    renderPreferences();
    renderPlayers();
    generateTeamPlan();
    toast("Preference deleted");
}

async function saveMap(event) {
    event.preventDefault();
    const id = els.mapId.value;
    const payload = {
        name: els.mapName.value,
        notes: els.mapNotes.value
    };

    if (id) {
        const data = await api(`/api/maps/${id}`, "PUT", payload);
        state.maps = data.maps;
        state.players = data.players;
        toast("Map note updated");
    } else {
        const data = await api("/api/maps", "POST", payload);
        state.maps = data.maps;
        state.players = data.players;
        toast("Map note added");
    }

    resetMapForm();
    renderSelects();
    renderPreferredMapPicker();
    renderMaps();
    renderPlayers();
    generateTeamPlan();
}

function editMap(id) {
    const map = state.maps.find(item => Number(item.id) === Number(id));
    if (!map) return;

    els.mapId.value = map.id;
    els.mapName.value = map.name;
    els.mapNotes.value = map.notes;
    els.saveMapBtn.textContent = "Update Map Note";
    els.cancelMapBtn.classList.remove("hidden");
    els.mapName.focus();
}

function resetMapForm() {
    els.mapId.value = "";
    els.mapName.value = "";
    els.mapNotes.value = "";
    els.saveMapBtn.textContent = "Save Map Note";
    els.cancelMapBtn.classList.add("hidden");
}

async function deleteMap(id) {
    const map = state.maps.find(item => Number(item.id) === Number(id));
    if (!map) return;

    const ok = await askConfirm({
        title: `Delete ${map.name} note?`,
        message: "This clears only the shared map note. The map stays available, and preferred maps plus agent preferences tied to this map will stay saved.",
        confirmText: "Delete Note"
    });

    if (!ok) return;

    const data = await api(`/api/maps/${id}`, "DELETE");
    state.maps = data.maps;
    state.myPreferredMaps = data.myPreferredMaps;
    state.myPreferences = data.myPreferences;
    state.players = data.players;
    resetMapForm();
    renderSelects();
    renderPreferredMapPicker();
    renderMaps();
    renderPreferences();
    renderPlayers();
    generateTeamPlan();
    toast("Map note deleted");
}

async function generateTeamPlan() {
    if (!state.user) return;

    if (!state.maps.length) {
        els.teamPlan.innerHTML = `<div class="empty">Add a map first, then generate a comp.</div>`;
        return;
    }

    const mapId = els.teamMap.value || state.maps[0].id;
    els.teamMap.value = mapId;
    const plan = await api(`/api/team/plan?map_id=${encodeURIComponent(mapId)}`, "GET", null, false).catch(() => null);

    if (!plan) return;

    const missing = plan.missing_roles.length ? `<div class="item-sub">Missing role coverage: ${plan.missing_roles.map(escapeHtml).join(", ")}</div>` : `<div class="item-sub">Role coverage looks balanced.</div>`;
    const mapNotes = plan.map && plan.map.notes ? `<div class="item"><div class="item-title">${escapeHtml(plan.map.name)} Notes</div><div class="item-sub">${escapeHtml(plan.map.notes)}</div></div>` : `<div class="item"><div class="item-title">Map Notes</div><div class="item-sub">No map notes saved yet.</div></div>`;

    els.teamPlan.innerHTML = `
        <div class="comp-grid">
            ${plan.picks.length ? plan.picks.map(pick => `
                <div class="pick-card">
                    <div class="agent">${escapeHtml(pick.agent_name)}</div>
                    <div class="player">${escapeHtml(pick.display_name)}</div>
                    <div class="pick-flags">
                        <span class="tag">${escapeHtml(pick.role)}</span>
                        <span class="tag">${pick.team_status === "sub" ? "Sub" : "Main Team"}</span>
                        ${pick.is_captain ? `<span class="tag captain">Captain</span>` : ""}
                        ${pick.selected_by_player ? `<span class="tag good">In pool</span>` : ""}
                        ${pick.map_preferred_by_player ? `<span class="tag warn">Prefers map</span>` : ""}
                    </div>
                </div>
            `).join("") : `<div class="empty">No players have selected agents, maps, or preferences yet.</div>`}
        </div>
        <div class="grid two">
            <div class="item">
                <div class="item-title">Role Chart</div>
                <div class="chart">${renderRoleChart(plan.role_counts)}</div>
                ${missing}
            </div>
            ${mapNotes}
        </div>
    `;
}

function renderRoleChart(counts) {
    const max = Math.max(1, ...roles.map(role => counts[role] || 0));

    return roles.map(role => {
        const count = counts[role] || 0;
        const width = Math.max(4, (count / max) * 100);
        return `<div class="bar-row"><div>${escapeHtml(role)}</div><div class="bar-shell"><div class="bar-fill" style="width:${width}%"></div></div><div>${count}</div></div>`;
    }).join("");
}

function askConfirm(options) {
    els.confirmTitle.textContent = options.title || "Are you sure?";
    els.confirmMessage.textContent = options.message || "This action cannot be undone.";
    els.confirmAccept.textContent = options.confirmText || "Confirm";
    els.confirmOverlay.classList.remove("hidden");

    return new Promise(resolve => {
        window.confirmResolver = resolve;
        els.confirmCancel.onclick = () => closeConfirm(false);
        els.confirmAccept.onclick = () => closeConfirm(true);
    });
}

function closeConfirm(value) {
    els.confirmOverlay.classList.add("hidden");
    if (typeof window.confirmResolver === "function") {
        window.confirmResolver(value);
        window.confirmResolver = null;
    }
}

function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1900);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
