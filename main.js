// Global socket connection
let socket = null;
let playerId = null;
let playerName = '';
let currentGameConfig = null;

// Initialize socket connection
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        playerId = socket.id;
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Join game function
function joinGame() {
    const nameInput = document.getElementById('player-name');
    const joinBtn = document.getElementById('join-btn');
    const statusText = document.getElementById('status-text');
    
    playerName = nameInput.value.trim() || 'Player';
    
    if (!playerName) {
        statusText.textContent = 'Please enter a name';
        return;
    }
    
    joinBtn.disabled = true;
    statusText.textContent = 'Connecting...';
    
    if (!socket) {
        initSocket();
    }
    
    socket.emit('join_game', playerName);
}

// Setup socket listeners
function setupSocketListeners() {
    if (!socket) initSocket();
    
    socket.on('lobby_joined', (data) => {
        playerId = data.playerId;
        currentGameConfig = data;
        
        document.getElementById('status-text').textContent = 'Waiting for players...';
        document.getElementById('lobby-info').style.display = 'block';
        updateLobbyDisplay(data);
    });
    
    socket.on('lobby_updated', (data) => {
        updateLobbyDisplay(data);
    });
    
    socket.on('role_selection_started', (data) => {
        startRoleSelection(data);
    });
    
    socket.on('role_assigned', (data) => {
        updateRoleAssignment(data);
    });
    
    socket.on('team_roles_complete', (data) => {
        console.log(`Team ${data.teamNum} roles complete`);
    });
    
    socket.on('battle_countdown', (data) => {
        showCountdown(data.countdown);
    });
    
    socket.on('battle_started', (data) => {
        startBattle(data);
    });
    
    socket.on('player_left', (data) => {
        updateLobbyDisplay(data);
    });
}

// Update lobby display
function updateLobbyDisplay(data) {
    const playerCount = data.playerCount || data.players.length;
    document.getElementById('player-count').textContent = playerCount;
    
    // Update team lists
    const team1List = document.getElementById('team1-list');
    const team2List = document.getElementById('team2-list');
    
    team1List.innerHTML = '';
    team2List.innerHTML = '';
    
    data.team1.forEach((playerId, index) => {
        const player = data.players.find(p => p.id === playerId);
        if (player) {
            const li = document.createElement('li');
            li.className = 'player-item';
            li.textContent = player.name || `Player${index + 1}`;
            if (player.isBot) {
                li.textContent += ' (Bot)';
                li.style.opacity = '0.7';
            }
            team1List.appendChild(li);
        }
    });
    
    data.team2.forEach((playerId, index) => {
        const player = data.players.find(p => p.id === playerId);
        if (player) {
            const li = document.createElement('li');
            li.className = 'player-item';
            li.textContent = player.name || `Player${index + 1}`;
            if (player.isBot) {
                li.textContent += ' (Bot)';
                li.style.opacity = '0.7';
            }
            team2List.appendChild(li);
        }
    });
}

// Start role selection
function startRoleSelection(data) {
    const roleScreen = document.getElementById('role-selection-screen');
    const captainStatus = document.getElementById('captain-status');
    const roleArea = document.getElementById('role-assignment-area');
    
    roleScreen.style.display = 'block';
    
    const isTeam1Captain = data.team1Captain === playerId;
    const isTeam2Captain = data.team2Captain === playerId;
    const isCaptain = isTeam1Captain || isTeam2Captain;
    const teamNum = isTeam1Captain ? 1 : 2;
    
    if (isCaptain) {
        captainStatus.textContent = `You are the Team ${teamNum} Captain! Assign roles to your teammates.`;
        captainStatus.style.color = '#f39c12';
        
        // Get captain's role
        const captainRole = teamNum === 1 ? data.team1CaptainRole : data.team2CaptainRole;
        
        // Create role selection UI
        createRoleSelectionUI(teamNum, isTeam1Captain ? data.team1 : data.team2, captainRole, data);
    } else {
        captainStatus.textContent = `Waiting for Team ${teamNum} Captain to assign roles...`;
        captainStatus.style.color = '#ffffff';
        roleArea.innerHTML = '<p>Please wait while your captain assigns roles.</p>';
    }
    
    // Start role selection timer
    let timeRemaining = 90;
    const timerElement = document.getElementById('role-timer');
    const timerInterval = setInterval(() => {
        timeRemaining--;
        timerElement.textContent = `Time remaining: ${timeRemaining}s`;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

// Create role selection UI
function createRoleSelectionUI(teamNum, teamPlayers, captainRole, data) {
    const roleArea = document.getElementById('role-assignment-area');
    roleArea.innerHTML = '';
    
    // Show captain's role
    const captainInfo = document.createElement('div');
    captainInfo.style.marginBottom = '20px';
    captainInfo.style.padding = '15px';
    captainInfo.style.background = 'rgba(243, 156, 18, 0.3)';
    captainInfo.style.borderRadius = '10px';
    captainInfo.innerHTML = `
        <h3>Your Role: ${captainRole.role.charAt(0).toUpperCase() + captainRole.role.slice(1)}${captainRole.heroType ? ` (${captainRole.heroType.charAt(0).toUpperCase() + captainRole.heroType.slice(1)})` : ''}</h3>
        <p>You cannot change your own role.</p>
    `;
    roleArea.appendChild(captainInfo);
    
    // Get unassigned players
    const unassignedPlayers = teamPlayers.filter(playerId => {
        const teamKey = `team${teamNum}`;
        return !data.roles || !data.roles[teamKey] || !data.roles[teamKey][playerId];
    });
    
    if (unassignedPlayers.length === 0) {
        roleArea.innerHTML += '<p>All roles have been assigned!</p>';
        return;
    }
    
    // Create role grid
    const roleGrid = document.createElement('div');
    roleGrid.className = 'role-grid';
    
    // Available roles (excluding captain's role)
    const availableRoles = {
        hero: { count: 0, max: 1 },
        wizard: { count: 0, max: 1 },
        soldier: { count: 0, max: 3 }
    };
    
    // Count already assigned roles
    const teamKey = `team${teamNum}`;
    if (data.roles && data.roles[teamKey]) {
        Object.values(data.roles[teamKey]).forEach(roleData => {
            if (roleData.role in availableRoles) {
                availableRoles[roleData.role].count++;
            }
        });
    }
    
    // Create role cards for each unassigned player
    unassignedPlayers.forEach(targetPlayerId => {
        const player = currentGameConfig.players.find(p => p.id === targetPlayerId);
        const playerName = player ? player.name : `Player${targetPlayerId}`;
        
        const roleCard = document.createElement('div');
        roleCard.className = 'role-card';
        roleCard.innerHTML = `
            <h3>${playerName}</h3>
            <p>Select a role:</p>
        `;
        
        // Hero option
        if (availableRoles.hero.count < availableRoles.hero.max) {
            const heroOption = document.createElement('div');
            heroOption.style.marginTop = '10px';
            heroOption.innerHTML = `
                <label>
                    <input type="radio" name="role_${targetPlayerId}" value="hero">
                    Hero
                </label>
                <div class="hero-dropdown" id="hero_dropdown_${targetPlayerId}" style="display: none; margin-top: 10px;">
                    <select id="hero_select_${targetPlayerId}">
                        <option value="achilles">Achilles</option>
                        <option value="agamemnon">Agamemnon</option>
                        <option value="menelaus">Menelaus</option>
                        <option value="odysseus">Odysseus</option>
                    </select>
                </div>
            `;
            
            const radio = heroOption.querySelector('input[type="radio"]');
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    document.getElementById(`hero_dropdown_${targetPlayerId}`).style.display = 'block';
                }
            });
            
            roleCard.appendChild(heroOption);
        }
        
        // Wizard option
        if (availableRoles.wizard.count < availableRoles.wizard.max) {
            const wizardOption = document.createElement('div');
            wizardOption.style.marginTop = '10px';
            wizardOption.innerHTML = `
                <label>
                    <input type="radio" name="role_${targetPlayerId}" value="wizard">
                    Wizard
                </label>
            `;
            roleCard.appendChild(wizardOption);
        }
        
        // Soldier option
        if (availableRoles.soldier.count < availableRoles.soldier.max) {
            const soldierOption = document.createElement('div');
            soldierOption.style.marginTop = '10px';
            soldierOption.innerHTML = `
                <label>
                    <input type="radio" name="role_${targetPlayerId}" value="soldier">
                    Soldier
                </label>
            `;
            roleCard.appendChild(soldierOption);
        }
        
        // Assign button
        const assignBtn = document.createElement('button');
        assignBtn.textContent = 'Assign';
        assignBtn.style.marginTop = '10px';
        assignBtn.onclick = () => {
            const selectedRole = roleCard.querySelector('input[type="radio"]:checked');
            if (!selectedRole) {
                alert('Please select a role');
                return;
            }
            
            const role = selectedRole.value;
            let heroType = null;
            
            if (role === 'hero') {
                const heroSelect = document.getElementById(`hero_select_${targetPlayerId}`);
                if (heroSelect) {
                    heroType = heroSelect.value;
                }
            }
            
            // Emit role assignment
            socket.emit('assign_role', {
                playerId: targetPlayerId,
                role: role,
                heroType: heroType
            });
            
            roleCard.classList.add('selected');
            assignBtn.disabled = true;
        };
        
        roleCard.appendChild(assignBtn);
        roleGrid.appendChild(roleCard);
    });
    
    roleArea.appendChild(roleGrid);
}

// Update role assignment display
function updateRoleAssignment(data) {
    // This is handled by the server broadcasting to all clients
    // The UI will update when roles are assigned
}

// Show countdown
function showCountdown(countdown) {
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    
    countdownOverlay.style.display = 'flex';
    
    let current = countdown;
    countdownNumber.textContent = current;
    
    const countdownInterval = setInterval(() => {
        current--;
        if (current > 0) {
            countdownNumber.textContent = current;
        } else {
            countdownNumber.textContent = 'FIGHT!';
            setTimeout(() => {
                countdownOverlay.style.display = 'none';
            }, 1000);
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Global game instance
let gameInstance = null;

// Start battle
function startBattle(data) {
    // Hide all UI overlays
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('role-selection-screen').style.display = 'none';
    document.getElementById('countdown-overlay').style.display = 'none';
    
    // Destroy existing game if any
    if (gameInstance) {
        gameInstance.destroy(true);
        gameInstance = null;
    }
    
    // Initialize Phaser game
    const config = {
        type: Phaser.AUTO,
        width: GAME_CONFIG.width,
        height: GAME_CONFIG.height,
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scene: BattleScene
    };
    
    // Create game instance
    gameInstance = new Phaser.Game(config);
    
    // Start battle scene with data
    gameInstance.scene.start('BattleScene', {
        socket: socket,
        playerId: playerId,
        roles: data.roles,
        team1: data.team1,
        team2: data.team2,
        bots: data.bots
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupSocketListeners();
    
    // Allow Enter key to join
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
});

