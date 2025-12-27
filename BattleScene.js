class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }
    
    init(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
        this.roles = data.roles;
        this.team1 = data.team1;
        this.team2 = data.team2;
        this.bots = data.bots || [];
        this.myTeam = this.team1.includes(this.playerId) ? 1 : 2;
    }
    
    create() {
        // Create arena background (Clash Royale style - Arena 1 coloring)
        this.add.rectangle(
            GAME_CONFIG.width / 2,
            GAME_CONFIG.height / 2,
            GAME_CONFIG.arena.width,
            GAME_CONFIG.arena.height,
            GAME_CONFIG.arena.backgroundColor
        );
        
        // Arena border
        const borderGraphics = this.add.graphics();
        borderGraphics.lineStyle(GAME_CONFIG.arena.borderWidth, GAME_CONFIG.arena.borderColor, 1);
        borderGraphics.strokeRect(
            (GAME_CONFIG.width - GAME_CONFIG.arena.width) / 2,
            (GAME_CONFIG.height - GAME_CONFIG.arena.height) / 2,
            GAME_CONFIG.arena.width,
            GAME_CONFIG.arena.height
        );
        
        // Set world bounds
        this.physics.world.setBounds(
            (GAME_CONFIG.width - GAME_CONFIG.arena.width) / 2,
            (GAME_CONFIG.height - GAME_CONFIG.arena.height) / 2,
            GAME_CONFIG.arena.width,
            GAME_CONFIG.arena.height
        );
        
        // Initialize arrays
        this.allPlayers = [];
        this.projectiles = [];
        this.botAIs = [];
        this.myPlayer = null;
        
        // Create players
        this.createPlayers();
        
        // Setup input
        this.setupInput();
        
        // Setup UI
        this.setupUI();
        
        // Setup socket listeners
        this.setupSocketListeners();
        
        // Game state
        this.gameTime = 0;
        this.isOvertime = false;
        this.gameEnded = false;
        
        // Create particle emitter for fireballs (if needed)
        this.createParticleSystem();
    }
    
    createPlayers() {
        // Create Team 1 players
        this.team1.forEach((playerId, index) => {
            const roleData = this.roles.team1[playerId];
            if (!roleData) return;
            
            const spawnX = GAME_CONFIG.arena.team1SpawnX + (index - 2) * 40;
            const spawnY = GAME_CONFIG.arena.team1SpawnY;
            const isBot = this.bots.includes(playerId);
            const playerName = isBot ? `Bot${index + 1}` : `Player${index + 1}`;
            
            const player = this.createPlayer(playerId, playerName, 1, spawnX, spawnY, roleData, isBot);
            this.allPlayers.push(player);
            
            if (playerId === this.playerId) {
                this.myPlayer = player;
            }
        });
        
        // Create Team 2 players
        this.team2.forEach((playerId, index) => {
            const roleData = this.roles.team2[playerId];
            if (!roleData) return;
            
            const spawnX = GAME_CONFIG.arena.team2SpawnX + (index - 2) * 40;
            const spawnY = GAME_CONFIG.arena.team2SpawnY;
            const isBot = this.bots.includes(playerId);
            const playerName = isBot ? `Bot${index + 1}` : `Player${index + 1}`;
            
            const player = this.createPlayer(playerId, playerName, 2, spawnX, spawnY, roleData, isBot);
            this.allPlayers.push(player);
            
            if (playerId === this.playerId) {
                this.myPlayer = player;
            }
        });
    }
    
    createPlayer(playerId, name, team, x, y, roleData, isBot) {
        let player;
        
        switch (roleData.role) {
            case 'hero':
                player = new Hero(this, playerId, name, team, x, y, roleData.heroType, isBot);
                break;
            case 'wizard':
                player = new Wizard(this, playerId, name, team, x, y, isBot);
                break;
            case 'soldier':
                player = new Soldier(this, playerId, name, team, x, y, isBot);
                break;
            default:
                player = new Player(this, playerId, name, team, x, y, isBot);
        }
        
        // Create AI for bots
        if (isBot) {
            const ai = new BotAI(player, this);
            this.botAIs.push({ player: player, ai: ai });
        }
        
        return player;
    }
    
    setupInput() {
        // WASD movement
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Mouse input
        this.input.on('pointermove', (pointer) => {
            if (!this.myPlayer || !this.myPlayer.isAlive) return;
            
            // Store mouse position for aiming
            this.mouseX = pointer.x;
            this.mouseY = pointer.y;
        });
        
        // Click to attack
        this.input.on('pointerdown', (pointer) => {
            if (!this.myPlayer || !this.myPlayer.isAlive || this.myPlayer.isFrozen) return;
            
            // Find nearest enemy
            const enemies = this.allPlayers.filter(p => 
                p.isAlive && p.team !== this.myPlayer.team
            );
            
            if (enemies.length === 0) return;
            
            // Find enemy closest to mouse cursor
            let nearestEnemy = null;
            let minDist = Infinity;
            
            enemies.forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    pointer.x, pointer.y,
                    enemy.sprite.x, enemy.sprite.y
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = enemy;
                }
            });
            
            if (nearestEnemy) {
                this.myPlayer.attack(nearestEnemy);
                
                // Emit attack to server
                if (this.socket) {
                    this.socket.emit('player_action', {
                        type: 'attack',
                        targetId: nearestEnemy.id,
                        position: { x: this.myPlayer.sprite.x, y: this.myPlayer.sprite.y }
                    });
                }
            }
        });
        
        // Spacebar for ability
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    
    setupUI() {
        // Timer is already in HTML, just update it
        this.updateTimer(180000);
        
        // Ability cooldown display
        this.updateAbilityCooldown();
    }
    
    setupSocketListeners() {
        if (!this.socket) return;
        
        // Listen for other players' actions
        this.socket.on('player_action', (data) => {
            if (data.playerId === this.playerId) return; // Ignore own actions
            
            const player = this.allPlayers.find(p => p.id === data.playerId);
            if (!player || !player.isAlive) return;
            
            if (data.type === 'attack') {
                // Find target
                const target = this.allPlayers.find(p => p.id === data.targetId);
                if (target) {
                    player.attack(target);
                }
            } else if (data.type === 'move') {
                player.moveTo(data.position.x, data.position.y);
            }
        });
        
        // Listen for player deaths
        this.socket.on('player_died', (data) => {
            const player = this.allPlayers.find(p => p.id === data.playerId);
            if (player && player.isAlive) {
                const killer = this.allPlayers.find(p => p.id === data.killerId);
                player.die(data.killerId);
            }
            
            // Check win condition
            this.checkWinCondition();
        });
        
        // Listen for ability usage
        this.socket.on('ability_used', (data) => {
            if (data.playerId === this.playerId) return;
            
            const player = this.allPlayers.find(p => p.id === data.playerId);
            if (!player || !player.isAlive || !player.useAbility) return;
            
            // Apply ability effects based on type
            if (data.abilityType === 'aegis') {
                // Freeze all enemies of the ability user
                this.allPlayers.forEach(p => {
                    if (p.team !== player.team && p.isAlive) {
                        p.freeze(GAME_CONFIG.stats.odysseus.freezeDuration);
                    }
                });
            } else if (data.abilityType === 'heal') {
                // Heal all teammates
                this.allPlayers.forEach(p => {
                    if (p.team === player.team && p.isAlive && !(p instanceof AchillesClone)) {
                        p.heal(player.maxHealth * GAME_CONFIG.stats.agamemnon.healAmount);
                    }
                });
            }
            // Other abilities are handled locally by the player object
        });
        
        // Listen for game time updates
        this.socket.on('game_time_update', (data) => {
            this.gameTime = data.elapsed;
            this.isOvertime = data.isOvertime;
            this.updateTimer(data.elapsed);
        });
        
        // Listen for overtime start
        this.socket.on('overtime_started', () => {
            this.isOvertime = true;
            document.getElementById('overtime-indicator').style.display = 'block';
        });
        
        // Listen for game end
        this.socket.on('game_ended', (data) => {
            this.endGame(data.result);
        });
    }
    
    update() {
        if (this.gameEnded) return;
        
        const time = Date.now();
        
        // Update all players
        this.allPlayers.forEach(player => {
            player.update(time, 16); // ~60fps delta
        });
        
        // Update projectiles
        this.projectiles.forEach(projectile => {
            projectile.update(this);
        });
        
        // Remove destroyed projectiles
        this.projectiles = this.projectiles.filter(p => p.active);
        
        // Update bot AIs
        this.botAIs.forEach(({ player, ai }) => {
            if (player.isAlive) {
                ai.update(time);
            }
        });
        
        // Handle player input
        this.handlePlayerInput();
        
        // Update ability cooldown display
        this.updateAbilityCooldown();
        
        // Check win condition periodically
        if (time % 1000 < 16) { // Check once per second
            this.checkWinCondition();
        }
    }
    
    handlePlayerInput() {
        if (!this.myPlayer || !this.myPlayer.isAlive || this.myPlayer.isFrozen) {
            if (this.myPlayer) this.myPlayer.stopMovement();
            return;
        }
        
        // Movement
        let velocityX = 0;
        let velocityY = 0;
        
        if (this.wasd.W.isDown || this.cursors.up.isDown) {
            velocityY = -this.myPlayer.speed;
        }
        if (this.wasd.S.isDown || this.cursors.down.isDown) {
            velocityY = this.myPlayer.speed;
        }
        if (this.wasd.A.isDown || this.cursors.left.isDown) {
            velocityX = -this.myPlayer.speed;
        }
        if (this.wasd.D.isDown || this.cursors.right.isDown) {
            velocityX = this.myPlayer.speed;
        }
        
        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }
        
        this.myPlayer.sprite.body.setVelocity(velocityX, velocityY);
        
        // Emit movement to server
        if ((velocityX !== 0 || velocityY !== 0) && this.socket) {
            this.socket.emit('player_action', {
                type: 'move',
                position: { x: this.myPlayer.sprite.x, y: this.myPlayer.sprite.y }
            });
        }
        
        // Ability usage
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.myPlayer.useAbility && this.myPlayer.canUseAbility()) {
                this.myPlayer.useAbility(this);
            }
        }
        
        // Auto-attack nearest enemy if in range
        if (this.mouseX && this.mouseY) {
            const enemies = this.allPlayers.filter(p => 
                p.isAlive && p.team !== this.myPlayer.team
            );
            
            if (enemies.length > 0) {
                // Find enemy closest to mouse cursor
                let nearestEnemy = null;
                let minDist = Infinity;
                
                enemies.forEach(enemy => {
                    const dist = Phaser.Math.Distance.Between(
                        this.mouseX, this.mouseY,
                        enemy.sprite.x, enemy.sprite.y
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEnemy = enemy;
                    }
                });
                
                if (nearestEnemy) {
                    this.myPlayer.attack(nearestEnemy);
                }
            }
        }
    }
    
    updateTimer(elapsed) {
        const timerElement = document.getElementById('time-display');
        if (!timerElement) return;
        
        if (this.isOvertime) {
            const overtimeElapsed = elapsed - GAME_CONFIG.timing.mainGameTime;
            const overtimeRemaining = GAME_CONFIG.timing.overtimeTime - overtimeElapsed;
            const seconds = Math.max(0, Math.ceil(overtimeRemaining / 1000));
            timerElement.textContent = `OVERTIME: ${seconds}s`;
        } else {
            const remaining = GAME_CONFIG.timing.mainGameTime - elapsed;
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.ceil((remaining % 60000) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    updateAbilityCooldown() {
        const cooldownElement = document.getElementById('ability-cooldown');
        const statusElement = document.getElementById('ability-status');
        
        if (!cooldownElement || !statusElement || !this.myPlayer || !this.myPlayer.useAbility) {
            cooldownElement.style.display = 'none';
            return;
        }
        
        cooldownElement.style.display = 'block';
        
        if (this.myPlayer.canUseAbility()) {
            statusElement.textContent = `${this.myPlayer.abilityName} Ready (SPACE)`;
            statusElement.id = 'ability-ready';
        } else {
            const timeSinceUse = Date.now() - this.myPlayer.lastAbilityTime;
            const remaining = Math.ceil((this.myPlayer.abilityCooldown - timeSinceUse) / 1000);
            statusElement.textContent = `${this.myPlayer.abilityName} Cooldown: ${remaining}s`;
            statusElement.id = '';
        }
    }
    
    checkWinCondition() {
        if (this.gameEnded) return;
        
        const team1Alive = this.allPlayers.filter(p => 
            p.team === 1 && p.isAlive
        ).length;
        
        const team2Alive = this.allPlayers.filter(p => 
            p.team === 2 && p.isAlive
        ).length;
        
        // Check for win
        if (team1Alive === 0) {
            this.endGame(this.myTeam === 2 ? 'win' : 'lose');
        } else if (team2Alive === 0) {
            this.endGame(this.myTeam === 1 ? 'win' : 'lose');
        } else if (this.isOvertime) {
            // In overtime, first kill wins
            // This is handled by the server when a player dies
        }
    }
    
    endGame(result) {
        if (this.gameEnded) return;
        
        this.gameEnded = true;
        
        // Stop all movement
        this.allPlayers.forEach(player => {
            player.stopMovement();
        });
        
        // Show game over screen
        const gameOverScreen = document.getElementById('game-over-screen');
        const gameOverTitle = document.getElementById('game-over-title');
        const gameOverResult = document.getElementById('game-over-result');
        
        if (gameOverScreen) {
            gameOverScreen.style.display = 'flex';
            
            if (result === 'win') {
                gameOverTitle.textContent = 'VICTORY!';
                gameOverTitle.className = 'win-text';
                gameOverResult.textContent = 'Your team has won the battle!';
            } else if (result === 'lose') {
                gameOverTitle.textContent = 'DEFEAT';
                gameOverTitle.className = 'lose-text';
                gameOverResult.textContent = 'Your team has been defeated.';
            } else {
                gameOverTitle.textContent = 'DRAW';
                gameOverTitle.className = 'draw-text';
                gameOverResult.textContent = 'The battle ended in a draw.';
            }
        }
    }
    
    createParticleSystem() {
        // Create a simple particle texture for fireballs
        const graphics = this.add.graphics();
        graphics.fillStyle(0xff6600, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
        graphics.destroy();
    }
}

