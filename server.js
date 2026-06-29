const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const db = new Database(path.join(__dirname, "data.sqlite"));
const port = process.env.PORT || 3000;

const defaultAgents = [
    ["Astra", "Controller"],
    ["Breach", "Initiator"],
    ["Brimstone", "Controller"],
    ["Chamber", "Sentinel"],
    ["Clove", "Controller"],
    ["Cypher", "Sentinel"],
    ["Deadlock", "Sentinel"],
    ["Fade", "Initiator"],
    ["Gekko", "Initiator"],
    ["Harbor", "Controller"],
    ["Iso", "Duelist"],
    ["Jett", "Duelist"],
    ["KAY/O", "Initiator"],
    ["Killjoy", "Sentinel"],
    ["Miks", "Controller"],
    ["Neon", "Duelist"],
    ["Omen", "Controller"],
    ["Phoenix", "Duelist"],
    ["Raze", "Duelist"],
    ["Reyna", "Duelist"],
    ["Sage", "Sentinel"],
    ["Skye", "Initiator"],
    ["Sova", "Initiator"],
    ["Tejo", "Initiator"],
    ["Viper", "Controller"],
    ["Vyse", "Sentinel"],
    ["Waylay", "Duelist"],
    ["Yoru", "Duelist"]
];

const defaultMaps = [
    ["Abyss", "No notes yet"],
    ["Ascent", "No notes yet"],
    ["Bind", "No notes yet"],
    ["Breeze", "No notes yet"],
    ["Corrode", "No notes yet"],
    ["Fracture", "No notes yet"],
    ["Haven", "No notes yet"],
    ["Icebox", "No notes yet"],
    ["Lotus", "No notes yet"],
    ["Pearl", "No notes yet"],
    ["Split", "No notes yet"],
    ["Sunset", "No notes yet"],
    ["Summit", "No notes yet"]
];

app.use(express.json({ limit: "2mb" }));
app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));
app.use(express.static(path.join(__dirname, "public")));

function initDb() {
    db.pragma("foreign_keys = ON");

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            team_status TEXT NOT NULL DEFAULT 'main',
            is_captain INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            role TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            notes TEXT NOT NULL DEFAULT '',
            created_by INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS user_selected_agents (
            user_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, agent_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_preferred_maps (
            user_id INTEGER NOT NULL,
            map_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, map_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            map_id INTEGER,
            preference INTEGER NOT NULL DEFAULT 3,
            notes TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE
        );
    `);

    ensureColumn("users", "team_status", "TEXT NOT NULL DEFAULT 'main'");
    ensureColumn("users", "is_captain", "INTEGER NOT NULL DEFAULT 0");

    const agentInsert = db.prepare("INSERT OR IGNORE INTO agents (name, role) VALUES (?, ?)");
    const mapInsert = db.prepare("INSERT OR IGNORE INTO maps (name, notes) VALUES (?, ?)");

    const seed = db.transaction(() => {
        defaultAgents.forEach(agent => agentInsert.run(agent[0], agent[1]));
        defaultMaps.forEach(map => mapInsert.run(map[0], map[1]));
    });

    seed();
}

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(item => item.name);

    if (!columns.includes(column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
}

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    next();
}

function cleanString(value, max = 200) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, max);
}

function currentUser(id) {
    return db.prepare("SELECT id, username, display_name, team_status, is_captain FROM users WHERE id = ?").get(id);
}

function getAgents() {
    return db.prepare(`
        SELECT id, name, role
        FROM agents
        ORDER BY CASE role WHEN 'Controller' THEN 1 WHEN 'Sentinel' THEN 2 WHEN 'Initiator' THEN 3 WHEN 'Duelist' THEN 4 ELSE 5 END, name
    `).all();
}

function getMaps() {
    return db.prepare("SELECT id, name, notes, created_by, updated_at FROM maps ORDER BY name").all();
}

function getMySelectedAgents(userId) {
    return db.prepare(`
        SELECT agents.id, agents.name, agents.role
        FROM user_selected_agents
        JOIN agents ON agents.id = user_selected_agents.agent_id
        WHERE user_selected_agents.user_id = ?
        ORDER BY CASE agents.role WHEN 'Controller' THEN 1 WHEN 'Sentinel' THEN 2 WHEN 'Initiator' THEN 3 WHEN 'Duelist' THEN 4 ELSE 5 END, agents.name
    `).all(userId);
}

function getMyPreferredMaps(userId) {
    return db.prepare(`
        SELECT maps.id, maps.name, maps.notes
        FROM user_preferred_maps
        JOIN maps ON maps.id = user_preferred_maps.map_id
        WHERE user_preferred_maps.user_id = ?
        ORDER BY maps.name
    `).all(userId);
}

function getMyPreferences(userId) {
    return db.prepare(`
        SELECT user_preferences.id, user_preferences.agent_id, agents.name AS agent_name, agents.role AS agent_role, user_preferences.map_id, maps.name AS map_name, user_preferences.preference, user_preferences.notes, user_preferences.updated_at
        FROM user_preferences
        JOIN agents ON agents.id = user_preferences.agent_id
        LEFT JOIN maps ON maps.id = user_preferences.map_id
        WHERE user_preferences.user_id = ?
        ORDER BY COALESCE(maps.name, 'All Maps'), agents.name, user_preferences.preference DESC
    `).all(userId);
}

function getPlayerProfiles() {
    const users = db.prepare(`
        SELECT id, username, display_name, team_status, is_captain, created_at
        FROM users
        ORDER BY CASE team_status WHEN 'main' THEN 1 WHEN 'sub' THEN 2 ELSE 3 END, is_captain DESC, display_name
    `).all();
    const selected = db.prepare(`
        SELECT user_selected_agents.user_id, agents.id, agents.name, agents.role
        FROM user_selected_agents
        JOIN agents ON agents.id = user_selected_agents.agent_id
        ORDER BY agents.name
    `).all();
    const preferredMaps = db.prepare(`
        SELECT user_preferred_maps.user_id, maps.id, maps.name
        FROM user_preferred_maps
        JOIN maps ON maps.id = user_preferred_maps.map_id
        ORDER BY maps.name
    `).all();
    const preferences = db.prepare(`
        SELECT user_preferences.user_id, user_preferences.agent_id, agents.name AS agent_name, agents.role AS agent_role, user_preferences.map_id, maps.name AS map_name, user_preferences.preference, user_preferences.notes
        FROM user_preferences
        JOIN agents ON agents.id = user_preferences.agent_id
        LEFT JOIN maps ON maps.id = user_preferences.map_id
        ORDER BY user_preferences.preference DESC, agents.name
    `).all();

    return users.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        created_at: user.created_at,
        team_status: user.team_status || "main",
        is_captain: Number(user.is_captain) === 1,
        selected_agents: selected.filter(agent => agent.user_id === user.id).map(agent => ({ id: agent.id, name: agent.name, role: agent.role })),
        preferred_maps: preferredMaps.filter(map => map.user_id === user.id).map(map => ({ id: map.id, name: map.name })),
        preferences: preferences.filter(pref => pref.user_id === user.id).map(pref => ({
            agent_id: pref.agent_id,
            agent_name: pref.agent_name,
            agent_role: pref.agent_role,
            map_id: pref.map_id,
            map_name: pref.map_name,
            preference: pref.preference,
            notes: pref.notes
        }))
    }));
}

function setSelectedAgents(userId, agentIds) {
    const validIds = uniqueNumbers(agentIds);
    const validAgentIds = validIds.filter(id => db.prepare("SELECT id FROM agents WHERE id = ?").get(id));

    const write = db.transaction(() => {
        db.prepare("DELETE FROM user_selected_agents WHERE user_id = ?").run(userId);
        const insert = db.prepare("INSERT INTO user_selected_agents (user_id, agent_id) VALUES (?, ?)");
        validAgentIds.forEach(id => insert.run(userId, id));
    });

    write();
}

function setPreferredMaps(userId, mapIds) {
    const validIds = uniqueNumbers(mapIds);
    const validMapIds = validIds.filter(id => db.prepare("SELECT id FROM maps WHERE id = ?").get(id));

    const write = db.transaction(() => {
        db.prepare("DELETE FROM user_preferred_maps WHERE user_id = ?").run(userId);
        const insert = db.prepare("INSERT INTO user_preferred_maps (user_id, map_id) VALUES (?, ?)");
        validMapIds.forEach(id => insert.run(userId, id));
    });

    write();
}

function uniqueNumbers(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0))];
}

function upsertPreference(userId, agentId, mapId, preference, notes) {
    const existing = mapId === null
        ? db.prepare("SELECT id FROM user_preferences WHERE user_id = ? AND agent_id = ? AND map_id IS NULL").get(userId, agentId)
        : db.prepare("SELECT id FROM user_preferences WHERE user_id = ? AND agent_id = ? AND map_id = ?").get(userId, agentId, mapId);

    if (existing) {
        db.prepare("UPDATE user_preferences SET preference = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(preference, notes, existing.id);
        return existing.id;
    }

    const result = db.prepare("INSERT INTO user_preferences (user_id, agent_id, map_id, preference, notes) VALUES (?, ?, ?, ?, ?)").run(userId, agentId, mapId, preference, notes);
    return result.lastInsertRowid;
}

function getTeamPlan(mapId) {
    const agents = getAgents();
    const maps = getMaps();
    const map = mapId ? db.prepare("SELECT id, name, notes FROM maps WHERE id = ?").get(mapId) : maps[0] || null;
    const targetMapId = map ? map.id : null;
    const profiles = getPlayerProfiles();
    const eligiblePlayers = profiles.filter(profile => profile.selected_agents.length || profile.preferences.length || profile.preferred_maps.length);
    const sortedEligible = eligiblePlayers.sort((a, b) => {
        const aTeam = a.team_status === "main" ? 1 : 0;
        const bTeam = b.team_status === "main" ? 1 : 0;
        const aPrefersMap = a.preferred_maps.some(item => Number(item.id) === Number(targetMapId)) ? 1 : 0;
        const bPrefersMap = b.preferred_maps.some(item => Number(item.id) === Number(targetMapId)) ? 1 : 0;
        const aCaptain = a.is_captain ? 1 : 0;
        const bCaptain = b.is_captain ? 1 : 0;
        return bTeam - aTeam || bCaptain - aCaptain || bPrefersMap - aPrefersMap || a.display_name.localeCompare(b.display_name);
    });
    const mainEligible = sortedEligible.filter(profile => profile.team_status === "main");
    const subEligible = sortedEligible.filter(profile => profile.team_status === "sub");
    const eligible = mainEligible.length >= 5 ? mainEligible : mainEligible.concat(subEligible);
    const targetPlayerCount = Math.min(5, eligible.length);
    const selectedUserIds = new Set();
    const selectedAgentIds = new Set();
    const picks = [];
    const roleTargets = ["Controller", "Sentinel", "Initiator", "Duelist"];

    function score(profile, agent) {
        let total = 0;

        if (profile.selected_agents.some(item => item.id === agent.id)) total += 8;
        if (profile.team_status === "main") total += 4;
        if (profile.is_captain) total += 1;
        if (profile.preferred_maps.some(item => Number(item.id) === Number(targetMapId))) total += 3;

        for (const pref of profile.preferences) {
            if (Number(pref.agent_id) !== Number(agent.id)) continue;
            if (pref.map_id === null) total += Number(pref.preference) || 0;
            if (Number(pref.map_id) === Number(targetMapId)) total += (Number(pref.preference) || 0) * 3;
        }

        return total;
    }

    function bestPickForRole(role) {
        let best = null;

        for (const profile of eligible) {
            if (selectedUserIds.has(profile.id)) continue;

            const candidateAgents = agents.filter(agent => agent.role === role);

            for (const agent of candidateAgents) {
                if (selectedAgentIds.has(agent.id)) continue;
                const value = score(profile, agent) + 1;
                if (!best || value > best.score) best = { profile, agent, score: value };
            }
        }

        return best;
    }

    function bestRemainingPick() {
        let best = null;

        for (const profile of eligible) {
            if (selectedUserIds.has(profile.id)) continue;

            for (const agent of agents) {
                if (selectedAgentIds.has(agent.id)) continue;
                const value = score(profile, agent);
                if (!best || value > best.score) best = { profile, agent, score: value };
            }
        }

        return best;
    }

    for (const role of roleTargets) {
        const pick = bestPickForRole(role);
        if (!pick) continue;
        picks.push(pick);
        selectedUserIds.add(pick.profile.id);
        selectedAgentIds.add(pick.agent.id);
    }

    while (picks.length < targetPlayerCount) {
        const pick = bestRemainingPick();
        if (!pick) break;
        picks.push(pick);
        selectedUserIds.add(pick.profile.id);
        selectedAgentIds.add(pick.agent.id);
    }

    const roleCounts = { Controller: 0, Sentinel: 0, Initiator: 0, Duelist: 0 };
    picks.forEach(pick => roleCounts[pick.agent.role] = (roleCounts[pick.agent.role] || 0) + 1);

    return {
        map,
        generated_at: new Date().toISOString(),
        players_found: eligible.length,
        picks: picks.map(pick => ({
            user_id: pick.profile.id,
            display_name: pick.profile.display_name,
            username: pick.profile.username,
            agent_id: pick.agent.id,
            agent_name: pick.agent.name,
            role: pick.agent.role,
            score: pick.score,
            team_status: pick.profile.team_status,
            is_captain: pick.profile.is_captain,
            selected_by_player: pick.profile.selected_agents.some(item => item.id === pick.agent.id),
            map_preferred_by_player: pick.profile.preferred_maps.some(item => Number(item.id) === Number(targetMapId))
        })),
        role_counts: roleCounts,
        missing_roles: Object.keys(roleCounts).filter(role => roleCounts[role] === 0),
        players: profiles
    };
}

app.post("/api/auth/register", async (req, res) => {
    const username = cleanString(req.body.username, 40).toLowerCase();
    const displayName = cleanString(req.body.displayName, 60) || username;
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) {
        return res.status(400).json({ error: "Username must be 3-40 characters and only use letters, numbers, underscores, dots, or dashes" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
        return res.status(409).json({ error: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)").run(username, displayName, hash);
    req.session.userId = result.lastInsertRowid;
    res.json({ user: currentUser(result.lastInsertRowid) });
});

app.post("/api/auth/login", async (req, res) => {
    const username = cleanString(req.body.username, 40).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    req.session.userId = user.id;
    res.json({ user: currentUser(user.id) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
        return res.json({ user: null });
    }

    res.json({ user: currentUser(req.session.userId) });
});

app.get("/api/bootstrap", requireAuth, (req, res) => {
    res.json({
        user: currentUser(req.session.userId),
        agents: getAgents(),
        maps: getMaps(),
        players: getPlayerProfiles(),
        mySelectedAgents: getMySelectedAgents(req.session.userId),
        myPreferredMaps: getMyPreferredMaps(req.session.userId),
        myPreferences: getMyPreferences(req.session.userId)
    });
});

app.post("/api/me/agents", requireAuth, (req, res) => {
    setSelectedAgents(req.session.userId, req.body.agent_ids);
    res.json({
        mySelectedAgents: getMySelectedAgents(req.session.userId),
        players: getPlayerProfiles()
    });
});

app.post("/api/me/maps", requireAuth, (req, res) => {
    setPreferredMaps(req.session.userId, req.body.map_ids);
    res.json({
        myPreferredMaps: getMyPreferredMaps(req.session.userId),
        players: getPlayerProfiles()
    });
});

app.post("/api/me/profile", requireAuth, (req, res) => {
    const teamStatus = req.body.team_status === "sub" ? "sub" : "main";
    const isCaptain = req.body.is_captain ? 1 : 0;

    db.prepare("UPDATE users SET team_status = ?, is_captain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(teamStatus, isCaptain, req.session.userId);

    res.json({
        user: currentUser(req.session.userId),
        players: getPlayerProfiles()
    });
});

app.post("/api/me/preferences", requireAuth, (req, res) => {
    const agentId = Number(req.body.agent_id);
    const rawMapIds = Array.isArray(req.body.map_ids) ? req.body.map_ids : [];
    const mapIds = uniqueNumbers(rawMapIds);
    const preference = Math.max(1, Math.min(5, Number(req.body.preference) || 3));
    const notes = cleanString(req.body.notes, 2000);

    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId);
    if (!agent) return res.status(400).json({ error: "Invalid agent" });

    const validMapIds = mapIds.filter(id => db.prepare("SELECT id FROM maps WHERE id = ?").get(id));
    const targets = validMapIds.length ? validMapIds : [null];

    const write = db.transaction(() => {
        targets.forEach(mapId => upsertPreference(req.session.userId, agentId, mapId, preference, notes));
    });

    write();
    res.json({ myPreferences: getMyPreferences(req.session.userId), players: getPlayerProfiles() });
});

app.delete("/api/me/preferences/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM user_preferences WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.session.userId);
    res.json({ myPreferences: getMyPreferences(req.session.userId), players: getPlayerProfiles() });
});

app.post("/api/maps", requireAuth, (req, res) => {
    const name = cleanString(req.body.name, 80);
    const notes = cleanString(req.body.notes, 5000);

    if (!name) return res.status(400).json({ error: "Map name is required" });

    try {
        const result = db.prepare("INSERT INTO maps (name, notes, created_by) VALUES (?, ?, ?)").run(name, notes, req.session.userId);
        res.json({
            map: db.prepare("SELECT id, name, notes, created_by, updated_at FROM maps WHERE id = ?").get(result.lastInsertRowid),
            maps: getMaps(),
            players: getPlayerProfiles()
        });
    } catch (error) {
        res.status(409).json({ error: "That map already exists" });
    }
});

app.put("/api/maps/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const name = cleanString(req.body.name, 80);
    const notes = cleanString(req.body.notes, 5000);

    if (!name) return res.status(400).json({ error: "Map name is required" });

    try {
        const result = db.prepare("UPDATE maps SET name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, notes, id);
        if (result.changes === 0) return res.status(404).json({ error: "Map not found" });
        res.json({ maps: getMaps(), players: getPlayerProfiles() });
    } catch (error) {
        res.status(409).json({ error: "That map already exists" });
    }
});

app.delete("/api/maps/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const result = db.prepare("UPDATE maps SET notes = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    if (result.changes === 0) {
        return res.status(404).json({ error: "Map not found" });
    }

    res.json({
        maps: getMaps(),
        myPreferredMaps: getMyPreferredMaps(req.session.userId),
        myPreferences: getMyPreferences(req.session.userId),
        players: getPlayerProfiles()
    });
});

app.get("/api/team/plan", requireAuth, (req, res) => {
    const mapId = Number(req.query.map_id) || null;
    res.json(getTeamPlan(mapId));
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb();

app.listen(port, () => {
    console.log(`Valorant team planner running on http://localhost:${port}`);
});
