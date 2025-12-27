const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

// Game state
const lobbies = new Map();
const players = new Map();
let lobbyIdCounter = 0;

class Lobby {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.team1 = [];
        this.team2 = [];
        this.team1Captain = null;
        this.team2Captain = null;
        this.state = 'waiting'; // waiting, role_selection, battle, finished
        this.roles = {
            team1: {},
            team2: {}
        };
        this.createdAt = Date.now();
        this.roleSelectionStartTime = null;
        this.battleStartTime = null;
        this.gameTime = 0;
        this.bots = [];
    }

    addPlayer(playerId, playerName) {
        if (this.players.length >= 10) return false;
        
        this.players.push({ id: playerId, name: playerName, isBot: false });
        
        // Randomly assign to team
        if (this.team1.length <= this.team2.length) {
            this.team1.push(playerId);
        } else {
            this.team2.push(playerId);
        }
        
        return true;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        this.team1 = this.team1.filter(id => id !== playerId);
        this.team2 = this.team2.filter(id => id !== playerId);
    }

    fillWithBots() {
        const botsNeeded = 10 - this.players.length;
        for (let i = 0; i < botsNeeded; i++) {
            const botId = `bot_${this.id}_${i}`;
            const botName = `Bot${i + 1}`;
            this.players.push({ id: botId, name: botName, isBot: true });
            this.bots.push(botId);
            
            if (this.team1.length <= this.team2.length) {
                this.team1.push(botId);
            } else {
                this.team2.push(botId);
            }
        }
    }

    selectCaptains() {
        // Select captains from real players only
        const team1RealPlayers = this.team1.filter(id => !id.startsWith('bot_'));
        const team2RealPlayers = this.team2.filter(id => !id.startsWith('bot_'));
        
        this.team1Captain = team1RealPlayers.length > 0 
            ? team1RealPlayers[Math.floor(Math.random() * team1RealPlayers.length)]
            : this.team1[0]; // fallback to bot if no real players
            
        this.team2Captain = team2RealPlayers.length > 0
            ? team2RealPlayers[Math.floor(Math.random() * team2RealPlayers.length)]
            : this.team2[0]; // fallback to bot if no real players
    }

    assignRoleToPlayer(teamNum, playerId, role, heroType = null) {
        const teamKey = `team${teamNum}`;
        if (!this.roles[teamKey]) this.roles[teamKey] = {};
        
        this.roles[teamKey][playerId] = {
            role: role,
            heroType: heroType
        };
    }

    areAllRolesAssigned(teamNum) {
        const teamKey = `team${teamNum}`;
        const team = teamNum === 1 ? this.team1 : this.team2;
        return team.every(playerId => this.roles[teamKey][playerId]);
    }

    getPlayerCount() {
        return this.players.filter(p => !p.isBot).length;
    }
}

// Find or create available lobby
function findOrCreateLobby(playerId, playerName) {
    // Find non-full lobby in waiting state
    for (const [id, lobby] of lobbies) {
        if (lobby.state === 'waiting' && lobby.players.length < 10) {
            if (lobby.addPlayer(playerId, playerName)) {
                return lobby;
            }
        }
    }
    
    // Create new lobby
    const newLobby = new Lobby(lobbyIdCounter++);
    newLobby.addPlayer(playerId, playerName);
    lobbies.set(newLobby.id, newLobby);
    return newLobby;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join_game', (playerName) => {
        const lobby = findOrCreateLobby(socket.id, playerName || 'Player');
        players.set(socket.id, { lobbyId: lobby.id, name: playerName });
        socket.join(`lobby_${lobby.id}`);
        
        // Send lobby info to player
        socket.emit('lobby_joined', {
            lobbyId: lobby.id,
            playerId: socket.id,
            players: lobby.players,
            team1: lobby.team1,
            team2: lobby.team2
        });

        // Broadcast updated lobby to all players in lobby
        io.to(`lobby_${lobby.id}`).emit('lobby_updated', {
            players: lobby.players,
            team1: lobby.team1,
            team2: lobby.team2,
            playerCount: lobby.getPlayerCount()
        });

        // Check if we should start filling with bots or start game
        checkLobbyStatus(lobby);
    });

    socket.on('assign_role', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyId);
        if (!lobby || lobby.state !== 'role_selection') return;
        
        // Verify socket is a captain
        const isCaptain1 = lobby.team1Captain === socket.id;
        const isCaptain2 = lobby.team2Captain === socket.id;
        if (!isCaptain1 && !isCaptain2) return;
        
        const teamNum = isCaptain1 ? 1 : 2;
        lobby.assignRoleToPlayer(teamNum, data.playerId, data.role, data.heroType);
        
        // Broadcast role assignment
        io.to(`lobby_${lobby.id}`).emit('role_assigned', {
            teamNum: teamNum,
            playerId: data.playerId,
            role: data.role,
            heroType: data.heroType
        });

        // Check if all roles assigned for this team
        if (lobby.areAllRolesAssigned(teamNum)) {
            io.to(`lobby_${lobby.id}`).emit('team_roles_complete', { teamNum });
        }

        // Check if both teams ready
        if (lobby.areAllRolesAssigned(1) && lobby.areAllRolesAssigned(2)) {
            startBattle(lobby);
        }
    });

    socket.on('player_action', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyId);
        if (!lobby || lobby.state !== 'battle') return;
        
        // Broadcast player action to all in lobby
        socket.to(`lobby_${lobby.id}`).emit('player_action', {
            playerId: socket.id,
            ...data
        });
    });

    socket.on('player_death', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyId);
        if (!lobby || lobby.state !== 'battle') return;
        
        // Broadcast death
        io.to(`lobby_${lobby.id}`).emit('player_died', {
            playerId: socket.id,
            killerId: data.killerId
        });
        
        // Check win condition
        checkWinCondition(lobby);
    });

    socket.on('use_ability', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyId);
        if (!lobby || lobby.state !== 'battle') return;
        
        // Broadcast ability use
        io.to(`lobby_${lobby.id}`).emit('ability_used', {
            playerId: socket.id,
            abilityType: data.abilityType,
            targetId: data.targetId,
            position: data.position
        });
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const playerData = players.get(socket.id);
        
        if (playerData) {
            const lobby = lobbies.get(playerData.lobbyId);
            if (lobby) {
                lobby.removePlayer(socket.id);
                
                if (lobby.state === 'waiting' && lobby.getPlayerCount() === 0) {
                    // Remove empty lobby
                    lobbies.delete(lobby.id);
                } else {
                    // Notify others
                    io.to(`lobby_${lobby.id}`).emit('player_left', {
                        playerId: socket.id,
                        players: lobby.players
                    });
                }
            }
            players.delete(socket.id);
        }
    });
});

function checkLobbyStatus(lobby) {
    const playerCount = lobby.getPlayerCount();
    const totalPlayers = lobby.players.length;
    
    // Auto-fill after 10 seconds of waiting
    setTimeout(() => {
        if (lobby.state === 'waiting' && lobby.getPlayerCount() > 0) {
            lobby.fillWithBots();
            startRoleSelection(lobby);
        }
    }, 10000);
    
    // Auto-fill if 5+ players for 30 seconds
    if (playerCount >= 5) {
        setTimeout(() => {
            if (lobby.state === 'waiting' && lobby.players.length < 10) {
                lobby.fillWithBots();
                startRoleSelection(lobby);
            }
        }, 30000);
    }
    
    // Start immediately if full
    if (totalPlayers === 10 && lobby.state === 'waiting') {
        startRoleSelection(lobby);
    }
}

function startRoleSelection(lobby) {
    lobby.state = 'role_selection';
    lobby.selectCaptains();
    lobby.roleSelectionStartTime = Date.now();
    
    // Assign random roles to captains
    const heroTypes = ['achilles', 'agamemnon', 'menelaus', 'odysseus'];
    const roles = ['hero', 'wizard', 'soldier', 'soldier', 'soldier'];
    
    // Shuffle roles
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);
    const captainRole1 = shuffledRoles[0];
    const captainRole2 = shuffledRoles[1];
    
    const captainHero1 = captainRole1 === 'hero' ? heroTypes[Math.floor(Math.random() * heroTypes.length)] : null;
    const captainHero2 = captainRole2 === 'hero' ? heroTypes[Math.floor(Math.random() * heroTypes.length)] : null;
    
    lobby.assignRoleToPlayer(1, lobby.team1Captain, captainRole1, captainHero1);
    lobby.assignRoleToPlayer(2, lobby.team2Captain, captainRole2, captainHero2);
    
    io.to(`lobby_${lobby.id}`).emit('role_selection_started', {
        team1Captain: lobby.team1Captain,
        team2Captain: lobby.team2Captain,
        team1CaptainRole: { role: captainRole1, heroType: captainHero1 },
        team2CaptainRole: { role: captainRole2, heroType: captainHero2 },
        timeLimit: 90000
    });
    
    // Auto-assign for bots
    setTimeout(() => {
        autoAssignBotsRoles(lobby);
    }, 1000);
    
    // Force start after 90 seconds
    setTimeout(() => {
        if (lobby.state === 'role_selection') {
            autoCompleteRoleSelection(lobby);
            startBattle(lobby);
        }
    }, 90000);
}

function autoAssignBotsRoles(lobby) {
    const roles = ['hero', 'wizard', 'soldier', 'soldier', 'soldier'];
    const heroTypes = ['achilles', 'agamemnon', 'menelaus', 'odysseus'];
    
    [1, 2].forEach(teamNum => {
        const team = teamNum === 1 ? lobby.team1 : lobby.team2;
        const teamKey = `team${teamNum}`;
        const assignedRoles = Object.values(lobby.roles[teamKey]).map(r => r.role);
        const availableRoles = roles.filter(role => {
            const count = assignedRoles.filter(r => r === role).length;
            const maxCount = role === 'soldier' ? 3 : 1;
            return count < maxCount;
        });
        
        team.forEach(playerId => {
            if (playerId.startsWith('bot_') && !lobby.roles[teamKey][playerId]) {
                const role = availableRoles.shift();
                const heroType = role === 'hero' ? heroTypes[Math.floor(Math.random() * heroTypes.length)] : null;
                lobby.assignRoleToPlayer(teamNum, playerId, role, heroType);
                
                io.to(`lobby_${lobby.id}`).emit('role_assigned', {
                    teamNum: teamNum,
                    playerId: playerId,
                    role: role,
                    heroType: heroType
                });
            }
        });
    });
}

function autoCompleteRoleSelection(lobby) {
    const roles = ['hero', 'wizard', 'soldier', 'soldier', 'soldier'];
    const heroTypes = ['achilles', 'agamemnon', 'menelaus', 'odysseus'];
    
    [1, 2].forEach(teamNum => {
        const team = teamNum === 1 ? lobby.team1 : lobby.team2;
        const teamKey = `team${teamNum}`;
        const assignedRoles = Object.values(lobby.roles[teamKey]).map(r => r.role);
        const availableRoles = roles.filter(role => {
            const count = assignedRoles.filter(r => r === role).length;
            const maxCount = role === 'soldier' ? 3 : 1;
            return count < maxCount;
        });
        
        team.forEach(playerId => {
            if (!lobby.roles[teamKey][playerId]) {
                const role = availableRoles.shift();
                const heroType = role === 'hero' ? heroTypes[Math.floor(Math.random() * heroTypes.length)] : null;
                lobby.assignRoleToPlayer(teamNum, playerId, role, heroType);
            }
        });
    });
}

function startBattle(lobby) {
    lobby.state = 'battle';
    
    // 10 second countdown
    io.to(`lobby_${lobby.id}`).emit('battle_countdown', { countdown: 10 });
    
    setTimeout(() => {
        lobby.battleStartTime = Date.now();
        io.to(`lobby_${lobby.id}`).emit('battle_started', {
            roles: lobby.roles,
            team1: lobby.team1,
            team2: lobby.team2,
            bots: lobby.bots
        });
        
        // Start game timer
        startGameTimer(lobby);
    }, 10000);
}

function startGameTimer(lobby) {
    const interval = setInterval(() => {
        if (lobby.state !== 'battle') {
            clearInterval(interval);
            return;
        }
        
        const elapsed = Date.now() - lobby.battleStartTime;
        lobby.gameTime = elapsed;
        
        // 3 minute main game
        if (elapsed >= 180000 && elapsed < 240000) {
            if (!lobby.overtimeStarted) {
                lobby.overtimeStarted = true;
                io.to(`lobby_${lobby.id}`).emit('overtime_started');
            }
        }
        
        // End in draw after overtime
        if (elapsed >= 240000) {
            clearInterval(interval);
            endGame(lobby, 'draw');
        }
        
        // Broadcast time update
        io.to(`lobby_${lobby.id}`).emit('game_time_update', { 
            elapsed,
            isOvertime: elapsed >= 180000
        });
    }, 1000);
}

function checkWinCondition(lobby) {
    if (lobby.state !== 'battle') return;
    
    // Track alive players per team
    const alivePlayers = {
        team1: new Set(),
        team2: new Set()
    };
    
    // This is a simplified check - in a real implementation, we'd track player states
    // For now, we rely on client-side checks and overtime logic
    // The server will end the game on timeout or when explicitly told
    
    // In overtime, first kill wins - this is handled by the client
    // The server just needs to track when all players on a team are dead
}

function endGame(lobby, result) {
    lobby.state = 'finished';
    io.to(`lobby_${lobby.id}`).emit('game_ended', { result });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

