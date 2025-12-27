class BotAI {
    constructor(player, scene) {
        this.player = player;
        this.scene = scene;
        
        // AI behavior settings
        this.updateInterval = 200; // Update AI every 200ms
        this.lastUpdate = 0;
        
        // Current target
        this.currentTarget = null;
        this.targetLockDuration = 2000; // Stick to target for 2 seconds
        this.targetLockTime = 0;
        
        // Movement behavior
        this.wanderTarget = null;
        this.lastWanderTime = 0;
        this.wanderInterval = 3000;
        
        // Combat behavior
        this.preferredRange = this.getPreferredRange();
        this.retreatThreshold = 0.3; // Retreat when health below 30%
        this.isRetreating = false;
        
        // Ability usage
        this.abilityUsageChance = 0.8; // 80% chance to use ability when available and beneficial
        this.lastAbilityConsiderationTime = 0;
        this.abilityConsiderationInterval = 1000;
        
        // Team coordination
        this.teamStrategy = Math.random() > 0.5 ? 'aggressive' : 'defensive';
    }
    
    update(time) {
        if (!this.player.isAlive || this.player.isFrozen) {
            this.player.stopMovement();
            return;
        }
        
        if (time - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = time;
        
        // Check if should retreat
        const healthPercent = this.player.health / this.player.maxHealth;
        this.isRetreating = healthPercent < this.retreatThreshold;
        
        // Find or update target
        this.updateTarget(time);
        
        // Make decision
        if (this.currentTarget && this.currentTarget.isAlive) {
            this.engageTarget(time);
        } else {
            this.wander(time);
        }
        
        // Consider using ability
        this.considerAbility(time);
    }
    
    updateTarget(time) {
        // Keep current target if still valid
        if (this.currentTarget && this.currentTarget.isAlive && 
            time - this.targetLockTime < this.targetLockDuration) {
            return;
        }
        
        // Find new target
        const enemies = this.scene.allPlayers.filter(p => 
            p.isAlive && p.team !== this.player.team
        );
        
        if (enemies.length === 0) {
            this.currentTarget = null;
            return;
        }
        
        // Target selection strategy
        let bestTarget = null;
        let bestScore = -Infinity;
        
        enemies.forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(
                this.player.sprite.x, this.player.sprite.y,
                enemy.sprite.x, enemy.sprite.y
            );
            
            // Scoring factors
            let score = 0;
            
            // Prefer closer enemies
            score += (1000 - distance) / 10;
            
            // Prefer low health enemies
            const healthPercent = enemy.health / enemy.maxHealth;
            score += (1 - healthPercent) * 100;
            
            // Prefer non-heroes if we're a soldier (safer)
            if (this.player.role === 'soldier' && enemy.role !== 'hero') {
                score += 50;
            }
            
            // Wizards prefer to attack from range
            if (this.player.role === 'wizard') {
                if (distance > 200 && distance < 400) {
                    score += 80; // Sweet spot for wizard
                }
            }
            
            // Heroes are more aggressive
            if (this.player.role === 'hero' && enemy.role === 'hero') {
                score += 70; // Hero duel
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        });
        
        if (bestTarget !== this.currentTarget) {
            this.currentTarget = bestTarget;
            this.targetLockTime = time;
        }
    }
    
    engageTarget(time) {
        if (!this.currentTarget || !this.currentTarget.isAlive) return;
        
        const distance = Phaser.Math.Distance.Between(
            this.player.sprite.x, this.player.sprite.y,
            this.currentTarget.sprite.x, this.currentTarget.sprite.y
        );
        
        // Retreating behavior
        if (this.isRetreating) {
            this.retreat();
            return;
        }
        
        // Different behavior based on weapon type
        if (this.player.weapon === 'bow' || this.player.weapon === 'fireball') {
            this.rangedCombat(distance);
        } else {
            this.meleeCombat(distance);
        }
        
        // Try to attack
        this.player.attack(this.currentTarget);
    }
    
    meleeCombat(distance) {
        const optimalRange = this.player.attackRange * 0.9;
        
        if (distance > optimalRange) {
            // Move towards target
            this.moveTowards(this.currentTarget.sprite.x, this.currentTarget.sprite.y);
        } else if (distance < optimalRange * 0.5) {
            // Too close, back up slightly (kiting)
            this.moveAway(this.currentTarget.sprite.x, this.currentTarget.sprite.y);
        } else {
            // At good range, circle strafe
            this.circleStrafe();
        }
    }
    
    rangedCombat(distance) {
        const optimalRange = 300; // Preferred distance for ranged attackers
        const minRange = 150;     // Don't let enemies get too close
        
        if (distance < minRange) {
            // Enemy too close, kite backwards
            this.moveAway(this.currentTarget.sprite.x, this.currentTarget.sprite.y);
        } else if (distance > optimalRange + 100) {
            // Too far, move closer
            this.moveTowards(this.currentTarget.sprite.x, this.currentTarget.sprite.y);
        } else {
            // At good range, strafe
            this.circleStrafe();
        }
    }
    
    wander(time) {
        if (!this.wanderTarget || time - this.lastWanderTime > this.wanderInterval) {
            // Pick a new wander point
            const bounds = this.scene.physics.world.bounds;
            this.wanderTarget = {
                x: Phaser.Math.Between(bounds.x + 100, bounds.width - 100),
                y: Phaser.Math.Between(bounds.y + 100, bounds.height - 100)
            };
            this.lastWanderTime = time;
        }
        
        const distance = Phaser.Math.Distance.Between(
            this.player.sprite.x, this.player.sprite.y,
            this.wanderTarget.x, this.wanderTarget.y
        );
        
        if (distance > 30) {
            this.moveTowards(this.wanderTarget.x, this.wanderTarget.y);
        } else {
            this.player.stopMovement();
        }
    }
    
    retreat() {
        // Find teammates
        const teammates = this.scene.allPlayers.filter(p =>
            p.isAlive && p.team === this.player.team && p.id !== this.player.id
        );
        
        if (teammates.length > 0) {
            // Retreat towards nearest teammate
            let nearestTeammate = teammates[0];
            let minDist = Infinity;
            
            teammates.forEach(tm => {
                const dist = Phaser.Math.Distance.Between(
                    this.player.sprite.x, this.player.sprite.y,
                    tm.sprite.x, tm.sprite.y
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearestTeammate = tm;
                }
            });
            
            this.moveTowards(nearestTeammate.sprite.x, nearestTeammate.sprite.y);
        } else {
            // Retreat to spawn point
            const spawnX = this.player.team === 1 ? GAME_CONFIG.arena.team1SpawnX : GAME_CONFIG.arena.team2SpawnX;
            const spawnY = this.player.team === 1 ? GAME_CONFIG.arena.team1SpawnY : GAME_CONFIG.arena.team2SpawnY;
            this.moveTowards(spawnX, spawnY);
        }
    }
    
    moveTowards(targetX, targetY) {
        const angle = Math.atan2(targetY - this.player.sprite.y, targetX - this.player.sprite.x);
        this.player.sprite.body.setVelocity(
            Math.cos(angle) * this.player.speed,
            Math.sin(angle) * this.player.speed
        );
    }
    
    moveAway(targetX, targetY) {
        const angle = Math.atan2(this.player.sprite.y - targetY, this.player.sprite.x - targetX);
        this.player.sprite.body.setVelocity(
            Math.cos(angle) * this.player.speed,
            Math.sin(angle) * this.player.speed
        );
    }
    
    circleStrafe() {
        if (!this.currentTarget) return;
        
        const angle = Math.atan2(
            this.currentTarget.sprite.y - this.player.sprite.y,
            this.currentTarget.sprite.x - this.player.sprite.x
        );
        
        // Perpendicular movement
        const strafeAngle = angle + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
        this.player.sprite.body.setVelocity(
            Math.cos(strafeAngle) * this.player.speed * 0.7,
            Math.sin(strafeAngle) * this.player.speed * 0.7
        );
    }
    
    considerAbility(time) {
        if (!this.player.useAbility) return; // Not a hero
        if (time - this.lastAbilityConsiderationTime < this.abilityConsiderationInterval) return;
        
        this.lastAbilityConsiderationTime = time;
        
        if (!this.player.canUseAbility()) return;
        
        // Random chance to use ability
        if (Math.random() > this.abilityUsageChance) return;
        
        // Ability-specific logic
        if (this.player.heroType === 'achilles') {
            // Use clone when engaging enemies
            if (this.currentTarget && !this.isRetreating) {
                this.player.useAbility(this.scene);
            }
        } else if (this.player.heroType === 'agamemnon') {
            // Use heal when team is damaged
            const teammates = this.scene.allPlayers.filter(p =>
                p.isAlive && p.team === this.player.team
            );
            const averageHealth = teammates.reduce((sum, p) => sum + (p.health / p.maxHealth), 0) / teammates.length;
            
            if (averageHealth < 0.6) {
                this.player.useAbility(this.scene);
            }
        } else if (this.player.heroType === 'menelaus') {
            // Use rage when engaging strong enemies
            if (this.currentTarget && (this.currentTarget.role === 'hero' || this.currentTarget.health > this.player.health)) {
                this.player.useAbility();
            }
        } else if (this.player.heroType === 'odysseus') {
            // Use aegis when enemies are close
            const nearbyEnemies = this.scene.allPlayers.filter(p => {
                if (!p.isAlive || p.team === this.player.team) return false;
                const dist = Phaser.Math.Distance.Between(
                    this.player.sprite.x, this.player.sprite.y,
                    p.sprite.x, p.sprite.y
                );
                return dist < 300;
            });
            
            if (nearbyEnemies.length >= 2) {
                this.player.useAbility(this.scene);
            }
        }
    }
    
    getPreferredRange() {
        switch (this.player.weapon) {
            case 'bow':
            case 'fireball':
                return 300;
            case 'longsword':
                return 40;
            default:
                return 30;
        }
    }
}

